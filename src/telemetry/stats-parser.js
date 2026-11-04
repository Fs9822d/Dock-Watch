/**
 * Parses raw Docker container stats JSON into clean, normalized metrics.
 *
 * @param {object} rawStats Raw payload from /containers/{id}/stats
 * @param {object} [extraInfo] Additional metadata such as storage size
 * @returns {object} Normalized telemetry metrics
 */
export function parseContainerStats(rawStats = {}, extraInfo = {}) {
  // 1. CPU Calculation
  const cpuStats = rawStats.cpu_stats || {};
  const preCpuStats = rawStats.precpu_stats || {};

  const cpuDelta =
    (cpuStats.cpu_usage?.total_usage || 0) - (preCpuStats.cpu_usage?.total_usage || 0);
  const systemDelta =
    (cpuStats.system_cpu_usage || 0) - (preCpuStats.system_cpu_usage || 0);
  const onlineCpus =
    cpuStats.online_cpus ||
    (Array.isArray(cpuStats.cpu_usage?.percpu_usage)
      ? cpuStats.cpu_usage.percpu_usage.length
      : 1);

  let cpuPercent = 0.0;
  if (cpuDelta > 0 && systemDelta > 0) {
    cpuPercent = (cpuDelta / systemDelta) * onlineCpus * 100.0;
  }

  // 2. Memory Calculation
  const memStats = rawStats.memory_stats || {};
  const memDetails = memStats.stats || {};
  
  // Normalize inactive file cache (cgroups v1 vs v2)
  const inactiveFile =
    memDetails.inactive_file !== undefined
      ? memDetails.inactive_file
      : (memDetails.total_inactive_file || 0);

  const rawUsage = memStats.usage || 0;
  const memoryUsage = Math.max(0, rawUsage - inactiveFile);
  const memoryLimit = memStats.limit || 0;
  const memoryPercent = memoryLimit > 0 ? (memoryUsage / memoryLimit) * 100.0 : 0.0;

  // 3. Block I/O Calculation (Disk Read/Write)
  let blockReadBytes = 0;
  let blockWriteBytes = 0;
  const blkio = rawStats.blkio_stats?.io_service_bytes_recursive;

  if (Array.isArray(blkio)) {
    for (const entry of blkio) {
      const op = (entry.op || '').toLowerCase();
      if (op === 'read') {
        blockReadBytes += entry.value || 0;
      } else if (op === 'write') {
        blockWriteBytes += entry.value || 0;
      }
    }
  }

  // 4. Network I/O Calculation
  let networkRxBytes = 0;
  let networkTxBytes = 0;
  const networks = rawStats.networks;

  if (networks && typeof networks === 'object') {
    for (const iface of Object.values(networks)) {
      if (iface) {
        networkRxBytes += iface.rx_bytes || 0;
        networkTxBytes += iface.tx_bytes || 0;
      }
    }
  }

  // 5. Storage (Disk Layer Size)
  const sizeRw = extraInfo.sizeRw ?? null;
  const sizeRootFs = extraInfo.sizeRootFs ?? null;

  return {
    timestamp: rawStats.read || new Date().toISOString(),
    cpu: {
      percent: Math.min(cpuPercent, onlineCpus * 100.0),
      onlineCpus,
    },
    memory: {
      usageBytes: memoryUsage,
      rawUsageBytes: rawUsage,
      limitBytes: memoryLimit,
      percent: Math.min(memoryPercent, 100.0),
    },
    storage: {
      blockReadBytes,
      blockWriteBytes,
      sizeRwBytes: sizeRw,
      sizeRootFsBytes: sizeRootFs,
    },
    network: {
      rxBytes: networkRxBytes,
      txBytes: networkTxBytes,
    },
  };
}
