import React from 'react';
import { Box, Text } from 'ink';
import { formatBytes } from '../utils/formatters.js';
import { Histogram } from './Histogram.jsx';

export function ContainerDetail({ container, history = [] }) {
  if (!container) return null;

  const stats = container.stats;
  const storage = stats?.storage || {};
  const network = stats?.network || {};
  const details = container.details || {};

  const ports = (container.Ports || details.NetworkSettings?.Ports)
    ? Object.entries(container.Ports || details.NetworkSettings?.Ports || {})
        .map(([containerPort, bindings]) => {
          if (!bindings) return containerPort;
          if (Array.isArray(bindings)) {
            const hostPorts = bindings.map((b) => `${b.HostIp || '0.0.0.0'}:${b.HostPort}`).join(',');
            return `${hostPorts} -> ${containerPort}`;
          }
          return containerPort;
        })
        .join(', ')
    : 'None';

  const cpuValues = history.map((s) => s.cpuPercent);
  const memValues = history.map((s) => s.memoryPercent);

  const totalCpus = stats?.cpu?.onlineCpus || 1;
  const currentCpu = stats?.cpu?.percent ?? 0;
  const usedCpus = (currentCpu / 100).toFixed(1);

  const cpuBadge = stats
    ? `${usedCpus} / ${totalCpus} cores`
    : null;

  const memBadge = stats?.memory?.limitBytes
    ? `${formatBytes(stats.memory.usageBytes)} / ${formatBytes(stats.memory.limitBytes)}`
    : null;

  const emptyMsg = container.state !== 'running'
    ? 'No telemetry recorded for this container'
    : 'Collecting live telemetry...';

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

      {/* Row 1: Configuration & Instantaneous Metrics */}
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
            <Text dimColor>{container.command || details.Config?.Cmd?.join(' ') || 'N/A'}</Text>
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

      {/* Row 2: Histograms stacked one on top of the other */}
      <Box flexDirection="column" marginTop={1}>
        <Histogram
          title="CPU Utilization History"
          values={cpuValues}
          badge={cpuBadge}
          emptyMessage={emptyMsg}
          height={2}
        />
        <Histogram
          title="Memory Utilization History"
          values={memValues}
          badge={memBadge}
          emptyMessage={emptyMsg}
          height={2}
        />
      </Box>
    </Box>
  );
}
