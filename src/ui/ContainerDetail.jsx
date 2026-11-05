import React from 'react';
import { Box, Text } from 'ink';
import { formatBytes, truncate } from '../utils/formatters.js';

export function ContainerDetail({ container, columns = process.stdout.columns || 120 }) {
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

  const isNarrow = columns < 105;
  const maxTitleName = Math.max(8, columns - (columns < 80 ? 30 : 54));
  const maxFieldLen = Math.max(16, isNarrow ? columns - 18 : Math.floor(columns * 0.48) - 14);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="blue"
      paddingX={1}
      marginY={1}
      marginLeft={isNarrow ? 0 : 2}
    >
      <Box marginBottom={0}>
        <Text bold color="yellow">{columns < 75 ? 'Diagnostics: ' : 'Container Diagnostics & Inspector: '}</Text>
        <Text bold color="white">{truncate(container.name, maxTitleName)}</Text>
        <Text dimColor> ({container.id.slice(0, 12)})</Text>
      </Box>

      <Box
        flexDirection={isNarrow ? 'column' : 'row'}
        justifyContent="space-between"
        marginTop={1}
      >
        {/* Left Column: Config & Runtime */}
        <Box flexDirection="column" width={isNarrow ? '100%' : '48%'}>
          <Text underline bold color="cyan">Runtime Configuration</Text>
          <Box>
            <Text dimColor>Image: </Text>
            <Text>{truncate(container.image, maxFieldLen)}</Text>
          </Box>
          <Box>
            <Text dimColor>State: </Text>
            <Text color={container.state === 'running' ? 'green' : 'yellow'}>{truncate(container.status, maxFieldLen)}</Text>
          </Box>
          <Box>
            <Text dimColor>Ports: </Text>
            <Text>{truncate(ports || 'None', maxFieldLen)}</Text>
          </Box>
          <Box>
            <Text dimColor>Command: </Text>
            <Text dimColor>{truncate(container.command || 'N/A', maxFieldLen)}</Text>
          </Box>
        </Box>

        {/* Right Column: Telemetry & Storage */}
        <Box flexDirection="column" width={isNarrow ? '100%' : '48%'} marginTop={isNarrow ? 1 : 0}>
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
            <Text>Read: {formatBytes(storage.blockReadBytes, 0)} | Write: {formatBytes(storage.blockWriteBytes, 0)}</Text>
          </Box>
          <Box>
            <Text dimColor>Network Bandwidth: </Text>
            <Text>RX: {formatBytes(network.rxBytes, 0)} | TX: {formatBytes(network.txBytes, 0)}</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
