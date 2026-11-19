import { getMetricColor } from './formatters.js';

export const UNICODE_BLOCKS = [' ', ' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/**
 * Compute summary statistics over an array of numbers.
 * @param {number[]} values
 * @returns {{ min: number, max: number, avg: number, current: number, count: number }}
 */
export function calculateMetricStats(values = []) {
  if (!values || values.length === 0) {
    return { min: 0, max: 0, avg: 0, current: 0, count: 0 };
  }

  const validNumbers = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (validNumbers.length === 0) {
    return { min: 0, max: 0, avg: 0, current: 0, count: 0 };
  }

  const min = Math.min(...validNumbers);
  const max = Math.max(...validNumbers);
  const sum = validNumbers.reduce((acc, curr) => acc + curr, 0);
  const avg = sum / validNumbers.length;
  const current = validNumbers[validNumbers.length - 1];

  return {
    min,
    max,
    avg,
    current,
    count: validNumbers.length,
  };
}

/**
 * Builds multi-row histogram matrix with color segments.
 *
 * @param {Object} options
 * @param {number[]} options.values
 * @param {number} [options.min=0]
 * @param {number} [options.max=100]
 * @param {number} [options.height=2]
 * @param {number} [options.maxBars=40]
 * @returns {{
 *   rows: Array<{
 *     levelLabel: string,
 *     segments: Array<{ text: string, color: 'green' | 'yellow' | 'red' }>
 *   }>,
 *   stats: { min: number, max: number, avg: number, current: number, count: number }
 * }}
 */
export function buildHistogramRows({
  values = [],
  min = 0,
  max = 100,
  height = 2,
  maxBars = 40,
} = {}) {
  const stats = calculateMetricStats(values);
  const clampedHeight = Math.max(1, Math.min(height, 8));
  const rawSubset = values.slice(-maxBars);

  if (rawSubset.length === 0) {
    return { rows: [], stats };
  }

  const totalSteps = clampedHeight * 8;
  const safeRange = max > min ? max - min : 1;

  // Pre-calculate bar characters and colors for each value
  const bars = rawSubset.map((rawVal) => {
    const val = Number.isFinite(rawVal) ? rawVal : 0;
    const normalized = Math.max(0, Math.min(1, (val - min) / safeRange));
    const step = Math.round(normalized * totalSteps);
    const color = getMetricColor(val);

    return { val, step, color };
  });

  const rows = [];

  // Generate rows from top (height - 1) down to 0
  for (let r = clampedHeight - 1; r >= 0; r--) {
    const rowStartStep = r * 8;
    const rowEndStep = (r + 1) * 8;

    // Approximate percentage label for the row baseline
    const rowPct = Math.round(min + ((r + 1) / clampedHeight) * safeRange);
    const levelLabel = `${String(rowPct).padStart(3, ' ')}% ┤`;

    // Build characters with color grouping
    const segments = [];
    let currentSegment = null;

    for (const bar of bars) {
      let char = ' ';
      if (bar.step >= rowEndStep) {
        char = '█';
      } else if (bar.step > rowStartStep) {
        const blockIdx = bar.step - rowStartStep;
        char = UNICODE_BLOCKS[Math.max(1, Math.min(8, blockIdx))];
      }

      const color = bar.color;

      if (!currentSegment || currentSegment.color !== color) {
        if (currentSegment) {
          segments.push(currentSegment);
        }
        currentSegment = { text: char, color };
      } else {
        currentSegment.text += char;
      }
    }

    if (currentSegment) {
      segments.push(currentSegment);
    }

    rows.push({
      levelLabel,
      segments,
    });
  }

  return {
    rows,
    stats,
  };
}
