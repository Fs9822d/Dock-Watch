import React from 'react';
import { Box, Text } from 'ink';

export function Footer({ lastUpdated, isConnected, columns = process.stdout.columns || 120 }) {
  const timeStr = lastUpdated ? lastUpdated.toLocaleTimeString() : '-';
  const isCompact = columns < 95;
  const isVeryCompact = columns < 65;
  const showSync = isConnected && columns >= 90;

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
      marginTop={1}
    >
      <Box>
        {!isVeryCompact && <Text dimColor>Controls: </Text>}
        <Text bold color="cyan">↑/↓ </Text>
        <Text dimColor>{isCompact ? 'Nav ' : 'Select  '}</Text>
        <Text bold color="cyan">{isVeryCompact ? '↵ ' : 'Enter/Space '}</Text>
        <Text dimColor>{isCompact ? 'Exp ' : 'Expand  '}</Text>
        <Text bold color="cyan">r </Text>
        <Text dimColor>{isCompact ? 'Ref ' : 'Refresh  '}</Text>
        <Text bold color="cyan">q </Text>
        <Text dimColor>Quit</Text>
      </Box>

      {showSync && (
        <Box>
          <Text dimColor>Last Sync: </Text>
          <Text color="gray">{timeStr}</Text>
        </Box>
      )}
    </Box>
  );
}
