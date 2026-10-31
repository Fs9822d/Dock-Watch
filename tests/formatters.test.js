import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes,
  formatPercent,
  getMetricColor,
  truncate,
  cleanContainerName,
} from '../src/utils/formatters.js';

test('formatBytes formats binary bytes accurately', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(500), '500.0 B');
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(1048576), '1.0 MB');
  assert.equal(formatBytes(1073741824), '1.0 GB');
  assert.equal(formatBytes(null), '0 B');
  assert.equal(formatBytes(-10), '0 B');
  assert.equal(formatBytes(NaN), '0 B');
});

test('formatPercent formats percentage values', () => {
  assert.equal(formatPercent(0), '0.0%');
  assert.equal(formatPercent(12.3456), '12.3%');
  assert.equal(formatPercent(99.99, 2), '99.99%');
  assert.equal(formatPercent(null), '0.0%');
});

test('getMetricColor categorizes loads into traffic-light colors', () => {
  assert.equal(getMetricColor(10), 'green');
  assert.equal(getMetricColor(59.9), 'green');
  assert.equal(getMetricColor(60), 'yellow');
  assert.equal(getMetricColor(84.9), 'yellow');
  assert.equal(getMetricColor(85), 'red');
  assert.equal(getMetricColor(100), 'red');
});

test('truncate truncates strings and appends ellipsis', () => {
  assert.equal(truncate('short', 10), 'short');
  assert.equal(truncate('verylongstringhere', 10), 'verylongs…');
  assert.equal(truncate('', 5), '');
});

test('cleanContainerName strips leading slash', () => {
  assert.equal(cleanContainerName('/my-web-api'), 'my-web-api');
  assert.equal(cleanContainerName(['/frontend', '/alias']), 'frontend');
  assert.equal(cleanContainerName('redis'), 'redis');
});
