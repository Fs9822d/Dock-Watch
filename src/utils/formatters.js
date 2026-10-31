/**
 * Format raw bytes into human-readable units (B, KB, MB, GB, TB)
 * @param {number} bytes
 * @param {number} decimals
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 1) {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) {
    return '0 B';
  }
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeIndex = Math.min(i, sizes.length - 1);
  const value = bytes / Math.pow(k, safeIndex);

  return `${value.toFixed(dm)} ${sizes[safeIndex]}`;
}

/**
 * Format percentage
 * @param {number} percent
 * @param {number} decimals
 * @returns {string}
 */
export function formatPercent(percent, decimals = 1) {
  if (percent === null || percent === undefined || isNaN(percent) || percent < 0) {
    return '0.0%';
  }
  return `${percent.toFixed(decimals)}%`;
}

/**
 * Get color token based on percentage load
 * @param {number} percent
 * @returns {'green' | 'yellow' | 'red'}
 */
export function getMetricColor(percent) {
  if (percent >= 85) return 'red';
  if (percent >= 60) return 'yellow';
  return 'green';
}

/**
 * Truncate string with ellipsis
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
export function truncate(str, maxLen = 20) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/**
 * Clean container name (Docker names usually start with '/')
 * @param {string|string[]} names
 * @returns {string}
 */
export function cleanContainerName(names) {
  if (!names) return 'unknown';
  const name = Array.isArray(names) ? names[0] : names;
  return name.startsWith('/') ? name.slice(1) : name;
}
