import React from 'react';
import { Box, Text } from 'ink';
import { buildHistogramRows } from '../utils/histogram.js';
import { formatPercent, getMetricColor } from '../utils/formatters.js';

export function Histogram({
  title,
  values = [],
  badge = null,
  min = 0,
  max = 100,
  height = 2,
  maxBars = 45,
  formatValue = (v) => formatPercent(v),
  emptyMessage = 'Awaiting telemetry samples...',
}) {
  const { rows, stats } = buildHistogramRows({
    values,
    min,
    max,
    height,
    maxBars,
  });

  const hasData = values && values.length > 0;
  const barCount = Math.min(values.length, maxBars);

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Line 1: Title, Badge, and Current Value */}
      <Box flexDirection="row" justifyContent="space-between">
        <Box>
          <Text bold color="cyan">{title}</Text>
          {badge && <Text color="yellow"> [{badge}]</Text>}
        </Box>
        {hasData ? (
          <Box>
            <Text dimColor>Current: </Text>
            <Text bold color={getMetricColor(stats.current)}>
              [{formatValue(stats.current)}]
            </Text>
          </Box>
        ) : (
          <Text dimColor>[ {emptyMessage} ]</Text>
        )}
      </Box>

      {/* Line 2: History sample window & Min/Avg/Max stats */}
      {hasData && (
        <Box flexDirection="row" justifyContent="space-between" marginBottom={0}>
          <Text dimColor>History ({stats.count} {stats.count === 1 ? 'sample' : 'samples'})</Text>
          <Box>
            <Text dimColor>Min: </Text>
            <Text color="white">{formatValue(stats.min)}</Text>
            <Text dimColor>  Avg: </Text>
            <Text color="white">{formatValue(stats.avg)}</Text>
            <Text dimColor>  Max: </Text>
            <Text color="white">{formatValue(stats.max)}</Text>
          </Box>
        </Box>
      )}

      {/* Chart Canvas */}
      {hasData && (
        <Box flexDirection="column" marginTop={0}>
          {rows.map((row, idx) => (
            <Box key={idx} flexDirection="row">
              <Box width={7}>
                <Text dimColor>{row.levelLabel} </Text>
              </Box>
              <Box>
                {row.segments.map((segment, segIdx) => (
                  <Text key={segIdx} color={segment.color} bold>
                    {segment.text}
                  </Text>
                ))}
              </Box>
            </Box>
          ))}
          {/* Baseline Axis */}
          <Box flexDirection="row">
            <Box width={7}>
              <Text dimColor>  0% ┴ </Text>
            </Box>
            <Box>
              <Text dimColor>{'─'.repeat(barCount)}</Text>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
