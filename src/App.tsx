import {
	Box,
	Container,
	Heading,
	Stack,
} from "@chakra-ui/react";
import { useRoomEq } from "./hooks/useRoomEq";
import { ConfigPanel } from "./components/ConfigPanel";
import { ChartPanel } from "./components/ChartPanel";
import { ResultsPanel } from "./components/ResultsPanel";
import { MeasurementSessionModal } from "./components/MeasurementSessionModal";

function App() {
	const state = useRoomEq();

	return (
		<Box minH="100vh" py={{ base: 5, md: 8 }} px={{ base: 3, md: 4 }}>
			<Container maxW="1240px" px={0}>
				<Stack gap={6} w="full">
					<Heading
						size={{ base: "2xl", md: "4xl" }}
						letterSpacing="-0.03em"
						lineHeight="1.05"
						color="gray.100"
					>
						Room EQ Measure
					</Heading>

					<Stack gap={5} w="full">
						<ConfigPanel state={state} />
						<ChartPanel state={state} />
						<ResultsPanel state={state} />
					</Stack>

					<MeasurementSessionModal state={state} />
				</Stack>
			</Container>
		</Box>
	);
}

export default App;
