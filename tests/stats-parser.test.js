import test from 'node:test';
import assert from 'node:assert/strict';
import { parseContainerStats } from '../src/telemetry/stats-parser.js';

test('parseContainerStats handles single-core and multi-core CPU %', () => {
  const raw = {
    cpu_stats: {
      cpu_usage: { total_usage: 200000000 },
      system_cpu_usage: 1000000000,
      online_cpus: 2,
    },
    precpu_stats: {
      cpu_usage: { total_usage: 100000000 },
      system_cpu_usage: 900000000,
    },
  };

  const parsed = parseContainerStats(raw);
  // cpuDelta = 100,000,000, systemDelta = 100,000,000
  // cpuPercent = (100M / 100M) * 2 cores * 100% = 200%
  assert.equal(parsed.cpu.percent, 200.0);
  assert.equal(parsed.cpu.onlineCpus, 2);
});

test('parseContainerStats handles zero or idle CPU deltas without NaN', () => {
  const raw = {
    cpu_stats: {
      cpu_usage: { total_usage: 100 },
      system_cpu_usage: 1000,
    },
    precpu_stats: {
      cpu_usage: { total_usage: 100 },
      system_cpu_usage: 1000,
    },
  };

  const parsed = parseContainerStats(raw);
  assert.equal(parsed.cpu.percent, 0.0);
});

test('parseContainerStats normalizes cgroups v1 and v2 memory cache', () => {
  // cgroups v2
  const rawV2 = {
    memory_stats: {
      usage: 500 * 1024 * 1024,
      limit: 1024 * 1024 * 1024,
      stats: {
        inactive_file: 100 * 1024 * 1024,
      },
    },
  };

  const parsedV2 = parseContainerStats(rawV2);
  assert.equal(parsedV2.memory.usageBytes, 400 * 1024 * 1024);
  assert.equal(parsedV2.memory.limitBytes, 1024 * 1024 * 1024);
  assert.ok(Math.abs(parsedV2.memory.percent - 39.06) < 0.1);

  // cgroups v1
  const rawV1 = {
    memory_stats: {
      usage: 250 * 1024 * 1024,
      limit: 500 * 1024 * 1024,
      stats: {
        total_inactive_file: 50 * 1024 * 1024,
      },
    },
  };

  const parsedV1 = parseContainerStats(rawV1);
  assert.equal(parsedV1.memory.usageBytes, 200 * 1024 * 1024);
  assert.equal(parsedV1.memory.percent, 40.0);
});

test('parseContainerStats calculates Block I/O read and write totals', () => {
  const raw = {
    blkio_stats: {
      io_service_bytes_recursive: [
        { major: 8, minor: 0, op: 'Read', value: 1048576 },
        { major: 8, minor: 0, op: 'Write', value: 2097152 },
        { major: 8, minor: 0, op: 'Sync', value: 5000 },
        { major: 8, minor: 1, op: 'read', value: 524288 },
      ],
    },
  };

  const parsed = parseContainerStats(raw);
  assert.equal(parsed.storage.blockReadBytes, 1048576 + 524288);
  assert.equal(parsed.storage.blockWriteBytes, 2097152);
});

test('parseContainerStats aggregates network RX and TX bytes across all interfaces', () => {
  const raw = {
    networks: {
      eth0: { rx_bytes: 5000, tx_bytes: 2500 },
      eth1: { rx_bytes: 1500, tx_bytes: 500 },
    },
  };

  const parsed = parseContainerStats(raw);
  assert.equal(parsed.network.rxBytes, 6500);
  assert.equal(parsed.network.txBytes, 3000);
});
