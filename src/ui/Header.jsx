import React from 'react';
import { Box, Text } from 'ink';

export function Header({
  socketPath,
  isConnected,
  runningCount = 0,
  totalCount = 0,
  columns = process.stdout.columns || 120,
}) {
  const showSubtitle = columns >= 80;
  const isNarrow = columns < 60;
  const maxSocketLen = isNarrow
    ? Math.max(8, columns - 32)
    : Math.max(12, columns - 42);
  let displaySocket = socketPath || 'Auto-detecting...';
  if (displaySocket.length > maxSocketLen) {
    displaySocket = `…${displaySocket.slice(-(maxSocketLen - 1))}`;
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} marginBottom={1}>
      <Box justifyContent="space-between">
        <Box>
          <Text bold color="cyan">DOCK-WATCH </Text>
          {showSubtitle && (
            <Text dimColor>| Automated Flight Recorder & Diagnostics</Text>
          )}
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
          <Text color="white">{displaySocket}</Text>
        </Box>
        <Box>
          <Text dimColor>Active: </Text>
          <Text bold color="green">{runningCount}</Text>
          <Text dimColor>{isNarrow ? `/${totalCount}` : ` / ${totalCount} containers`}</Text>
        </Box>
      </Box>
    </Box>
  );
}
