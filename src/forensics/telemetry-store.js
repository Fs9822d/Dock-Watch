import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { TELEMETRY_STORE_RETENTION_MS } from '../utils/constants.js';

export function resolveTelemetryDatabasePath() {
  if (process.env.DOCK_WATCH_DB_PATH) {
    return process.env.DOCK_WATCH_DB_PATH;
  }

  if (process.platform === 'linux') {
    const stateHome = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
    return path.join(stateHome, 'dock-watch', 'telemetry.db');
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'dock-watch', 'telemetry.db');
  }

  return path.join(os.homedir(), '.dock-watch', 'telemetry.db');
}

export class TelemetryStore {
  constructor(databasePath = resolveTelemetryDatabasePath(), options = {}) {
    this.databasePath = databasePath;
    this.retentionMs = options.retentionMs ?? TELEMETRY_STORE_RETENTION_MS;
    this.queue = [];
    this.closed = false;

    if (databasePath !== ':memory:' && !databasePath.startsWith('file:')) {
      fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    }

    this.database = new DatabaseSync(databasePath);
    this.database.exec('PRAGMA journal_mode = WAL;');
    this.database.exec('PRAGMA foreign_keys = ON;');
    this.database.exec('PRAGMA busy_timeout = 5000;');
    this.database.exec('PRAGMA synchronous = NORMAL;');
    this.initializeSchema();
  }

  initializeSchema() {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS containers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        image TEXT,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS telemetry_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        container_id TEXT NOT NULL,
        sampled_at INTEGER NOT NULL,
        cpu_percent REAL NOT NULL,
        online_cpus INTEGER NOT NULL,
        memory_usage_bytes INTEGER NOT NULL,
        raw_memory_usage_bytes INTEGER NOT NULL,
        memory_limit_bytes INTEGER NOT NULL,
        memory_percent REAL NOT NULL,
        block_read_bytes INTEGER NOT NULL,
        block_write_bytes INTEGER NOT NULL,
        network_rx_bytes INTEGER NOT NULL,
        network_tx_bytes INTEGER NOT NULL,
        size_rw_bytes INTEGER,
        size_root_fs_bytes INTEGER,
        FOREIGN KEY (container_id) REFERENCES containers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS telemetry_samples_container_time_idx
        ON telemetry_samples(container_id, sampled_at);

      CREATE INDEX IF NOT EXISTS telemetry_samples_time_idx
        ON telemetry_samples(sampled_at);
    `);

    this.upsertContainerStatement = this.database.prepare(`
      INSERT INTO containers (id, name, image, first_seen, last_seen)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        image = excluded.image,
        last_seen = excluded.last_seen
    `);

    this.insertSampleStatement = this.database.prepare(`
      INSERT INTO telemetry_samples (\n        container_id,
        sampled_at,
        cpu_percent,
        online_cpus,
        memory_usage_bytes,
        raw_memory_usage_bytes,
        memory_limit_bytes,
        memory_percent,
        block_read_bytes,
        block_write_bytes,
        network_rx_bytes,
        network_tx_bytes,
        size_rw_bytes,
        size_root_fs_bytes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.pruneStatement = this.database.prepare(`
      DELETE FROM telemetry_samples
      WHERE sampled_at < ?
    `);
  }

  record(container, stats) {
    if (this.closed) return false;
    if (!container?.id || !stats) return false;

    const timestamp = this.normalizeTimestamp(stats.timestamp);

    this.queue.push({
      container,
      timestamp,
      stats,
    });

    return true;
  }

  flush() {
    if (this.closed || this.queue.length === 0) return 0;

    const pending = this.queue;
    this.queue = [];

    try {
      this.database.exec('BEGIN IMMEDIATE');

      for (const entry of pending) {
        const { container, timestamp, stats } = entry;

        this.upsertContainerStatement.run(
          container.id,
          container.name || 'unknown',
          container.image || null,
          timestamp,
          timestamp,
        );

        this.insertSampleStatement.run(
          container.id,
          timestamp,
          this.toNumber(stats.cpu?.percent),
          this.toInteger(stats.cpu?.onlineCpus, 1),
          this.toInteger(stats.memory?.usageBytes),
          this.toInteger(stats.memory?.rawUsageBytes),
          this.toInteger(stats.memory?.limitBytes),
          this.toNumber(stats.memory?.percent),
          this.toInteger(stats.storage?.blockReadBytes),
          this.toInteger(stats.storage?.blockWriteBytes),
          this.toInteger(stats.network?.rxBytes),
          this.toInteger(stats.network?.txBytes),
          this.toNullableInteger(stats.storage?.sizeRwBytes),
          this.toNullableInteger(stats.storage?.sizeRootFsBytes),
        );
      }

      this.database.exec('COMMIT');
      return pending.length;
    } catch (error) {
      try {
        this.database.exec('ROLLBACK');
      } catch {}
      this.queue.unshift(...pending);
      throw error;
    }
  }

  upsertContainer(container, timestamp = Date.now()) {
    if (this.closed || !container?.id) return false;

    this.upsertContainerStatement.run(
      container.id,
      container.name || 'unknown',
      container.image || null,
      timestamp,
      timestamp,
    );

    return true;
  }

  prune(now = Date.now()) {
    if (this.closed) return 0;
    const cutoff = now - this.retentionMs;
    const result = this.pruneStatement.run(cutoff);
    return result.changes;
  }

  queryHistory(containerId, options = {}) {
    if (this.closed) throw new Error('TelemetryStore is closed');

    const limit = Math.max(1, Math.min(options.limit ?? 300, 10000));
    const from = options.from ?? 0;
    const to = options.to ?? Number.MAX_SAFE_INTEGER;

    const statement = this.database.prepare(`
      SELECT
        container_id AS containerId,
        sampled_at AS sampledAt,
        cpu_percent AS cpuPercent,
        online_cpus AS onlineCpus,
        memory_usage_bytes AS memoryUsageBytes,
        raw_memory_usage_bytes AS rawMemoryUsageBytes,
        memory_limit_bytes AS memoryLimitBytes,
        memory_percent AS memoryPercent,
        block_read_bytes AS blockReadBytes,
        block_write_bytes AS blockWriteBytes,
        network_rx_bytes AS networkRxBytes,
        network_tx_bytes AS networkTxBytes,
        size_rw_bytes AS sizeRwBytes,
        size_root_fs_bytes AS sizeRootFsBytes
      FROM telemetry_samples
      WHERE container_id = ? AND sampled_at >= ? AND sampled_at <= ?
      ORDER BY sampled_at ASC
      LIMIT ?
    `);

    return statement.all(containerId, from, to, limit);
  }

  listContainers() {
    if (this.closed) throw new Error('TelemetryStore is closed');

    return this.database.prepare(`
      SELECT id, name, image, first_seen AS firstSeen, last_seen AS lastSeen
      FROM containers
      ORDER BY last_seen DESC
    `).all();
  }

  close() {
    if (this.closed) return 0;

    let flushed = 0;
    if (this.queue.length > 0) {
      flushed = this.flush();
    }

    this.closed = true;
    this.database.close();
    return flushed;
  }

  normalizeTimestamp(timestamp) {
    if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
      return timestamp;
    }

    if (typeof timestamp === 'string') {
      const parsed = Date.parse(timestamp);
      if (Number.isFinite(parsed)) return parsed;
    }

    return Date.now();
  }

  toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  toInteger(value, fallback = 0) {
    return Math.trunc(this.toNumber(value, fallback));
  }

  toNullableInteger(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : null;
  }
}
