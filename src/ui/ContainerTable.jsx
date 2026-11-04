import React from 'react';
import { Box, Text } from 'ink';
import {
  formatBytes,
  formatPercent,
  getMetricColor,
  truncate,
} from '../utils/formatters.js';
import { ContainerDetail } from './ContainerDetail.jsx';

export function ContainerTable({ containers = [], selectedIndex = 0, expandedId = null }) {
  if (containers.length === 0) {
    return (
      <Box borderStyle="single" borderColor="gray" padding={1} marginY={1} justifyContent="center">
        <Text dimColor>No active Docker containers detected on this daemon.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Table Header */}
      <Box borderStyle="single" borderColor="gray" paddingX={1} marginBottom={0}>
        <Box width={3}>
          <Text bold color="white"> </Text>
        </Box>
        <Box width={20}>
          <Text bold color="white">NAME / ID</Text>
        </Box>
        <Box width={22}>
          <Text bold color="white">IMAGE</Text>
        </Box>
        <Box width={14}>
          <Text bold color="white">STATUS</Text>
        </Box>
        <Box width={10}>
          <Text bold color="white">CPU %</Text>
        </Box>
        <Box width={24}>
          <Text bold color="white">RAM (USAGE / LIMIT)</Text>
        </Box>
        <Box width={24}>
          <Text bold color="white">STORAGE (DISK / IO)</Text>
        </Box>
      </Box>

      {/* Table Body */}
      {containers.map((container, index) => {
        const isSelected = index === selectedIndex;
        const isExpanded = expandedId === container.id;
        const stats = container.stats;

        const cpuPercent = stats?.cpu?.percent ?? 0;
        const cpuColor = getMetricColor(cpuPercent);

        const memBytes = stats?.memory?.usageBytes ?? 0;
        const memLimit = stats?.memory?.limitBytes ?? 0;
        const memPercent = stats?.memory?.percent ?? 0;
        const memColor = getMetricColor(memPercent);

        const storage = stats?.storage || {};
        const diskSize = storage.sizeRwBytes !== null ? formatBytes(storage.sizeRwBytes) : '-';
        const diskIO = `${formatBytes(storage.blockReadBytes, 0)}/${formatBytes(storage.blockWriteBytes, 0)}`;

        return (
          <Box key={container.id} flexDirection="column">
            <Box
              paddingX={1}
              backgroundColor={isSelected ? 'gray' : undefined}
            >
              {/* Selector */}
              <Box width={3}>
                <Text bold color={isSelected ? 'cyan' : 'gray'}>
                  {isSelected ? '▶ ' : '  '}
                </Text>
              </Box>

              {/* Name & ID */}
              <Box width={20}>
                <Text bold color={isSelected ? 'white' : 'cyan'}>
                  {truncate(container.name, 12)}
                </Text>
                <Text dimColor> {container.id.slice(0, 6)}</Text>
              </Box>

              {/* Image */}
              <Box width={22}>
                <Text color={isSelected ? 'white' : undefined}>
                  {truncate(container.image, 20)}
                </Text>
              </Box>

              {/* Status */}
              <Box width={14}>
                <Text color={container.state === 'running' ? 'green' : 'yellow'}>
                  {truncate(container.status, 12)}
                </Text>
              </Box>

              {/* CPU % */}
              <Box width={10}>
                <Text bold color={cpuColor}>
                  {formatPercent(cpuPercent)}
                </Text>
              </Box>

              {/* RAM Usage */}
              <Box width={24}>
                <Text bold color={memColor}>
                  {formatBytes(memBytes)}
                </Text>
                <Text dimColor> / {formatBytes(memLimit)}</Text>
                <Text color={memColor}> ({formatPercent(memPercent, 0)})</Text>
              </Box>

              {/* Storage (Disk size + Block I/O) */}
              <Box width={24}>
                <Text bold color="white">{diskSize}</Text>
                <Text dimColor> [IO: {diskIO}]</Text>
              </Box>
            </Box>

            {/* Expandable Inspector Drawer */}
            {isExpanded && <ContainerDetail container={container} />}
          </Box>
        );
      })}
    </Box>
  );
}
