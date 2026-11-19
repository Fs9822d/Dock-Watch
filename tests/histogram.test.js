import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMetricStats,
  buildHistogramRows,
  UNICODE_BLOCKS,
} from '../src/utils/histogram.js';

test('calculateMetricStats computes min, max, avg, and current', () => {
  assert.deepEqual(calculateMetricStats([]), {
    min: 0,
    max: 0,
    avg: 0,
    current: 0,
    count: 0,
  });

  const stats = calculateMetricStats([10, 20, 30, 40]);
  assert.equal(stats.min, 10);
  assert.equal(stats.max, 40);
  assert.equal(stats.avg, 25);
  assert.equal(stats.current, 40);
  assert.equal(stats.count, 4);
});

test('calculateMetricStats filters out non-finite values', () => {
  const stats = calculateMetricStats([5, NaN, null, undefined, 15]);
  assert.equal(stats.min, 5);
  assert.equal(stats.max, 15);
  assert.equal(stats.avg, 10);
  assert.equal(stats.current, 15);
  assert.equal(stats.count, 2);
});

test('buildHistogramRows handles empty values gracefully', () => {
  const result = buildHistogramRows({ values: [] });
  assert.deepEqual(result.rows, []);
  assert.equal(result.stats.count, 0);
});

test('buildHistogramRows renders height=1 sparkline properly', () => {
  const values = [0, 50, 100];
  const { rows } = buildHistogramRows({
    values,
    min: 0,
    max: 100,
    height: 1,
  });

  assert.equal(rows.length, 1);
  const text = rows[0].segments.map((s) => s.text).join('');
  assert.equal(text.length, 3);
  // 0% -> space or lowest block, 50% -> middle block, 100% -> full block
  assert.equal(text[0], ' ');
  assert.equal(text[1], UNICODE_BLOCKS[4]); // 4/8 is 50%
  assert.equal(text[2], '█');
});

test('buildHistogramRows renders height=2 multi-level matrix', () => {
  const values = [0, 25, 50, 75, 100];
  const { rows } = buildHistogramRows({
    values,
    min: 0,
    max: 100,
    height: 2,
  });

  assert.equal(rows.length, 2);
  const topText = rows[0].segments.map((s) => s.text).join('');
  const bottomText = rows[1].segments.map((s) => s.text).join('');

  // Top row (50%-100%): 0, 25, 50 are empty, 75 is half block, 100 is full block
  assert.equal(topText[0], ' ');
  assert.equal(topText[1], ' ');
  assert.equal(topText[2], ' ');
  assert.equal(topText[3], UNICODE_BLOCKS[4]);
  assert.equal(topText[4], '█');

  // Bottom row (0%-50%): 0 is empty, 25 is half, 50, 75, 100 are full
  assert.equal(bottomText[0], ' ');
  assert.equal(bottomText[1], UNICODE_BLOCKS[4]);
  assert.equal(bottomText[2], '█');
  assert.equal(bottomText[3], '█');
  assert.equal(bottomText[4], '█');
});

test('buildHistogramRows respects maxBars limit', () => {
  const values = Array.from({ length: 100 }, (_, i) => i);
  const { rows, stats } = buildHistogramRows({
    values,
    maxBars: 20,
    height: 1,
  });

  const fullText = rows[0].segments.map((s) => s.text).join('');
  assert.equal(fullText.length, 20);
  assert.equal(stats.count, 100);
});

test('buildHistogramRows assigns traffic-light colors according to thresholds', () => {
  const values = [10, 70, 95];
  const { rows } = buildHistogramRows({
    values,
    min: 0,
    max: 100,
    height: 1,
  });

  // Segments should have green (10%), yellow (70%), red (95%)
  assert.equal(rows[0].segments.length, 3);
  assert.equal(rows[0].segments[0].color, 'green');
  assert.equal(rows[0].segments[1].color, 'yellow');
  assert.equal(rows[0].segments[2].color, 'red');
});
