import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TelemetryStore } from '../src/forensics/telemetry-store.js';

function sample(timestamp, overrides = {}) {
  return {
    timestamp,
    cpu: {
      percent: overrides.cpuPercent ?? 25,
      onlineCpus: overrides.onlineCpus ?? 4,
    },
    memory: {
      usageBytes: overrides.memoryUsageBytes ?? 100,
      rawUsageBytes: overrides.rawMemoryUsageBytes ?? 120,
      limitBytes: overrides.memoryLimitBytes ?? 500,
      percent: overrides.memoryPercent ?? 20,
    },
    storage: {
      blockReadBytes: overrides.blockReadBytes ?? 10,
      blockWriteBytes: overrides.blockWriteBytes ?? 20,
      sizeRwBytes: overrides.sizeRwBytes ?? null,
      sizeRootFsBytes: overrides.sizeRootFsBytes ?? null,
    },
    network: {
      rxBytes: overrides.networkRxBytes ?? 30,
      txBytes: overrides.networkTxBytes ?? 40,
    },
  };
}

test('TelemetryStore flushes a batch and queries history in timestamp order', () => {
  const store = new TelemetryStore(':memory:', { retentionMs: 1000 });

  store.record(
    { id: 'container-a', name: 'web', image: 'nginx:latest', state: 'running' },
    sample('2026-11-18T00:00:02Z', { cpuPercent: 40 }),
  );
  store.record(
    { id: 'container-a', name: 'web', image: 'nginx:latest', state: 'running' },
    sample('2026-11-18T00:00:01Z', { cpuPercent: 20 }),
  );

  assert.equal(store.flush(), 2);
  assert.equal(store.flush(), 0);

  const history = store.queryHistory('container-a', {
    limit: 300,
  });

  assert.equal(history.length, 2);
  assert.equal(history[0].cpuPercent, 20);
  assert.equal(history[1].cpuPercent, 40);
  assert.equal(history[0].memoryUsageBytes, 100);

  const containers = store.listContainers();
  assert.equal(containers.length, 1);
  assert.equal(containers[0].id, 'container-a');

  store.close();
});

test('TelemetryStore automatically flushes queue on queryHistory', () => {
  const store = new TelemetryStore(':memory:');

  store.record(
    { id: 'container-a', name: 'web', image: 'nginx' },
    sample('2026-11-18T00:00:01Z', { cpuPercent: 15 }),
  );

  // queryHistory should auto-flush without requiring explicit store.flush()
  const history = store.queryHistory('container-a');
  assert.equal(history.length, 1);
  assert.equal(history[0].cpuPercent, 15);

  store.close();
});

test('TelemetryStore returns the most recent samples in chronological order', () => {
  const store = new TelemetryStore(':memory:');

  // Insert 5 samples with increasing timestamps
  for (let i = 1; i <= 5; i++) {
    store.record(
      { id: 'container-a', name: 'web', image: 'nginx' },
      sample(`2026-11-18T00:00:0${i}Z`, { cpuPercent: i * 10 }),
    );
  }

  // Request latest 3 samples
  const history = store.queryHistory('container-a', { limit: 3 });
  assert.equal(history.length, 3);
  // Should be samples 3, 4, 5 (cpuPercent 30, 40, 50) in ASC order
  assert.equal(history[0].cpuPercent, 30);
  assert.equal(history[1].cpuPercent, 40);
  assert.equal(history[2].cpuPercent, 50);

  store.close();
});

test('TelemetryStore upserts container metadata', () => {
  const store = new TelemetryStore(':memory:');

  store.upsertContainer({ id: 'container-a', name: 'old-name', image: 'old-image' }, 100);
  store.upsertContainer({ id: 'container-a', name: 'new-name', image: 'new-image' }, 200);

  const containers = store.listContainers();
  assert.equal(containers.length, 1);
  assert.equal(containers[0].name, 'new-name');
  assert.equal(containers[0].image, 'new-image');
  assert.equal(containers[0].lastSeen, 200);

  store.close();
});

test('TelemetryStore prunes samples older than retention', () => {
  const store = new TelemetryStore(':memory:', { retentionMs: 1000 });

  store.record(
    { id: 'container-a', name: 'web', image: 'nginx' },
    sample('2026-11-18T00:00:01Z'),
  );
  store.flush();

  const oldTimestamp = Date.parse('2026-11-18T00:00:01Z');
  assert.equal(store.prune(oldTimestamp + 2000), 1);
  assert.equal(store.queryHistory('container-a').length, 0);

  store.close();
});

test('TelemetryStore falls back to the current time for invalid timestamps', () => {
  const store = new TelemetryStore(':memory:');
  const before = Date.now();

  store.record(
    { id: 'container-a', name: 'web', image: 'nginx' },
    sample('not-a-timestamp'),
  );
  store.flush();

  const history = store.queryHistory('container-a');
  assert.equal(history.length, 1);
  assert.ok(history[0].sampledAt >= before);
  assert.ok(history[0].sampledAt <= Date.now());

  store.close();
});

test('TelemetryStore persists samples and reopens the database', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dock-watch-store-'));
  const databasePath = path.join(directory, 'telemetry.db');

  const firstStore = new TelemetryStore(databasePath);
  firstStore.record(
    { id: 'container-a', name: 'web', image: 'nginx' },
    sample('2026-11-18T00:00:01Z'),
  );
  firstStore.close();

  const secondStore = new TelemetryStore(databasePath);
  const history = secondStore.queryHistory('container-a');
  assert.equal(history.length, 1);
  assert.equal(history[0].cpuPercent, 25);
  secondStore.close();

  fs.rmSync(directory, { recursive: true, force: true });
});
