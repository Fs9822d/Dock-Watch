import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes,
  formatPercent,
  getMetricColor,
  truncate,
  cleanContainerName,
  getResponsiveLayout,
  getTableHeaders,
  calculateTableLayout,
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

test('getResponsiveLayout returns full mode for width >= 115', () => {
  const layout160 = getResponsiveLayout(160);
  assert.equal(layout160.mode, 'full');
  assert.equal(layout160.showStorage, true);
  assert.equal(layout160.compactStorage, false);
  assert.equal(layout160.columns.storage, 24);
  assert.equal(layout160.columns.selector, 3);
  assert.ok(layout160.totalWidth <= 160);

  const layout115 = getResponsiveLayout(115);
  assert.equal(layout115.mode, 'full');
  assert.equal(layout115.showStorage, true);
  assert.equal(layout115.compactStorage, false);
  assert.equal(layout115.columns.storage, 24);
  // Column total + 4 overhead fits within 115
  assert.ok(layout115.totalWidth + 4 <= 115);
});

test('getResponsiveLayout returns compact mode for 90 <= width < 115', () => {
  const layout114 = getResponsiveLayout(114);
  assert.equal(layout114.mode, 'compact');
  assert.equal(layout114.showStorage, true);
  assert.equal(layout114.compactStorage, true);
  assert.ok(layout114.columns.name <= 16);
  assert.ok(layout114.columns.image <= 16);
  assert.ok(layout114.columns.storage <= 14);
  assert.ok(layout114.totalWidth + 4 <= 114);

  const layout90 = getResponsiveLayout(90);
  assert.equal(layout90.mode, 'compact');
  assert.equal(layout90.showStorage, true);
  assert.equal(layout90.compactStorage, true);
  assert.ok(layout90.totalWidth + 4 <= 90);
});

test('getResponsiveLayout returns minimal mode with hidden storage for width < 90', () => {
  const layout89 = getResponsiveLayout(89);
  assert.equal(layout89.mode, 'minimal');
  assert.equal(layout89.showStorage, false);
  assert.equal(layout89.compactStorage, false);
  assert.equal(layout89.columns.storage, 0);
  assert.ok(layout89.totalWidth + 4 <= 89);

  const layout80 = getResponsiveLayout(80);
  assert.equal(layout80.mode, 'minimal');
  assert.equal(layout80.showStorage, false);
  assert.equal(layout80.columns.storage, 0);
  assert.ok(layout80.totalWidth + 4 <= 80);

  const layout60 = getResponsiveLayout(60);
  assert.equal(layout60.mode, 'minimal');
  assert.equal(layout60.showStorage, false);
  assert.ok(layout60.totalWidth + 4 <= 60);
});

test('getResponsiveLayout safely handles invalid inputs and defaults to full', () => {
  const defaultLayout = getResponsiveLayout();
  assert.equal(defaultLayout.mode, 'full');
  assert.equal(defaultLayout.showStorage, true);

  assert.equal(getResponsiveLayout(null).mode, 'full');
  assert.equal(getResponsiveLayout(undefined).mode, 'full');
  assert.equal(getResponsiveLayout(NaN).mode, 'full');
  assert.equal(getResponsiveLayout(-10).mode, 'full');
  assert.equal(getResponsiveLayout(0).mode, 'full');
});

test('calculateTableLayout is an alias of getResponsiveLayout', () => {
  assert.strictEqual(calculateTableLayout, getResponsiveLayout);
});

test('getTableHeaders returns responsive headers based on column dimensions', () => {
  const narrowCol = { name: 8, ram: 12, storage: 0 };
  const narrowHeaders = getTableHeaders(narrowCol);
  assert.equal(narrowHeaders.name, 'NAME');
  assert.equal(narrowHeaders.ram, 'RAM USAGE');

  const standardCol = { name: 18, ram: 24, storage: 24 };
  const standardHeaders = getTableHeaders(standardCol, { compactStorage: false });
  assert.equal(standardHeaders.name, 'NAME / ID');
  assert.equal(standardHeaders.ram, 'RAM (USAGE / LIMIT)');
  assert.equal(standardHeaders.storage, 'STORAGE (DISK / IO)');

  const compactCol = { name: 15, ram: 20, storage: 12 };
  const compactHeaders = getTableHeaders(compactCol, { compactStorage: true });
  assert.equal(compactHeaders.storage, 'STORAGE');

  // Passing terminal width number directly
  const headersAt50 = getTableHeaders(50);
  assert.equal(headersAt50.name, 'NAME');
  const headersAt120 = getTableHeaders(120);
  assert.equal(headersAt120.name, 'NAME / ID');

  // getResponsiveLayout includes matching headers
  const layout50 = getResponsiveLayout(50);
  assert.equal(layout50.headers.name, 'NAME');
  const layout120 = getResponsiveLayout(120);
  assert.equal(layout120.headers.name, 'NAME / ID');
});

