import { Box, Container, Flex, Heading, Stack, Text } from '@chakra-ui/react';
import { useRoomEq } from './hooks/useRoomEq';
import { ConfigPanel } from './components/config-panel';
import { ChartPanel } from './components/chart-panel';
import { ResultsPanel } from './components/results-panel';
import { MeasurementSessionModal } from './components/measurement-session';
import { ui } from './theme';

function App() {
  const state = useRoomEq();

  return (
    <Box minH="100vh" py={{ base: 4, md: 6 }} px={{ base: 2, md: 3 }} bg={ui.colors.bg}>
      <Container maxW="1240px" px={0}>
        <Stack gap={4} w="full">
          <Flex
            align="flex-end"
            justify="space-between"
            gap={4}
            flexWrap="wrap"
            pb={1}
            borderBottomWidth="1px"
            borderColor={ui.colors.border}
          >
            <Stack gap={1}>
              <Text
                fontSize="2xs"
                fontWeight="700"
                letterSpacing="0.14em"
                textTransform="uppercase"
                color={ui.colors.accent}
                fontFamily={ui.fonts.mono}
              >
                Room acoustics
              </Text>
              <Heading
                size={{ base: 'xl', md: '2xl' }}
                letterSpacing="-0.02em"
                lineHeight="1"
                color={ui.colors.text}
                fontWeight="800"
              >
                Room EQ Measure
              </Heading>
            </Stack>
            <Text
              fontSize="2xs"
              color={ui.colors.textDim}
              fontFamily={ui.fonts.mono}
              letterSpacing="0.04em"
              pb={0.5}
            >
              v1.0 · PRO THICK AUTO EQ
            </Text>
          </Flex>

          <Stack gap={3} w="full">
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
