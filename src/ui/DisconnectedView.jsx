import React from 'react';
import { Box, Text } from 'ink';

export function DisconnectedView({ checkedPaths = [], countdown = 2, error }) {
  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="red"
      padding={1}
      marginY={1}
    >
      <Box marginBottom={1}>
        <Text bold color="red">✖ DOCKER DAEMON SOCKET UNREACHABLE</Text>
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="yellow">Notice: {error}</Text>
        </Box>
      )}

      <Box flexDirection="column" marginBottom={1}>
        <Text bold underline>Sockets Evaluated:</Text>
        {checkedPaths.length > 0 ? (
          checkedPaths.map((p, i) => (
            <Box key={i} marginLeft={2}>
              <Text dimColor>• {p} </Text>
              <Text color="red">[Not Found / Closed]</Text>
            </Box>
          ))
        ) : (
          <Box marginLeft={2}>
            <Text dimColor>• Standard /var/run/docker.sock</Text>
          </Box>
        )}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text bold underline>Troubleshooting Guidance:</Text>
        <Box marginLeft={2}>
          <Text dimColor>1. Docker Service: </Text>
          <Text color="white">sudo systemctl start docker </Text>
          <Text dimColor>(or start Docker Desktop)</Text>
        </Box>
        <Box marginLeft={2}>
          <Text dimColor>2. Rootless Podman: </Text>
          <Text color="white">systemctl --user start podman.socket</Text>
        </Box>
        <Box marginLeft={2}>
          <Text dimColor>3. Custom Socket: </Text>
          <Text color="white">dock-watch --socket /path/to/docker.sock</Text>
        </Box>
      </Box>

      <Box marginTop={1} justifyContent="space-between">
        <Box>
          <Text color="cyan">Auto-reconnecting in </Text>
          <Text bold color="yellow">{countdown}s</Text>
          <Text color="cyan">...</Text>
        </Box>
        <Box>
          <Text dimColor>Press </Text>
          <Text bold color="white">r</Text>
          <Text dimColor> to retry now, </Text>
          <Text bold color="white">q</Text>
          <Text dimColor> to quit</Text>
        </Box>
      </Box>
    </Box>
  );
}
