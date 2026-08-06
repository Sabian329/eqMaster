import { Button, Flex, Text } from "@chakra-ui/react";
import { buttonStyles, ui } from "../../theme";

interface ChartRecalculateBarProps {
	versionLabel: string;
	statusLabel: string;
	isRunning: boolean;
	onRecalculate: () => void;
}

/** Shared V2/V3 action row: status immediately left of Recalculate. */
export function ChartRecalculateBar({
	versionLabel,
	statusLabel,
	isRunning,
	onRecalculate,
}: ChartRecalculateBarProps) {
	return (
		<Flex
			justify="flex-end"
			align="center"
			gap={3}
			px={3}
			py={2}
			borderTopWidth="1px"
			borderColor={ui.colors.border}
			bg={ui.colors.chart}
		>
			<Text
				fontSize="2xs"
				color={isRunning ? ui.colors.accent : ui.colors.textDim}
				fontFamily={ui.fonts.mono}
				textAlign="right"
				minW="12rem"
			>
				{versionLabel} · {statusLabel}
			</Text>
			<Button
				size="sm"
				h="30px"
				borderRadius="2px"
				{...buttonStyles.primary}
				disabled={isRunning}
				onClick={onRecalculate}
			>
				Recalculate
			</Button>
		</Flex>
	);
}

export function formatAutoEqProgressLabel(
	progress: { stage: string; progress: number } | null | undefined,
	idleLabel = "Standard",
): string {
	if (!progress) return idleLabel;
	const stage = progress.stage.replace(/-/g, " ");
	return `${stage}… ${Math.round(progress.progress * 100)}%`;
}
