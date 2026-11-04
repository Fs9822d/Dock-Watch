import React from 'react';
import { Box, Text } from 'ink';

export function Header({ socketPath, isConnected, runningCount = 0, totalCount = 0 }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
      <Box justifyContent="space-between">
        <Box>
          <Text bold color="cyan">DOCK-WATCH </Text>
          <Text dimColor>| Automated Flight Recorder & Diagnostics</Text>
        </Box>
        <Box>
          {isConnected ? (
            <Text color="green">● CONNECTED</Text>
          ) : (
            <Text color="red">● DISCONNECTED</Text>
          )}
        </Box>
      </Box>
      <Box justifyContent="space-between" marginTop={0}>
        <Box>
          <Text dimColor>Socket: </Text>
          <Text color="white">{socketPath || 'Auto-detecting...'}</Text>
        </Box>
        <Box>
          <Text dimColor>Active: </Text>
          <Text bold color="green">{runningCount}</Text>
          <Text dimColor> / {totalCount} containers</Text>
        </Box>
      </Box>
    </Box>
  );
}
