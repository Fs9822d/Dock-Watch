import React from 'react';
import { Box, Text } from 'ink';

export function Footer({ lastUpdated, isConnected }) {
  const timeStr = lastUpdated ? lastUpdated.toLocaleTimeString() : '-';

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
      marginTop={1}
    >
      <Box>
        <Text dimColor>Controls: </Text>
        <Text bold color="cyan">↑/↓ </Text>
        <Text dimColor>Select  </Text>
        <Text bold color="cyan">Enter/Space </Text>
        <Text dimColor>Expand  </Text>
        <Text bold color="cyan">r </Text>
        <Text dimColor>Refresh  </Text>
        <Text bold color="cyan">q </Text>
        <Text dimColor>Quit</Text>
      </Box>

      {isConnected && (
        <Box>
          <Text dimColor>Last Sync: </Text>
          <Text color="gray">{timeStr}</Text>
        </Box>
      )}
    </Box>
  );
}
