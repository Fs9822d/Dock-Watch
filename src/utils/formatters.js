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

/**
 * Calculate dynamic table column widths and layout mode based on terminal columns
 * @param {number} [terminalWidth=120]
 * @returns {{
 *   mode: 'full' | 'compact' | 'minimal',
 *   showStorage: boolean,
 *   compactStorage: boolean,
 *   columns: {
 *     selector: number,
 *     name: number,
 *     image: number,
 *     status: number,
 *     cpu: number,
 *     ram: number,
 *     storage: number,
 *   },
 *   totalWidth: number,
 * }}
 */
export function getResponsiveLayout(terminalWidth = 120) {
  const width =
    typeof terminalWidth === 'number' && !isNaN(terminalWidth) && terminalWidth > 0
      ? terminalWidth
      : 120;

  if (width >= 115) {
    const isWide = width >= 125;
    const columns = {
      selector: 3,
      name: isWide ? 20 : 18,
      image: isWide ? 22 : 20,
      status: isWide ? 14 : 12,
      cpu: isWide ? 10 : 8,
      ram: 24,
      storage: 24,
    };
    const totalWidth = Object.values(columns).reduce((sum, w) => sum + w, 0);
    return {
      mode: 'full',
      showStorage: true,
      compactStorage: false,
      columns,
      totalWidth,
    };
  }

  if (width >= 90) {
    const isMedium = width >= 100;
    const columns = {
      selector: 3,
      name: isMedium ? 16 : 15,
      image: isMedium ? 16 : 15,
      status: isMedium ? 12 : 11,
      cpu: isMedium ? 8 : 7,
      ram: 20,
      storage: isMedium ? 14 : 12,
    };
    const totalWidth = Object.values(columns).reduce((sum, w) => sum + w, 0);
    return {
      mode: 'compact',
      showStorage: true,
      compactStorage: true,
      columns,
      totalWidth,
    };
  }

  // Minimal mode (width < 90) - hide Storage column to prevent line-wrapping
  const isNarrow = width < 75;
  const isVeryNarrow = width < 65;
  const isUltraNarrow = width < 56;
  const columns = {
    selector: isUltraNarrow ? 2 : 3,
    name: isUltraNarrow ? 8 : (isVeryNarrow ? 10 : (isNarrow ? 12 : 14)),
    image: isUltraNarrow ? 8 : (isVeryNarrow ? 10 : (isNarrow ? 12 : 14)),
    status: isUltraNarrow ? 7 : (isVeryNarrow ? 8 : (isNarrow ? 9 : 10)),
    cpu: isUltraNarrow ? 5 : (isVeryNarrow ? 6 : 7),
    ram: isUltraNarrow ? 12 : (isVeryNarrow ? 15 : (isNarrow ? 16 : 18)),
    storage: 0,
  };
  const totalWidth = Object.values(columns).reduce((sum, w) => sum + w, 0);
  return {
    mode: 'minimal',
    showStorage: false,
    compactStorage: false,
    columns,
    totalWidth,
  };
}

export const calculateTableLayout = getResponsiveLayout;

