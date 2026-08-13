import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseCalibration } from "../audio/calibration";
import {
	checkEnvironment,
	chooseOutputDevice,
	enumerateAudioDevices,
	requestMicrophonePermission,
} from "../audio/devices";
import { getActiveEqFilters, hasEqToApply } from "../audio/eqChain";
import { runMeasurement, startLevelTest } from "../audio/measurement";
import {
	clampInputChannelIndex,
	uadInputRoutingHint,
} from "../audio/inputCapture";
import {
	isMeasurementAbortError,
	MEASUREMENT_ABORT_MESSAGE,
} from "../audio/measurementAbort";
import type { MeasurementAudioFrame } from "../audio/measurementAudioVisual";
import type {
	ChannelMode,
	ChartSeries,
	CurvePoint,
	DeviceStatusType,
	MeasurementCount,
	MeasurementMeta,
	MeasurementRun,
	MeasurementSessionStep,
	SavedMeasurement,
	SavedPreset,
	SelectedOutputDevice,
	Suggestion,
} from "../types";
import { buildDynamicPresetName, buildPresetText } from "../utils/preset";
import { downloadText, safePresetFilename } from "../utils/download";
import { formatFrequency, meterOptimalRangeLabel } from "../utils/format";
import { averageCurves } from "../utils/averageCurves";
import {
	createSavedMeasurement,
	extractMeasurementPrefix,
	loadSavedMeasurements,
	nextMeasurementNumber,
	prependSavedMeasurement,
	removeSavedMeasurement,
	writeSavedMeasurements,
} from "../utils/savedMeasurements";
import {
	createSavedPreset,
	loadSavedPresets,
	prependSavedPreset,
	removeSavedPreset,
	writeSavedPresets,
} from "../utils/savedPresets";
import { PRO_MAX_AUTO_BANDS } from "../utils/autoEqBridge";
import { MOCK_PRESET_COUNT, getMockPresetLabel } from "../components/advanced-setup/constants";
import { createMockMeasurementRun } from "../utils/mockMeasurement";
import { runCorrectionPipeline } from "../utils/correctionPipeline";
import type { EqAlgorithmVersion } from "../config/eqAlgorithms";
import type { AutoEqProgress, AutoEqPrecision } from "../audio/auto-eq/types";
import type { AutoEqV3Progress } from "../audio/auto-eq/v3/types";
import { mapAutoEqV2ResultToPipeline } from "../utils/autoEqBridgeV2";
import { mapAutoEqV3ResultToPipeline } from "../utils/autoEqBridgeV3";
import { runAutoEqV2Worker } from "../audio/auto-eq/autoEqWorkerClient";
import { runAutoEqV3Worker } from "../audio/auto-eq/v3/autoEqV3WorkerClient";
import { sanitizeCurve } from "../utils/sanitizeCurve";
import {
	buildTargetCurve,
	FLAT_TARGET_LABEL,
	ROOM_TARGET_LABEL,
} from "../utils/toneProfile";
import { buildCorrectedCurve } from "../utils/correctedCurve";
import {
	applySuggestionAdjustments,
	clampSuggestionQ,
	defaultBoostGainForDip,
	isSuggestionEnabled,
	suggestionKey,
} from "../utils/suggestionQ";
import {
	createCustomSuggestion,
	isBandTooClose,
	mergeSuggestions,
	withoutOverlaySuggestions,
} from "../utils/customBands";
import {
	createOverlaySuggestions,
	getEqShapePreset,
	SOS_OVERLAY_BANDS,
	type EqShapePresetId,
} from "../config/eqShapePresets";
import {
	MEASUREMENT_PRESETS,
	SWEEP_LEVEL_DB,
	type MeasurementPresetId,
} from "../config/measurementPresets";
import { bandColorForIndex } from "../config/bandColors";
import type { FilterOverlay } from "../chart/drawFilterOverlays";

const RUN_COLORS = ["#8ec5ff", "#55d68b", "#ffbf5a"];
const AUTO_EQ_MAX_CORRECTION_HZ = 1000;

export interface MockPreset {
	id: number;
	label: string;
	runs: MeasurementRun[];
}

function getDeviceStatusMessage(
	mediaPermissionGranted: boolean,
	permissionJustGranted: boolean,
	visibleInputCount: number,
	visibleOutputCount: number,
	namesHidden: boolean,
): { message: string; type: DeviceStatusType } {
	if (!mediaPermissionGranted && !permissionJustGranted) {
		return {
			message:
				"The device list is limited by browser privacy. Click “Show inputs” and allow microphone access.",
			type: "warning",
		};
	}
	if (visibleInputCount === 0) {
		return {
			message:
				"The system returned only the default input alias. Check that your interface is connected, Chrome has microphone access in macOS settings, and the page is served over localhost/HTTPS.",
			type: "bad",
		};
	}
	if (namesHidden) {
		return {
			message: `Found ${visibleInputCount} inputs and ${visibleOutputCount} outputs, but some names are still hidden. Try granting access again or refresh the page.`,
			type: "warning",
		};
	}
	const outputText =
		visibleOutputCount > 0
			? `${visibleOutputCount} outputs`
			: "system default output only";
	return {
		message: `Found ${visibleInputCount} inputs and ${outputText}.`,
		type: "good",
	};
}

function buildChartSeries(
	runs: MeasurementRun[],
	averaged: MeasurementRun | null,
): ChartSeries[] {
	if (!runs.length && !averaged) return [];

	if (runs.length <= 1 && !averaged) {
		const run = runs[0];
		return run
			? [
					{
						id: `run-${run.index}`,
						label: run.label,
						curve: run.curve,
						color: "#65a9ff",
						lineWidth: 2.2,
						alpha: 1,
					},
				]
			: [];
	}

	const series: ChartSeries[] = runs.map((run, index) => ({
		id: `run-${run.index}`,
		label: run.label,
		curve: run.curve,
		color: RUN_COLORS[index] ?? "#8ec5ff",
		lineWidth: 1.6,
		alpha: 0.55,
	}));

	if (averaged) {
		series.push({
			id: "average",
			label: averaged.label,
			curve: averaged.curve,
			color: "#65a9ff",
			lineWidth: 2.4,
			alpha: 1,
		});
	}

	return series;
}

