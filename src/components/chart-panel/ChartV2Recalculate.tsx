import type { RoomEqState } from "../../hooks/useRoomEq";
import {
	ChartRecalculateBar,
	formatAutoEqProgressLabel,
} from "./ChartRecalculateBar";

interface ChartV2RecalculateProps {
	state: Pick<
		RoomEqState,
		| "eqAlgorithmVersion"
		| "recalculateV2AutoEq"
		| "autoEqV2Progress"
		| "autoEqV2IsRunning"
		| "autoEqV2LastPrecision"
		| "curve"
	>;
}

export function ChartV2Recalculate({ state }: ChartV2RecalculateProps) {
	const {
		eqAlgorithmVersion,
		recalculateV2AutoEq,
		autoEqV2Progress,
		autoEqV2IsRunning,
		autoEqV2LastPrecision,
		curve,
	} = state;

	if (eqAlgorithmVersion !== "v2" || curve.length === 0) {
		return null;
	}

	const idleLabel =
		autoEqV2LastPrecision === "high" ? "High precision" : "Standard";

	return (
		<ChartRecalculateBar
			versionLabel="V2"
			statusLabel={formatAutoEqProgressLabel(autoEqV2Progress, idleLabel)}
			isRunning={autoEqV2IsRunning}
			onRecalculate={recalculateV2AutoEq}
		/>
	);
}

export function ChartV2RecalculateFromState({
	state,
}: {
	state: ChartV2RecalculateProps["state"];
}) {
	return <ChartV2Recalculate state={state} />;
}
