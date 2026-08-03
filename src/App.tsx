import {
	Badge,
	Box,
	Container,
	Grid,
	Heading,
	Stack,
	Text,
} from "@chakra-ui/react";
import { badgeStyles } from "./theme";
import { useRoomEq } from "./hooks/useRoomEq";
import { ConfigPanel } from "./components/ConfigPanel";
import { ChartPanel } from "./components/ChartPanel";
import { ResultsPanel } from "./components/ResultsPanel";
//import { StatusAlert } from "./components/ui/StatusAlert";

function App() {
	const state = useRoomEq();
	//const isElectron = window.electronAPI?.isElectron === true;
	const envReady = state.environmentBadge.color === "var(--good)";

	return (
		<Box minH="100vh" py={{ base: 5, md: 8 }} px={{ base: 3, md: 4 }}>
			<Container maxW="1240px" px={0}>
				<Stack gap={6}>
					<Stack
						direction={{ base: "column", md: "row" }}
						justify="space-between"
						align={{ base: "flex-start", md: "center" }}
						gap={4}
					>
						<Box>
							<Heading
								size={{ base: "2xl", md: "4xl" }}
								letterSpacing="-0.03em"
								lineHeight="1.05"
								color="gray.100"
							>
								Room EQ Measure
							</Heading>
						</Box>
					</Stack>

					<Grid
						templateColumns={{
							base: "1fr",
							lg: "minmax(320px, 400px) minmax(0, 1fr)",
						}}
						gap={5}
						alignItems="start"
					>
						<ConfigPanel state={state} />
						<ChartPanel state={state} />
					</Grid>

					<ResultsPanel state={state} />
				</Stack>
			</Container>
		</Box>
	);
}

export default App;