export function useRoomEq() {
	const env = useMemo(() => checkEnvironment(), []);

	const [mediaPermissionGranted, setMediaPermissionGranted] = useState(false);
	const [selectedOutputDevice, setSelectedOutputDevice] =
		useState<SelectedOutputDevice | null>(null);
	const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
	const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
	const [deviceStatus, setDeviceStatus] = useState({
		message:
			"Before permission is granted, the browser may show only default devices without names.",
		type: "" as DeviceStatusType,
	});

	const [inputDeviceId, setInputDeviceId] = useState("");
	const [inputChannelIndex, setInputChannelIndex] = useState(0);
	const [inputChannelCount, setInputChannelCount] = useState(1);
	const [outputDeviceId, setOutputDeviceId] = useState("");
	const [channel, setChannel] = useState<ChannelMode>("both");
	const [fStart, setFStart] = useState(40);
	const [fEnd, setFEnd] = useState(20000);
	const [duration, setDuration] = useState(10);
	const [smoothing, setSmoothing] = useState(12);
	const [measurementCount, setMeasurementCount] = useState<MeasurementCount>(1);
	const [safetyCheck, setSafetyCheck] = useState(false);
	const [activeMeasurementPresetId, setActiveMeasurementPresetId] =
		useState<MeasurementPresetId>("room");
	const [calibration, setCalibration] = useState<[number, number][]>([]);
	const [calibrationStatus, setCalibrationStatus] = useState(
		"Format: frequency and dB correction in two columns. The correction is added to the result.",
	);

	const [statusText, setStatusText] = useState("Ready");
	const [progress, setProgress] = useState(0);
	const [running, setRunning] = useState(false);

	const [meterActive, setMeterActive] = useState(false);
	const [meterDb, setMeterDb] = useState(-Infinity);
	const levelTestRef = useRef<{ stop: () => Promise<void> } | null>(null);
	const sessionMeterRef = useRef<{ stop: () => Promise<void> } | null>(null);
	const sessionAudioFrameRef = useRef<MeasurementAudioFrame | null>(null);
	const sessionMeasurementAbortRef = useRef<AbortController | null>(null);

	const [curve, setCurve] = useState<CurvePoint[]>([]);
	const [measurementMeta, setMeasurementMeta] =
		useState<MeasurementMeta | null>(null);
	const [measurementRuns, setMeasurementRuns] = useState<MeasurementRun[]>([]);
	const [averagedRun, setAveragedRun] = useState<MeasurementRun | null>(null);
	const [savedMeasurements, setSavedMeasurements] = useState<
		SavedMeasurement[]
	>(() => loadSavedMeasurements());
	const [activeSavedMeasurementId, setActiveSavedMeasurementId] = useState<
		string | null
	>(null);
	const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(() =>
		loadSavedPresets(),
	);
	const [activeSavedPresetId, setActiveSavedPresetId] = useState<string | null>(
		null,
	);

	const [sessionOpen, setSessionOpen] = useState(false);
	const [sessionStep, setSessionStep] =
		useState<MeasurementSessionStep>("mic-test");
	const [sessionTargetCount, setSessionTargetCount] =
		useState<MeasurementCount>(1);
	const [sessionRuns, setSessionRuns] = useState<MeasurementRun[]>([]);
	const [sessionMeasuringRunIndex, setSessionMeasuringRunIndex] = useState<
		number | null
	>(null);
	const [sessionMeterActive, setSessionMeterActive] = useState(false);
	const [sessionMeterDb, setSessionMeterDb] = useState(-Infinity);
	const [sessionWarning, setSessionWarning] = useState<string | null>(null);

	const [presetName, setPresetName] = useState(() =>
		buildDynamicPresetName({ algorithmVersion: "v1", smoothing: 12 }),
	);
	const [presetPreamp, setPresetPreamp] = useState(0);
	const [presetStatus, setPresetStatus] = useState("");
	const [suggestionQOverrides, setSuggestionQOverrides] = useState<
		Record<string, number>
	>({});
	const [suggestionGainOverrides, setSuggestionGainOverrides] = useState<
		Record<string, number>
	>({});
	const [suggestionEnabledOverrides, setSuggestionEnabledOverrides] = useState<
		Record<string, boolean>
	>({});
	const [customSuggestions, setCustomSuggestions] = useState<Suggestion[]>([]);
	const [eqAlgorithmVersion, setEqAlgorithmVersion] =
		useState<EqAlgorithmVersion>("v1");
	const [autoEqV2Progress, setAutoEqV2Progress] =
		useState<AutoEqProgress | null>(null);
	const [autoEqV2Result, setAutoEqV2Result] = useState<ReturnType<
		typeof mapAutoEqV2ResultToPipeline
	> | null>(null);
	const [autoEqV3Progress, setAutoEqV3Progress] =
		useState<AutoEqV3Progress | null>(null);
	const [autoEqV3Result, setAutoEqV3Result] = useState<ReturnType<
		typeof mapAutoEqV3ResultToPipeline
	> | null>(null);
	const [v2RunTrigger, setV2RunTrigger] = useState<{
		nonce: number;
		precision: AutoEqPrecision;
	}>({ nonce: 0, precision: "standard" });
	const [v3RunTrigger, setV3RunTrigger] = useState(0);
	const [eqShapePreset, setEqShapePreset] = useState<EqShapePresetId | null>(
		null,
	);
	const [sosOverlayEnabled, setSosOverlayEnabled] = useState(false);
	const sosOverlayEnabledRef = useRef(false);
	sosOverlayEnabledRef.current = sosOverlayEnabled;
	const [removedSuggestionKeys, setRemovedSuggestionKeys] = useState<
		Record<string, true>
	>({});
	const [verificationCurve, setVerificationCurve] = useState<
		CurvePoint[] | null
	>(null);
	const [verificationMeta, setVerificationMeta] =
		useState<MeasurementMeta | null>(null);
	const [verificationRunning, setVerificationRunning] = useState(false);
	const [chartSeriesHidden, setChartSeriesHidden] = useState<
		Record<string, boolean>
	>({});

	const refreshDevices = useCallback(
		async (permissionJustGranted = false) => {
			const result = await enumerateAudioDevices();
			let nextInputs = result.inputs;
			let nextOutputs = result.outputs;

			if (
				selectedOutputDevice?.deviceId &&
				!nextOutputs.some((d) => d.deviceId === selectedOutputDevice.deviceId)
			) {
				nextOutputs = [
					...nextOutputs,
					{
						deviceId: selectedOutputDevice.deviceId,
						kind: "audiooutput" as MediaDeviceKind,
						label: selectedOutputDevice.label,
						groupId: "",
						toJSON: () => ({}),
					},
				];
			}

			setInputs(nextInputs);
			setOutputs(nextOutputs);

			const status = getDeviceStatusMessage(
				mediaPermissionGranted,
				permissionJustGranted,
				nextInputs.length,
				nextOutputs.length,
				result.unnamedInputs + result.unnamedOutputs > 0,
			);
			setDeviceStatus(status);
		},
		[mediaPermissionGranted, selectedOutputDevice],
	);

	useEffect(() => {
		refreshDevices().catch(() => {});
	}, [refreshDevices]);

	useEffect(() => {
		const handler = () => {
			refreshDevices().catch(() => {});
		};
		navigator.mediaDevices?.addEventListener?.("devicechange", handler);
		return () => {
			navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
		};
	}, [refreshDevices]);

	useEffect(() => {
		return () => {
			levelTestRef.current?.stop().catch(() => {});
			sessionMeterRef.current?.stop().catch(() => {});
		};
	}, []);

	const setStatus = useCallback((text: string, prog = 0) => {
		setStatusText(text);
		setProgress(Math.max(0, Math.min(100, prog)));
	}, []);

	const environmentBadge = useMemo(() => {
		if (env.ready) {
			return {
				text: env.hasWorklet
					? "Environment ready"
					: "Environment ready · compatibility mode",
				color: "var(--good)",
			};
		}
		const problems: string[] = [];
		if (!env.secure) problems.push("HTTPS/localhost required");
		if (!env.hasMedia) problems.push("getUserMedia unavailable");
		if (!env.hasAudio) problems.push("Web Audio API unavailable");
		return { text: problems.join(" · "), color: "var(--bad)" };
	}, [env]);

	const sinkHelp = useMemo(() => {
		if (env.supportsSink && env.supportsOutputPicker) {
			return "You can pick an output from the list or use the “Choose output” button to grant it permission.";
		}
		if (env.supportsSink) {
			return "The browser can set output from the list. If the list is empty, set your interface as the macOS default output.";
		}
		return "This browser does not support Web Audio output selection. The system default output will be used.";
	}, [env]);

	const measureEnabled =
		env.ready && safetyCheck && !running && !meterActive && !sessionOpen;

	const targetCurve = useMemo(() => {
		if (!curve.length) return [];
		if (eqAlgorithmVersion === "v3" && autoEqV3Result?.target?.length) {
			return autoEqV3Result.target;
		}
		if (eqAlgorithmVersion === "v2" && autoEqV2Result?.target?.length) {
			return autoEqV2Result.target;
		}
		return buildTargetCurve(curve);
	}, [curve, eqAlgorithmVersion, autoEqV2Result, autoEqV3Result]);

	const targetSeriesLabel = useMemo(() => {
		if (eqAlgorithmVersion === "v3" && autoEqV3Result?.v3) {
			return (
				autoEqV3Result.v3.targetLabel ??
				(autoEqV3Result.v3.targetType === "room"
					? ROOM_TARGET_LABEL
					: autoEqV3Result.v3.targetType === "flat"
						? FLAT_TARGET_LABEL
						: "Custom target")
			);
		}
		if (eqAlgorithmVersion === "v2" && autoEqV2Result?.v2) {
			return ROOM_TARGET_LABEL;
		}
		return FLAT_TARGET_LABEL;
	}, [eqAlgorithmVersion, autoEqV2Result, autoEqV3Result]);

	const autoEqV1 = useMemo(() => {
		if (!curve.length || eqAlgorithmVersion !== "v1") return null;
		try {
			return runCorrectionPipeline("v1", curve, {
				sampleRate: measurementMeta?.sampleRate,
				fStart,
				fEnd,
				maxFilters: PRO_MAX_AUTO_BANDS,
				maxCorrectionFrequency: AUTO_EQ_MAX_CORRECTION_HZ,
			});
		} catch {
			return null;
		}
	}, [curve, eqAlgorithmVersion, measurementMeta?.sampleRate, fStart, fEnd]);

	useEffect(() => {
		if (eqAlgorithmVersion !== "v2" || !curve.length) return;
		setV2RunTrigger((previous) => ({
			nonce: previous.nonce + 1,
			precision: "standard",
		}));
	}, [
		curve,
		eqAlgorithmVersion,
		measurementRuns,
		measurementMeta?.sampleRate,
		fStart,
		fEnd,
	]);

	useEffect(() => {
		if (eqAlgorithmVersion !== "v2" || !curve.length) {
			setAutoEqV2Result(null);
			setAutoEqV2Progress(null);
			return undefined;
		}

		const controller = new AbortController();
		const measurements =
			measurementRuns.length > 0
				? measurementRuns.map((run) => run.curve)
				: [curve];

		setAutoEqV2Progress({ stage: "preparing", progress: 0 });

		runAutoEqV2Worker({
			measurements,
			options: {
				sampleRate: measurementMeta?.sampleRate ?? 48_000,
				minFrequency: Math.max(20, fStart),
				maxFrequency: fEnd,
				maxFilters: PRO_MAX_AUTO_BANDS,
				targetType: "room",
				allowBoosts: true,
				fullRangeCorrection: true,
				precision: v2RunTrigger.precision,
			},
			onProgress: setAutoEqV2Progress,
			signal: controller.signal,
		})
			.then((result) => {
				setAutoEqV2Result(mapAutoEqV2ResultToPipeline(result));
				setAutoEqV2Progress(null);
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setAutoEqV2Result(null);
					setAutoEqV2Progress(null);
				}
			});

		return () => controller.abort();
	}, [
		v2RunTrigger,
		eqAlgorithmVersion,
		curve,
		measurementMeta?.sampleRate,
		measurementRuns,
		fStart,
		fEnd,
	]);

	const recalculateV2AutoEq = useCallback(() => {
		setV2RunTrigger((previous) => ({
			nonce: previous.nonce + 1,
			precision: "high",
		}));
	}, []);

	const autoEqV2IsRunning = autoEqV2Progress !== null;
	const autoEqV2LastPrecision = v2RunTrigger.precision;

	useEffect(() => {
		if (eqAlgorithmVersion !== "v3" || !curve.length) return;
		setV3RunTrigger((previous) => previous + 1);
	}, [
		curve,
		eqAlgorithmVersion,
		measurementRuns,
		measurementMeta?.sampleRate,
		fStart,
		fEnd,
	]);

	useEffect(() => {
		if (eqAlgorithmVersion !== "v3" || !curve.length) {
			setAutoEqV3Result(null);
			setAutoEqV3Progress(null);
			return undefined;
		}

		const controller = new AbortController();
		const measurements =
			measurementRuns.length > 0
				? measurementRuns.map((run) => run.curve)
				: [curve];

		setAutoEqV3Progress({ stage: "preparing", progress: 0 });

		runAutoEqV3Worker({
			measurements,
			options: {
				sampleRate: measurementMeta?.sampleRate ?? 48_000,
				minFrequency: Math.max(20, fStart),
				maxFrequency: fEnd,
				maxFilters: PRO_MAX_AUTO_BANDS,
				targetType: "room",
				allowBoosts: true,
				fullRangeCorrection: true,
				seed: 42,
			},
			onProgress: setAutoEqV3Progress,
			signal: controller.signal,
		})
			.then((result) => {
				setAutoEqV3Result(mapAutoEqV3ResultToPipeline(result));
				setAutoEqV3Progress(null);
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setAutoEqV3Result(null);
					setAutoEqV3Progress(null);
				}
			});

		return () => controller.abort();
	}, [
		v3RunTrigger,
		eqAlgorithmVersion,
		curve,
		measurementMeta?.sampleRate,
		measurementRuns,
		fStart,
		fEnd,
	]);

	const recalculateV3AutoEq = useCallback(() => {
		setV3RunTrigger((previous) => previous + 1);
	}, []);

	const autoEqV3IsRunning = autoEqV3Progress !== null;

	const autoEq =
		eqAlgorithmVersion === "v3"
			? autoEqV3Result
			: eqAlgorithmVersion === "v2"
				? autoEqV2Result
				: autoEqV1;

	useEffect(() => {
		if (autoEq) {
			setPresetPreamp(autoEq.preampDb);
		}
	}, [autoEq]);

	const computedSuggestions = useMemo((): Suggestion[] => {
		if (!curve.length) return [];
		return autoEq?.suggestions ?? [];
	}, [curve, autoEq]);

	const suggestionSignature = useMemo(
		() => computedSuggestions.map((item) => suggestionKey(item)).join("|"),
		[computedSuggestions],
	);

	useEffect(() => {
		setSuggestionQOverrides({});
		setSuggestionGainOverrides({});
		setSuggestionEnabledOverrides({});
		setRemovedSuggestionKeys({});

		setCustomSuggestions((previous) => {
			const withoutOverlays = withoutOverlaySuggestions(previous);
			if (!sosOverlayEnabledRef.current) return withoutOverlays;
			return [
				...withoutOverlays,
				...createOverlaySuggestions(SOS_OVERLAY_BANDS),
			].sort((a, b) => a.frequency - b.frequency);
		});

		if (eqShapePreset && eqShapePreset !== "auto") {
			const config = getEqShapePreset(eqShapePreset);
			const nextQ: Record<string, number> = {};
			for (const item of computedSuggestions) {
				nextQ[suggestionKey(item)] = clampSuggestionQ(item.q * config.qScale);
			}
			setSuggestionQOverrides(nextQ);
		}
	}, [suggestionSignature, eqShapePreset, computedSuggestions]);

	const activeComputedSuggestions = useMemo(
		() =>
			computedSuggestions.filter(
				(item) => !removedSuggestionKeys[suggestionKey(item)],
			),
		[computedSuggestions, removedSuggestionKeys],
	);

	const applyEqShapePreset = useCallback((preset: EqShapePresetId) => {
		setEqShapePreset(preset);
	}, []);

	const toggleSosOverlay = useCallback(() => {
		setSosOverlayEnabled((previous) => {
			const next = !previous;
			setCustomSuggestions((custom) => {
				const withoutOverlays = withoutOverlaySuggestions(custom);
				if (!next) return withoutOverlays;
				return [
					...withoutOverlays,
					...createOverlaySuggestions(SOS_OVERLAY_BANDS),
				].sort((a, b) => a.frequency - b.frequency);
			});
			return next;
		});
	}, []);

	const mergedSuggestions = useMemo(
		() => mergeSuggestions(activeComputedSuggestions, customSuggestions),
		[activeComputedSuggestions, customSuggestions],
	);

	const suggestions = useMemo(
		() =>
			applySuggestionAdjustments(
				mergedSuggestions,
				suggestionQOverrides,
				suggestionGainOverrides,
				suggestionEnabledOverrides,
			),
		[
			mergedSuggestions,
			suggestionQOverrides,
			suggestionGainOverrides,
			suggestionEnabledOverrides,
		],
	);

	const filterOverlays = useMemo((): FilterOverlay[] => {
		return suggestions
			.filter(
				(item) =>
					item.enabled !== false &&
					item.gain !== null &&
					Math.abs(item.gain) > 0.05,
			)
			.map((item, index) => ({
				frequency: item.frequency,
				gain: item.gain ?? 0,
				q: item.q,
				color: bandColorForIndex(index),
			}));
	}, [suggestions]);

	const globalBandQ = useMemo(() => {
		if (!suggestions.length) return 1;
		const sorted = suggestions.map((item) => item.q).sort((a, b) => a - b);
		return sorted[Math.floor(sorted.length / 2)];
	}, [suggestions]);

	const setSuggestionQ = useCallback((key: string, q: number) => {
		setSuggestionQOverrides((previous) => ({
			...previous,
			[key]: clampSuggestionQ(q),
		}));
	}, []);

	const setAllSuggestionQ = useCallback(
		(q: number) => {
			const clamped = clampSuggestionQ(q);
			const next: Record<string, number> = {};
			for (const item of mergedSuggestions) {
				next[suggestionKey(item)] = clamped;
			}
			setSuggestionQOverrides(next);
		},
		[mergedSuggestions],
	);

	const scaleAllSuggestionQ = useCallback(
		(factor: number) => {
			const safeFactor = Math.max(0.25, Math.min(2, factor));
			const next: Record<string, number> = {};
			for (const item of mergedSuggestions) {
				next[suggestionKey(item)] = clampSuggestionQ(item.q * safeFactor);
			}
			setSuggestionQOverrides(next);
		},
		[mergedSuggestions],
	);

	const setSuggestionGain = useCallback((key: string, gain: number) => {
		setSuggestionGainOverrides((previous) => ({
			...previous,
			[key]: gain,
		}));
	}, []);

	const toggleSuggestionEnabled = useCallback(
		(key: string) => {
			const item = mergedSuggestions.find(
				(entry) => suggestionKey(entry) === key,
			);
			if (!item) return;

			setSuggestionEnabledOverrides((previous) => {
				const currentlyEnabled = isSuggestionEnabled(item, previous);
				const nextEnabled = !currentlyEnabled;

				if (nextEnabled && item.kind === "null") {
					setSuggestionGainOverrides((gainPrevious) => ({
						...gainPrevious,
						[key]: gainPrevious[key] ?? defaultBoostGainForDip(item.deviation),
					}));
				}

				return { ...previous, [key]: nextEnabled };
			});
		},
		[mergedSuggestions],
	);

	const addCustomBand = useCallback(
		(frequency: number): boolean => {
			if (!curve.length) return false;
			if (isBandTooClose(frequency, mergedSuggestions)) return false;

			const nextBand = createCustomSuggestion(frequency, curve, targetCurve);
			setCustomSuggestions((previous) =>
				[...previous, nextBand].sort((a, b) => a.frequency - b.frequency),
			);
			return true;
		},
		[curve, mergedSuggestions, targetCurve],
	);

	const clearSuggestionOverrides = useCallback((key: string) => {
		setSuggestionQOverrides((previous) => {
			const next = { ...previous };
			delete next[key];
			return next;
		});
		setSuggestionGainOverrides((previous) => {
			const next = { ...previous };
			delete next[key];
			return next;
		});
		setSuggestionEnabledOverrides((previous) => {
			const next = { ...previous };
			delete next[key];
			return next;
		});
	}, []);

	const removeBand = useCallback(
		(key: string) => {
			if (key.startsWith("custom:")) {
				setCustomSuggestions((previous) =>
					previous.filter((item) => suggestionKey(item) !== key),
				);
			} else {
				setRemovedSuggestionKeys((previous) => ({ ...previous, [key]: true }));
			}
			clearSuggestionOverrides(key);
		},
		[clearSuggestionOverrides],
	);

	const resetSuggestionQ = useCallback(() => {
		setSuggestionQOverrides({});
		setSuggestionGainOverrides({});
		setSuggestionEnabledOverrides({});
	}, []);

	const correctedCurve = useMemo(() => {
		if (!curve.length) return [];
		// V3 predicted = measured + RBJ filter response (no preamp, no display clamp).
		if (eqAlgorithmVersion === "v3") {
			return buildCorrectedCurve(curve, suggestions, 0, {
				responseModel: "rbj",
				sampleRate: measurementMeta?.sampleRate ?? 48_000,
				clampDisplay: false,
			});
		}
		return buildCorrectedCurve(curve, suggestions, presetPreamp);
	}, [
		curve,
		suggestions,
		presetPreamp,
		eqAlgorithmVersion,
		measurementMeta?.sampleRate,
	]);

	const eqApplyProfile = useMemo(
		() => ({ suggestions, preampDb: presetPreamp }),
		[suggestions, presetPreamp],
	);

	const canApplyVerificationEq = useMemo(
		() => hasEqToApply(eqApplyProfile),
		[eqApplyProfile],
	);

	const verifyEnabled =
		curve.length > 0 &&
		canApplyVerificationEq &&
		!running &&
		!verificationRunning &&
		!sessionOpen &&
		!meterActive &&
		env.ready &&
		safetyCheck;

	const clearVerification = useCallback(() => {
		setVerificationCurve(null);
		setVerificationMeta(null);
	}, []);

	const chartSeries = useMemo(() => {
		const base = buildChartSeries(measurementRuns, averagedRun);
		const overlays: ChartSeries[] = [];

		if (targetCurve.length) {
			overlays.push({
				id: "target",
				label: targetSeriesLabel,
				curve: targetCurve,
				color: "#f0f2f5",
				lineWidth: 1.6,
				alpha: 0.95,
				dash: [7, 6],
			});
		}

		if (correctedCurve.length) {
			overlays.push({
				id: "corrected",
				label: "After EQ (predicted)",
				curve: correctedCurve,
				color: "#ff9f6b",
				lineWidth: 2.4,
				alpha: 1,
			});
		}

		if (verificationCurve?.length) {
			overlays.push({
				id: "verified",
				label: "Verified (measured with EQ)",
				curve: verificationCurve,
				color: "#55d68b",
				lineWidth: 2.6,
				alpha: 1,
			});
		}

		return [...base, ...overlays];
	}, [
		measurementRuns,
		averagedRun,
		targetCurve,
		correctedCurve,
		verificationCurve,
		FLAT_TARGET_LABEL,
		targetSeriesLabel,
	]);

	const isChartSeriesVisible = useCallback(
		(id: string) => chartSeriesHidden[id] !== true,
		[chartSeriesHidden],
	);

	const visibleChartSeries = useMemo(
		() =>
			chartSeries.filter(
				(series) =>
					series.id === "target" || chartSeriesHidden[series.id] !== true,
			),
		[chartSeries, chartSeriesHidden],
	);

	const showCorrectionFills = chartSeriesHidden.correctionFills !== true;

	const toggleCorrectionFills = useCallback(() => {
		setChartSeriesHidden((previous) => ({
			...previous,
			correctionFills: previous.correctionFills !== true,
		}));
	}, []);

	const toggleChartSeriesVisibility = useCallback((id: string) => {
		if (id === "target") return;
		setChartSeriesHidden((previous) => ({
			...previous,
			[id]: previous[id] !== true,
		}));
	}, []);

	useEffect(() => {
		if (activeSavedPresetId) return;

		const dateSource = measurementMeta?.date ?? new Date().toISOString();
		const smoothSource = measurementMeta?.smoothing ?? smoothing;
		const active = savedMeasurements.find(
			(item) => item.id === activeSavedMeasurementId,
		);
		const prefix =
			active?.prefix ||
			(active ? extractMeasurementPrefix(active.name) : "") ||
			undefined;
		const measurementNumber = active?.measurementNumber ?? null;

		setPresetName(
			buildDynamicPresetName({
				algorithmVersion: eqAlgorithmVersion,
				smoothing: smoothSource,
				date: dateSource,
				prefix,
				measurementNumber,
			}),
		);
	}, [
		eqAlgorithmVersion,
		smoothing,
		measurementMeta?.date,
		measurementMeta?.smoothing,
		activeSavedMeasurementId,
		activeSavedPresetId,
		savedMeasurements,
	]);

	const presetText = useMemo(
		() => buildPresetText(presetName, presetPreamp, suggestions),
		[presetName, presetPreamp, suggestions],
	);

	const selectedInputLabel =
		inputs.find((d) => d.deviceId === inputDeviceId)?.label ||
		(inputDeviceId ? "Selected input" : "Default input");
	const uadRoutingHint = uadInputRoutingHint(selectedInputLabel);
	const inputChannelOptions = Math.max(1, inputChannelCount);

	const selectInputDevice = useCallback((deviceId: string) => {
		setInputDeviceId(deviceId);
		setInputChannelIndex(0);
		setInputChannelCount(1);
	}, []);

	const rememberCapturedChannelCount = useCallback((channelCount: number) => {
		if (!Number.isFinite(channelCount) || channelCount < 1) return;
		setInputChannelCount(channelCount);
		setInputChannelIndex((index) =>
			clampInputChannelIndex(index, channelCount),
		);
	}, []);

	const getDeviceLabels = useCallback(() => {
		const baseInputLabel =
			inputs.find((d) => d.deviceId === inputDeviceId)?.label ||
			"Default input";
		const inputLabel =
			inputChannelOptions > 1
				? `${baseInputLabel} · ch ${inputChannelIndex + 1}`
				: baseInputLabel;
		const outputLabel =
			outputs.find((d) => d.deviceId === outputDeviceId)?.label ||
			selectedOutputDevice?.label ||
			"Default output";
		return { inputLabel, outputLabel };
	}, [
		inputs,
		outputs,
		inputDeviceId,
		outputDeviceId,
		selectedOutputDevice,
		inputChannelIndex,
		inputChannelOptions,
	]);

	const executeMeasurement = useCallback(
		async (
			onStatus: (text: string, progress: number) => void,
			onAudioFrame?: (frame: MeasurementAudioFrame) => void,
			abortSignal?: AbortSignal,
		) => {
			const { inputLabel, outputLabel } = getDeviceLabels();
			const result = await runMeasurement({
				inputDeviceId,
				outputDeviceId,
				channel,
				fMin: fStart,
				fMax: fEnd,
				durationSeconds: duration,
				smoothing,
				levelDb: SWEEP_LEVEL_DB,
				calibration,
				inputLabel,
				outputLabel,
				onStatus,
				onAudioFrame,
				abortSignal,
				inputChannelIndex,
			});
			rememberCapturedChannelCount(
				result.measurementMeta.inputChannelCount ??
					result.measurementMeta.trackSettings.channelCount ??
					0,
			);
			return result;
		},
		[
			getDeviceLabels,
			inputDeviceId,
			outputDeviceId,
			channel,
			fStart,
			fEnd,
			duration,
			smoothing,
			calibration,
			inputChannelIndex,
			rememberCapturedChannelCount,
		],
	);

	const applySessionResults = useCallback(
		(runs: MeasurementRun[]) => {
			if (!runs.length) return;

			const averagedCurve = sanitizeCurve(
				averageCurves(runs.map((run) => run.curve)),
			);
			const baseMeta = runs[runs.length - 1].meta;

			const average: MeasurementRun = {
				index: 0,
				label: runs.length > 1 ? "Average" : runs[0].label,
				curve: averagedCurve,
				suggestions: [],
				meta: {
					...baseMeta,
					date: new Date().toISOString(),
				},
			};

			setMeasurementRuns(runs);
			setAveragedRun(runs.length > 1 ? average : null);
			setCurve(averagedCurve);
			setCustomSuggestions([]);
			setRemovedSuggestionKeys({});
			clearVerification();
			setMeasurementMeta(baseMeta);
			setActiveSavedMeasurementId(null);
			setActiveSavedPresetId(null);
			setPresetStatus("");
			setStatus(
				baseMeta.recorderMode === "mock"
					? runs.length > 1
						? `Mock session loaded — averaged ${runs.length} runs`
						: "Mock measurement loaded"
					: runs.length > 1
						? `Session complete — averaged ${runs.length} measurements`
						: "Measurement complete",
				100,
			);
		},
		[setStatus, clearVerification],
	);

	const persistSavedMeasurements = useCallback(
		(updater: (prev: SavedMeasurement[]) => SavedMeasurement[]) => {
			setSavedMeasurements((prev) => {
				const next = updater(prev);
				try {
					writeSavedMeasurements(next);
				} catch {
					queueMicrotask(() => {
						setStatus(
							"Could not persist measurements to local storage.",
							100,
						);
					});
				}
				return next;
			});
		},
		[setStatus],
	);

	const saveMeasurementFromRuns = useCallback(
		(
			runs: MeasurementRun[],
			options?: { name?: string; prefix?: string },
		): SavedMeasurement | null => {
			if (!runs.length) return null;

			const averagedCurve = sanitizeCurve(
				averageCurves(runs.map((run) => run.curve)),
			);
			const baseMeta = runs[runs.length - 1].meta;
			const average: MeasurementRun | null =
				runs.length > 1
					? {
							index: 0,
							label: "Average",
							curve: averagedCurve,
							suggestions: [],
							meta: {
								...baseMeta,
								date: new Date().toISOString(),
							},
						}
					: null;

			const savedHolder: { current: SavedMeasurement | null } = {
				current: null,
			};
			persistSavedMeasurements((prev) => {
				savedHolder.current = createSavedMeasurement({
					meta: baseMeta,
					curve: averagedCurve,
					runs,
					average,
					name: options?.name,
					prefix: options?.prefix,
					measurementNumber: nextMeasurementNumber(prev),
				});
				return prependSavedMeasurement(prev, savedHolder.current);
			});
			if (savedHolder.current) {
				setActiveSavedMeasurementId(savedHolder.current.id);
			}
			return savedHolder.current;
		},
		[persistSavedMeasurements],
	);

	const saveCurrentMeasurement = useCallback(() => {
		if (!measurementRuns.length || !curve.length || !measurementMeta) {
			setStatus("Nothing to save — run a measurement first.", 100);
			return;
		}

		const savedHolder: { current: SavedMeasurement | null } = {
			current: null,
		};
		persistSavedMeasurements((prev) => {
			savedHolder.current = createSavedMeasurement({
				meta: measurementMeta,
				curve,
				runs: measurementRuns,
				average: averagedRun,
				measurementNumber: nextMeasurementNumber(prev),
			});
			return prependSavedMeasurement(prev, savedHolder.current);
		});
		if (savedHolder.current) {
			setActiveSavedMeasurementId(savedHolder.current.id);
			setStatus(`Saved: ${savedHolder.current.name}`, 100);
		}
	}, [
		averagedRun,
		curve,
		measurementMeta,
		measurementRuns,
		persistSavedMeasurements,
		setStatus,
	]);

	const loadSavedMeasurement = useCallback(
		(id: string) => {
			const saved = savedMeasurements.find((item) => item.id === id);
			if (!saved || !saved.runs.length) return;

			const runs = saved.runs;
			const averagedCurve = sanitizeCurve(
				saved.curve.length
					? saved.curve
					: averageCurves(runs.map((run) => run.curve)),
			);
			const baseMeta = saved.meta ?? runs[runs.length - 1].meta;

			setMeasurementRuns(runs);
			setAveragedRun(
				saved.average ??
					(runs.length > 1
						? {
								index: 0,
								label: "Average",
								curve: averagedCurve,
								suggestions: [],
								meta: baseMeta,
							}
						: null),
			);
			setCurve(averagedCurve);
			setCustomSuggestions([]);
			setRemovedSuggestionKeys({});
			clearVerification();
			setMeasurementMeta(baseMeta);
			setActiveSavedMeasurementId(saved.id);
			setPresetStatus("");
			setStatus(`Loaded: ${saved.name}`, 100);
		},
		[clearVerification, savedMeasurements, setStatus],
	);

	const deleteSavedMeasurement = useCallback(
		(id: string) => {
			persistSavedMeasurements((prev) => removeSavedMeasurement(prev, id));
			if (activeSavedMeasurementId === id) {
				setActiveSavedMeasurementId(null);
			}
			setStatus("Measurement removed from library.", 100);
		},
		[
			activeSavedMeasurementId,
			persistSavedMeasurements,
			setStatus,
		],
	);

	const deleteSavedMeasurements = useCallback(
		(ids: string[]) => {
			const uniqueIds = [...new Set(ids.filter(Boolean))];
			if (!uniqueIds.length) return;

			const idSet = new Set(uniqueIds);
			persistSavedMeasurements((prev) =>
				prev.filter((item) => !idSet.has(item.id)),
			);
			if (
				activeSavedMeasurementId &&
				idSet.has(activeSavedMeasurementId)
			) {
				setActiveSavedMeasurementId(null);
			}
			setStatus(
				uniqueIds.length === 1
					? "Measurement removed from library."
					: `Removed ${uniqueIds.length} measurements from library.`,
				100,
			);
		},
		[activeSavedMeasurementId, persistSavedMeasurements, setStatus],
	);

	const persistSavedPresets = useCallback(
		(updater: (prev: SavedPreset[]) => SavedPreset[]) => {
			setSavedPresets((prev) => {
				const next = updater(prev);
				try {
					writeSavedPresets(next);
				} catch {
					queueMicrotask(() => {
						setStatus("Could not persist presets to local storage.", 100);
					});
				}
				return next;
			});
		},
		[setStatus],
	);

	const savePreset = useCallback(
		(name: string) => {
			if (!curve.length) {
				setStatus("Nothing to save — run a measurement first.", 100);
				return;
			}

			const saved = createSavedPreset({
				name,
				preamp: presetPreamp,
				suggestions,
				eqAlgorithmVersion,
			});

			persistSavedPresets((prev) => prependSavedPreset(prev, saved));
			setActiveSavedPresetId(saved.id);
			setPresetName(saved.name);
			setPresetStatus(`Preset saved: ${saved.name}`);
			setStatus(`Saved preset: ${saved.name}`, 100);
		},
		[
			curve.length,
			eqAlgorithmVersion,
			persistSavedPresets,
			presetPreamp,
			setStatus,
			suggestions,
		],
	);

	const loadSavedPreset = useCallback(
		(id: string) => {
			const saved = savedPresets.find((item) => item.id === id);
			if (!saved) return;

			const asCustom: Suggestion[] = saved.suggestions.map((item, index) => ({
				...item,
				source: "custom",
				customId: item.customId ?? `preset-${saved.id}-${index}`,
			}));

			const removed: Record<string, true> = {};
			for (const item of computedSuggestions) {
				removed[suggestionKey(item)] = true;
			}

			setPresetName(saved.name);
			setPresetPreamp(saved.preamp);
			setCustomSuggestions(asCustom);
			setSuggestionQOverrides({});
			setSuggestionGainOverrides({});
			setSuggestionEnabledOverrides({});
			setRemovedSuggestionKeys(removed);
			setActiveSavedPresetId(saved.id);
			setSosOverlayEnabled(false);
			setPresetStatus(`Loaded preset: ${saved.name}`);
			setStatus(`Loaded preset: ${saved.name}`, 100);
		},
		[computedSuggestions, savedPresets, setStatus],
	);

	const deleteSavedPreset = useCallback(
		(id: string) => {
			persistSavedPresets((prev) => removeSavedPreset(prev, id));
			if (activeSavedPresetId === id) {
				setActiveSavedPresetId(null);
			}
			setStatus("Preset removed from library.", 100);
		},
		[activeSavedPresetId, persistSavedPresets, setStatus],
	);

	const deleteSavedPresets = useCallback(
		(ids: string[]) => {
			const uniqueIds = [...new Set(ids.filter(Boolean))];
			if (!uniqueIds.length) return;

			const idSet = new Set(uniqueIds);
			persistSavedPresets((prev) =>
				prev.filter((item) => !idSet.has(item.id)),
			);
			if (activeSavedPresetId && idSet.has(activeSavedPresetId)) {
				setActiveSavedPresetId(null);
			}
			setStatus(
				uniqueIds.length === 1
					? "Preset removed from library."
					: `Removed ${uniqueIds.length} presets from library.`,
				100,
			);
		},
		[activeSavedPresetId, persistSavedPresets, setStatus],
	);

	const buildMockPreset = useCallback(
		(presetId: number, seedSalt: number): MockPreset => {
			const { inputLabel, outputLabel } = getDeviceLabels();
			const runs: MeasurementRun[] = [];

			for (let runIndex = 1; runIndex <= measurementCount; runIndex += 1) {
				const { curve: mockCurve, measurementMeta } = createMockMeasurementRun({
					fMin: fStart,
					fMax: fEnd,
					smoothing,
					durationSeconds: duration,
					levelDb: SWEEP_LEVEL_DB,
					channel,
					runIndex,
					presetId,
					seedSalt: seedSalt + presetId * 47 + runIndex * 3,
					inputLabel,
					outputLabel,
				});

				runs.push({
					index: runIndex,
					label:
						measurementCount > 1
							? `Mock ${presetId} · run ${runIndex}`
							: `Mock ${presetId}`,
					curve: mockCurve,
					suggestions: [],
					meta: measurementMeta,
				});
			}

			return {
				id: presetId,
				label: getMockPresetLabel(presetId),
				runs,
			};
		},
		[
			channel,
			duration,
			fEnd,
			fStart,
			getDeviceLabels,
			measurementCount,
			smoothing,
		],
	);

	const generateMockMeasurement = useCallback(
		(options: { name: string; presetId: number; prefix?: string }) => {
			const presetId = Math.min(
				Math.max(1, Math.round(options.presetId)),
				MOCK_PRESET_COUNT,
			);
			const seedSalt = Date.now() % 100_000;
			const preset = buildMockPreset(presetId, seedSalt);
			const customName = options.name.replace(/[\r\n]+/g, " ").trim();
			const prefix =
				options.prefix?.trim() ||
				extractMeasurementPrefix(customName) ||
				undefined;

			applySessionResults(preset.runs);
			const saved = saveMeasurementFromRuns(preset.runs, {
				name: customName || undefined,
				prefix,
			});

			if (saved) {
				setStatus(`Saved mock: ${saved.name}`, 100);
			}
			return saved;
		},
		[
			applySessionResults,
			buildMockPreset,
			saveMeasurementFromRuns,
			setStatus,
		],
	);

	const stopSessionMeter = useCallback(async () => {
		await sessionMeterRef.current?.stop();
		sessionMeterRef.current = null;
		setSessionMeterActive(false);
		setSessionMeterDb(-Infinity);
	}, []);

	const handleRequestPermission = async () => {
		setStatus("Waiting for microphone permission…", 0);
		try {
			await requestMicrophonePermission();
			setMediaPermissionGranted(true);
			await refreshDevices(true);
			setStatus("Device list unlocked", 0);
		} catch (error) {
			const err = error as Error & { name?: string };
			const message =
				err.name === "NotAllowedError"
					? "Microphone access was blocked. Allow the microphone for localhost in Chrome and macOS settings."
					: err.message || "Could not get access.";
			setStatus(message, 0);
			setDeviceStatus({ message, type: "bad" });
			throw new Error(message);
		}
	};

	const handleChooseOutput = async () => {
		const selected = await chooseOutputDevice(outputDeviceId || undefined);
		setSelectedOutputDevice(selected);
		setOutputDeviceId(selected.deviceId);
		await refreshDevices();
		setDeviceStatus({
			message: `Selected output: ${selected.label || "audio device"}.`,
			type: "good",
		});
		setStatus("Audio output selected", 0);
	};

	const handleRefreshDevices = async () => {
		await refreshDevices();
		setStatus("Device list refreshed", 0);
	};

	const handleCalibrationFile = async (file: File | null) => {
		if (!file) {
			setCalibration([]);
			setCalibrationStatus(
				"Format: frequency and dB correction in two columns. The correction is added to the result.",
			);
			return;
		}

		try {
			const text = await file.text();
			const points = parseCalibration(text);
			if (points.length < 2) {
				throw new Error("Could not find at least two valid points.");
			}

			setCalibration(points);
			setCalibrationStatus(
				`Loaded ${points.length} points: ${formatFrequency(points[0][0])}–${formatFrequency(points[points.length - 1][0])}.`,
			);
		} catch (error) {
			setCalibration([]);
			const message = error instanceof Error ? error.message : String(error);
			setCalibrationStatus(`File error: ${message}`);
		}
	};

	const handleStartMeter = async (options?: { playStimulus?: boolean }) => {
		const playStimulus = options?.playStimulus !== false;
		await levelTestRef.current?.stop();
		setStatus(
			playStimulus ? "Starting level check…" : "Starting input monitor…",
			0,
		);
		const session = await startLevelTest(
			inputDeviceId,
			outputDeviceId,
			setMeterDb,
			{
				levelDb: SWEEP_LEVEL_DB,
				channel,
				inputChannelIndex,
				playStimulus,
			},
		);
		rememberCapturedChannelCount(session.channelCount);
		levelTestRef.current = session;
		setMeterActive(true);
		setStatus(
			playStimulus
				? `Pink noise is playing at sweep level — adjust output volume and mic gain. Aim for the green zone (${meterOptimalRangeLabel()}).`
				: "Input monitor is live — no playback. Tap the microphone; the meter should move. If speakers move it instead, the capture is likely loopback.",
			0,
		);
	};

	const handleStopMeter = async () => {
		await levelTestRef.current?.stop();
		levelTestRef.current = null;
		setMeterActive(false);
		setMeterDb(-Infinity);
		setStatus("Input test stopped", 0);
	};

	const handleStartSession = async () => {
		if (running || sessionOpen) return;
		await handleStopMeter();
		await stopSessionMeter();
		clearVerification();

		setSessionOpen(true);
		setSessionStep("mic-test");
		setSessionTargetCount(measurementCount);
		setSessionRuns([]);
		setSessionMeterDb(-Infinity);
		setSessionWarning(null);
		setStatus("Measurement session started", 0);
	};

	const handleSessionSkipMicTest = () => {
		void stopSessionMeter();
		setSessionWarning(null);
		setSessionStep("ready");
	};

	const handleSessionDismissWarning = () => {
		setSessionWarning(null);
	};

	const handleSessionStartMeter = async (options?: {
		playStimulus?: boolean;
	}) => {
		const playStimulus = options?.playStimulus === true;
		setSessionWarning(null);
		try {
			await sessionMeterRef.current?.stop();
			const session = await startLevelTest(
				inputDeviceId,
				outputDeviceId,
				setSessionMeterDb,
				{
					levelDb: SWEEP_LEVEL_DB,
					channel,
					inputChannelIndex,
					playStimulus,
				},
			);
			rememberCapturedChannelCount(session.channelCount);
			sessionMeterRef.current = session;
			setSessionMeterActive(true);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			setSessionWarning(message);
			throw error;
		}
	};

	const handleSessionStopMeter = async () => {
		await stopSessionMeter();
	};

	const getSessionAudioFrame = useCallback(
		() => sessionAudioFrameRef.current,
		[],
	);

	const handleSessionRunMeasurement = async (replaceRunIndex?: number) => {
		if (running) return;
		await stopSessionMeter();
		setSessionWarning(null);
		sessionAudioFrameRef.current = null;
		sessionMeasurementAbortRef.current?.abort();
		sessionMeasurementAbortRef.current = new AbortController();
		const abortSignal = sessionMeasurementAbortRef.current.signal;
		const replacingRunIndex =
			replaceRunIndex !== undefined && replaceRunIndex > 0
				? replaceRunIndex
				: null;
		const runIndex = replacingRunIndex ?? sessionRuns.length + 1;
		setSessionMeasuringRunIndex(runIndex);
		setRunning(true);
		setSessionStep("measuring");

		const onAudioFrame = (frame: MeasurementAudioFrame) => {
			sessionAudioFrameRef.current = frame;
		};

		const restoreStepAfterFailure = () => {
			if (replacingRunIndex && sessionRuns.length > 0) {
				setSessionStep("run-complete");
				return;
			}
			setSessionStep("ready");
		};

		try {
			const result = await executeMeasurement(
				setStatus,
				onAudioFrame,
				abortSignal,
			);
			const run: MeasurementRun = {
				index: runIndex,
				label: `Run ${runIndex}`,
				curve: result.curve,
				suggestions: result.suggestions,
				meta: result.measurementMeta,
			};

			if (replacingRunIndex) {
				setSessionRuns((previous) => {
					const next = [...previous];
					next[replacingRunIndex - 1] = run;
					return next;
				});
			} else {
				setSessionRuns((previous) => [...previous, run]);
			}
			setSessionStep("run-complete");
			if (result.measurementMeta.loopbackWarning) {
				setSessionWarning(result.measurementMeta.loopbackWarning);
			}
			setStatus(
				replacingRunIndex
					? `Measurement ${runIndex} replaced`
					: `Measurement ${runIndex} complete`,
				100,
			);
		} catch (error) {
			if (isMeasurementAbortError(error)) {
				setStatus("Measurement stopped", 0);
				setSessionWarning(MEASUREMENT_ABORT_MESSAGE);
				restoreStepAfterFailure();
				return;
			}
			const message = error instanceof Error ? error.message : String(error);
			setStatus(message, 0);
			setSessionWarning(message);
			restoreStepAfterFailure();
		} finally {
			sessionMeasurementAbortRef.current = null;
			sessionAudioFrameRef.current = null;
			setSessionMeasuringRunIndex(null);
			setRunning(false);
		}
	};

	const handleSessionRedoMeasurement = (runIndex: number) => {
		void handleSessionRunMeasurement(runIndex);
	};

	const handleSessionStopMeasurement = () => {
		sessionMeasurementAbortRef.current?.abort();
	};

	const handleSessionContinue = () => {
		setSessionWarning(null);
		setSessionStep("ready");
		setStatus(`Ready for measurement ${sessionRuns.length + 1}`, 0);
	};

	const handleSessionFinish = async (
		options?: string | { name?: string; prefix?: string },
	) => {
		if (!sessionRuns.length) return;
		const normalized =
			typeof options === "string"
				? { name: options }
				: (options ?? {});
		await stopSessionMeter();
		applySessionResults(sessionRuns);
		const saved = saveMeasurementFromRuns(sessionRuns, {
			name: normalized.name?.trim() || undefined,
			prefix: normalized.prefix?.trim() || undefined,
		});
		setSessionOpen(false);
		setSessionStep("mic-test");
		setSessionRuns([]);
		setSessionWarning(null);
		if (saved) {
			setStatus(`Saved: ${saved.name}`, 100);
		}
	};

	const handleSessionCancel = async () => {
		if (running) return;

		if (
			sessionRuns.length > 0 &&
			!window.confirm(
				"Close the session without saving completed measurements?",
			)
		) {
			return;
		}

		await stopSessionMeter();
		setSessionOpen(false);
		setSessionStep("mic-test");
		setSessionRuns([]);
		setSessionWarning(null);
		setStatus("Ready", 0);
	};

	const activeFilterCount = useMemo(
		() => getActiveEqFilters(suggestions).length,
		[suggestions],
	);

	const runVerificationMeasurement = useCallback(async () => {
		if (!curve.length || !canApplyVerificationEq || verificationRunning) return;

		await handleStopMeter();
		setVerificationRunning(true);
		setStatus("Starting verification measurement…", 5);

		try {
			const { inputLabel, outputLabel } = getDeviceLabels();
			const eqApply = eqApplyProfile;

			const result = await runMeasurement({
				inputDeviceId,
				outputDeviceId,
				channel,
				fMin: fStart,
				fMax: fEnd,
				durationSeconds: duration,
				smoothing,
				levelDb: SWEEP_LEVEL_DB,
				calibration,
				inputLabel,
				outputLabel,
				onStatus: setStatus,
				eqApply,
				inputChannelIndex,
			});
			setVerificationCurve(result.curve);
			setVerificationMeta(result.measurementMeta);

			setStatus(
				"Verification complete — compare green Verified vs orange predicted",
				100,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			setStatus(message, 0);
			alert(message);
		} finally {
			setVerificationRunning(false);
		}
	}, [
		curve,
		canApplyVerificationEq,
		verificationRunning,
		getDeviceLabels,
		eqApplyProfile,
		fStart,
		fEnd,
		smoothing,
		duration,
		channel,
		inputDeviceId,
		outputDeviceId,
		calibration,
		setStatus,
		handleStopMeter,
		inputChannelIndex,
	]);

	const exportCsv = () => {
		if (!curve.length) return;
		const rows = [
			["frequency_hz", "relative_db"],
			...curve.map((point) => [
				point.frequency.toFixed(3),
				point.db.toFixed(4),
			]),
		];
		downloadText(
			"room-eq-measurement.csv",
			rows.map((row) => row.join(";")).join("\n"),
			"text/csv;charset=utf-8",
		);
	};

	const exportJson = () => {
		if (!curve.length) return;
		downloadText(
			"room-eq-measurement.json",
			JSON.stringify(
				{
					meta: measurementMeta,
					curve,
					suggestions,
					eqMode: "pro-thick-flat",
					runs: measurementRuns,
					average: averagedRun,
				},
				null,
				2,
			),
			"application/json",
		);
	};

	const copyPreset = async () => {
		const text = presetText;
		try {
			if (window.electronAPI?.copyText) {
				await window.electronAPI.copyText(text);
			} else if (navigator.clipboard?.writeText && window.isSecureContext) {
				await navigator.clipboard.writeText(text);
			} else {
				const area = document.createElement("textarea");
				area.value = text;
				area.setAttribute("readonly", "");
				area.style.position = "fixed";
				area.style.left = "-9999px";
				document.body.appendChild(area);
				area.select();
				const ok = document.execCommand("copy");
				document.body.removeChild(area);
				if (!ok) throw new Error("Clipboard unavailable");
			}
			setPresetStatus("Preset copied to clipboard.");
		} catch {
			setPresetStatus("Could not copy automatically — copy the text manually.");
		}
	};

	const exportPresetTxt = () => {
		downloadText(
			safePresetFilename(presetName),
			presetText,
			"text/plain;charset=utf-8",
		);
		setPresetStatus("TXT file generated.");
	};

	const applyMeasurementPreset = useCallback((id: MeasurementPresetId) => {
		const preset = MEASUREMENT_PRESETS.find((item) => item.id === id);
		if (!preset) return;

		setActiveMeasurementPresetId(id);
		setChannel(preset.channel);
		setFStart(preset.fStart);
		setFEnd(preset.fEnd);
		setDuration(preset.duration);
		setSmoothing(preset.smoothing);
	}, []);

	return {
		env,
		environmentBadge,
		sinkHelp,
		deviceStatus,
		inputs,
		outputs,
		inputDeviceId,
		setInputDeviceId: selectInputDevice,
		inputChannelIndex,
		setInputChannelIndex,
		inputChannelOptions,
		uadRoutingHint,
		outputDeviceId,
		setOutputDeviceId,
		channel,
		setChannel,
		fStart,
		setFStart,
		fEnd,
		setFEnd,
		duration,
		setDuration,
		smoothing,
		setSmoothing,
		measurementCount,
		setMeasurementCount,
		safetyCheck,
		setSafetyCheck,
		activeMeasurementPresetId,
		applyMeasurementPreset,
		measurementPresets: MEASUREMENT_PRESETS,
		calibrationStatus,
		statusText,
		progress,
		running,
		meterActive,
		meterDb,
		measureEnabled,
		generateMockMeasurement,
		isMockMeasurement: measurementMeta?.recorderMode === "mock",
		curve,
		suggestions,
		eqAlgorithmVersion,
		setEqAlgorithmVersion,
		autoEqV2Progress,
		recalculateV2AutoEq,
		autoEqV2IsRunning,
		autoEqV2LastPrecision,
		autoEqV3Progress,
		autoEqV3Result,
		recalculateV3AutoEq,
		autoEqV3IsRunning,
		targetSeriesLabel,
		globalBandQ,
		setSuggestionQ,
		setSuggestionGain,
		toggleSuggestionEnabled,
		addCustomBand,
		removeBand,
		setAllSuggestionQ,
		scaleAllSuggestionQ,
		resetSuggestionQ,
		eqShapePreset,
		applyEqShapePreset,
		sosOverlayEnabled,
		toggleSosOverlay,
		filterOverlays,
		targetCurve,
		measurementMeta,
		measurementRuns,
		averagedRun,
		savedMeasurements,
		activeSavedMeasurementId,
		saveCurrentMeasurement,
		loadSavedMeasurement,
		deleteSavedMeasurement,
		deleteSavedMeasurements,
		savedPresets,
		activeSavedPresetId,
		savePreset,
		loadSavedPreset,
		deleteSavedPreset,
		deleteSavedPresets,
		chartSeries,
		visibleChartSeries,
		isChartSeriesVisible,
		toggleChartSeriesVisibility,
		showCorrectionFills,
		toggleCorrectionFills,
		verificationCurve,
		verificationMeta,
		verificationRunning,
		canApplyVerificationEq,
		verifyEnabled,
		activeFilterCount,
		runVerificationMeasurement,
		clearVerification,
		sessionOpen,
		sessionStep,
		sessionTargetCount,
		sessionRuns,
		sessionMeasuringRunIndex,
		sessionMeterActive,
		sessionMeterDb,
		sessionWarning,
		getSessionAudioFrame,
		presetName,
		setPresetName,
		presetPreamp,
		setPresetPreamp,
		presetText,
		presetStatus,
		handleRequestPermission,
		handleChooseOutput,
		handleRefreshDevices,
		handleCalibrationFile,
		handleStartMeter,
		handleStopMeter,
		handleStartSession,
		handleSessionSkipMicTest,
		handleSessionStartMeter,
		handleSessionStopMeter,
		handleSessionRunMeasurement,
		handleSessionRedoMeasurement,
		handleSessionStopMeasurement,
		handleSessionContinue,
		handleSessionFinish,
		handleSessionCancel,
		handleSessionDismissWarning,
		exportCsv,
		exportJson,
		copyPreset,
		exportPresetTxt,
	};
}

export type RoomEqState = ReturnType<typeof useRoomEq>;
