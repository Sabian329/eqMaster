import { Box, Flex } from "@chakra-ui/react";
import { suggestionKey } from "../../utils/suggestionQ";
import { EqBandStrip } from "./EqBandStrip";
import type { EqBandBoardProps } from "./types";

export function EqBandBoard({
	suggestions,
	setSuggestionQ,
	setSuggestionGain,
	toggleSuggestionEnabled,
	removeBand,
	embedded = false,
}: EqBandBoardProps) {
	if (!suggestions.length) {
		return (
			<Box p={6} color="gray.500" fontSize="sm" lineHeight="1.65">
				No EQ bands. Click anywhere on the frequency chart above to add a band.
			</Box>
		);
	}

	return (
		<Box
			overflowX="auto"
			overflowY="hidden"
			borderTopWidth="1px"
			borderBottomWidth="1px"
			borderColor="whiteAlpha.100"
			bg={embedded ? "rgba(8,10,16,.72)" : "rgba(8,10,16,.55)"}
			py={embedded ? 1.5 : 4}
			px={embedded ? { base: 2, md: 3 } : 3}
		>
			<Flex
				gap={embedded ? 1.5 : 2}
				minW="min-content"
				align="stretch"
				justify="center"
			>
				{suggestions.map((item, index) => (
					<EqBandStrip
						key={suggestionKey(item)}
						item={item}
						index={index}
						setSuggestionQ={setSuggestionQ}
						setSuggestionGain={setSuggestionGain}
						toggleSuggestionEnabled={toggleSuggestionEnabled}
						removeBand={removeBand}
						compact={embedded}
					/>
				))}
			</Flex>
		</Box>
	);
}
