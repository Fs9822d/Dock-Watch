import React from 'react';
import { Box, Text } from 'ink';
import {
  formatBytes,
  formatPercent,
  getMetricColor,
  truncate,
  getResponsiveLayout,
} from '../utils/formatters.js';
import { ContainerDetail } from './ContainerDetail.jsx';

export function ContainerTable({
  containers = [],
  selectedIndex = 0,
  expandedId = null,
  columns = process.stdout.columns || 120,
}) {
  if (containers.length === 0) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1} marginY={1} justifyContent="center">
        <Text dimColor>No active Docker containers detected on this daemon.</Text>
      </Box>
    );
  }

  const layout = getResponsiveLayout(columns);
  const col = layout.columns;

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Table Header */}
      <Box borderStyle="single" borderColor="gray" paddingX={0} marginBottom={0}>
        <Box width={col.selector}>
          <Text bold color="white"> </Text>
        </Box>
        <Box width={col.name}>
          <Text bold color="white">NAME / ID</Text>
        </Box>
        <Box width={col.image}>
          <Text bold color="white">IMAGE</Text>
        </Box>
        <Box width={col.status}>
          <Text bold color="white">STATUS</Text>
        </Box>
        <Box width={col.cpu}>
          <Text bold color="white">CPU %</Text>
        </Box>
        <Box width={col.ram}>
          <Text bold color="white">
            {col.ram >= 22 ? 'RAM (USAGE / LIMIT)' : 'RAM USAGE'}
          </Text>
        </Box>
        {layout.showStorage && (
          <Box width={col.storage}>
            <Text bold color="white">
              {layout.compactStorage ? 'STORAGE' : 'STORAGE (DISK / IO)'}
            </Text>
          </Box>
        )}
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

        const idLen = col.name >= 16 ? 6 : (col.name >= 14 ? 5 : (col.name >= 10 ? 4 : 3));
        const nameMax = Math.max(3, col.name - idLen - 1);
        const imageMax = Math.max(4, col.image - 1);
        const statusMax = Math.max(4, col.status - 1);

        const selectorIcon = isSelected
          ? (col.selector >= 3 ? '▶ ' : '▶')
          : (col.selector >= 3 ? '  ' : ' ');

        const cpuDecimals = col.cpu >= 8 ? (cpuPercent >= 100 ? 0 : 1) : 0;
        const cpuText = formatPercent(cpuPercent, cpuDecimals);

        const pctStr = `(${formatPercent(memPercent, 0)})`;
        let showLimit = false;
        let showPct = true;
        let ramUsageText = formatBytes(memBytes);
        let ramLimitText = formatBytes(memLimit);

        if (col.ram >= 22) {
          const fullRam = `${ramUsageText} / ${ramLimitText} ${pctStr}`;
          if (fullRam.length <= col.ram) {
            showLimit = true;
          } else {
            const u0 = formatBytes(memBytes, 0);
            const l0 = formatBytes(memLimit, 0);
            if (`${u0} / ${l0} ${pctStr}`.length <= col.ram) {
              showLimit = true;
              ramUsageText = u0;
              ramLimitText = l0;
            } else {
              showLimit = false;
            }
          }
        }

        if (!showLimit) {
          if (`${ramUsageText} ${pctStr}`.length > col.ram) {
            ramUsageText = formatBytes(memBytes, 0);
            if (`${ramUsageText} ${pctStr}`.length > col.ram) {
              showPct = false;
            }
          }
        }

        let ioSnippet = '';
        if (layout.showStorage && !layout.compactStorage) {
          const fullStorage = `${diskSize} [IO: ${diskIO}]`;
          if (fullStorage.length <= col.storage) {
            ioSnippet = ` [IO: ${diskIO}]`;
          } else {
            const compactIO = `${diskSize} (${diskIO})`;
            if (compactIO.length <= col.storage) {
              ioSnippet = ` (${diskIO})`;
            }
          }
        }

        return (
          <Box key={container.id} flexDirection="column">
            <Box
              paddingLeft={1}
              paddingRight={1}
              backgroundColor={isSelected ? 'gray' : undefined}
            >
              {/* Selector */}
              <Box width={col.selector}>
                <Text bold color={isSelected ? 'cyan' : 'gray'}>
                  {selectorIcon}
                </Text>
              </Box>

              {/* Name & ID */}
              <Box width={col.name}>
                <Text bold color={isSelected ? 'white' : 'cyan'}>
                  {truncate(container.name, nameMax)}
                </Text>
                <Text dimColor> {container.id.slice(0, idLen)}</Text>
              </Box>

              {/* Image */}
              <Box width={col.image}>
                <Text color={isSelected ? 'white' : undefined}>
                  {truncate(container.image, imageMax)}
                </Text>
              </Box>

              {/* Status */}
              <Box width={col.status}>
                <Text color={container.state === 'running' ? 'green' : 'yellow'}>
                  {truncate(container.status, statusMax)}
                </Text>
              </Box>

              {/* CPU % */}
              <Box width={col.cpu}>
                <Text bold color={cpuColor}>
                  {cpuText}
                </Text>
              </Box>

              {/* RAM Usage */}
              <Box width={col.ram}>
                <Text bold color={memColor}>
                  {ramUsageText}
                </Text>
                {showLimit ? (
                  <>
                    <Text dimColor> / {ramLimitText}</Text>
                    <Text color={memColor}> {pctStr}</Text>
                  </>
                ) : showPct ? (
                  <Text dimColor> {pctStr}</Text>
                ) : null}
              </Box>

              {/* Storage */}
              {layout.showStorage && (
                <Box width={col.storage}>
                  <Text bold color="white">{diskSize}</Text>
                  {ioSnippet ? <Text dimColor>{ioSnippet}</Text> : null}
                </Box>
              )}
            </Box>

            {/* Expandable Inspector Drawer */}
            {isExpanded && <ContainerDetail container={container} columns={columns} />}
          </Box>
        );
      })}
    </Box>
  );
}

