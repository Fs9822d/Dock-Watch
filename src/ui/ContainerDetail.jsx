import React from 'react';
import { Box, Text } from 'ink';
import { formatBytes } from '../utils/formatters.js';

export function ContainerDetail({ container }) {
  if (!container) return null;

  const stats = container.stats;
  const storage = stats?.storage || {};
  const network = stats?.network || {};

  let ports = 'None';
  if (Array.isArray(container.Ports) && container.Ports.length > 0) {
    ports = container.Ports.map((p) => {
      if (p.PublicPort) {
        return `${p.IP || '0.0.0.0'}:${p.PublicPort} -> ${p.PrivatePort}/${p.Type || 'tcp'}`;
      }
      return `${p.PrivatePort}/${p.Type || 'tcp'}`;
    }).join(', ');
  } else if (container.Ports && typeof container.Ports === 'object') {
    ports = Object.entries(container.Ports)
      .map(([port, bindings]) => {
        if (Array.isArray(bindings)) {
          const hostPorts = bindings.map((b) => `${b.HostIp || '0.0.0.0'}:${b.HostPort}`).join(',');
          return `${hostPorts} -> ${port}`;
        }
        return port;
      })
      .join(', ') || 'None';
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="blue"
      paddingX={1}
      marginY={1}
      marginLeft={2}
    >
      <Box marginBottom={0}>
        <Text bold color="yellow">Container Diagnostics & Inspector: </Text>
        <Text bold color="white">{container.name}</Text>
        <Text dimColor> ({container.id.slice(0, 12)})</Text>
      </Box>

      <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
        {/* Left Column: Config & Runtime */}
        <Box flexDirection="column" width="48%">
          <Text underline bold color="cyan">Runtime Configuration</Text>
          <Box>
            <Text dimColor>Image: </Text>
            <Text>{container.image}</Text>
          </Box>
          <Box>
            <Text dimColor>State: </Text>
            <Text color={container.state === 'running' ? 'green' : 'yellow'}>{container.status}</Text>
          </Box>
          <Box>
            <Text dimColor>Ports: </Text>
            <Text>{ports || 'None'}</Text>
          </Box>
          <Box>
            <Text dimColor>Command: </Text>
            <Text dimColor>{container.command || 'N/A'}</Text>
          </Box>
        </Box>

        {/* Right Column: Telemetry & Storage */}
        <Box flexDirection="column" width="48%">
          <Text underline bold color="cyan">Storage & Network Metrics</Text>
          <Box>
            <Text dimColor>Writable Disk (SizeRw): </Text>
            <Text bold color="white">{formatBytes(storage.sizeRwBytes)}</Text>
          </Box>
          <Box>
            <Text dimColor>Virtual RootFS: </Text>
            <Text>{formatBytes(storage.sizeRootFsBytes)}</Text>
          </Box>
          <Box>
            <Text dimColor>Block Disk I/O: </Text>
            <Text>Read: {formatBytes(storage.blockReadBytes)} | Write: {formatBytes(storage.blockWriteBytes)}</Text>
          </Box>
          <Box>
            <Text dimColor>Network Bandwidth: </Text>
            <Text>RX: {formatBytes(network.rxBytes)} | TX: {formatBytes(network.txBytes)}</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
