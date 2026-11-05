import fs from 'node:fs';
import { DEFAULT_SOCKET_PATHS } from '../utils/constants.js';

/**
 * Resolves the Docker or Podman daemon UNIX socket path.
 *
 * @param {string} [explicitPath] Optional path provided via CLI flag (--socket)
 * @returns {{ socketPath: string | null, checkedPaths: string[], error?: string }}
 */
export function resolveDockerSocket(explicitPath) {
  const checkedPaths = [];

  // 1. Explicit CLI argument
  if (explicitPath) {
    return resolveExplicit(explicitPath, checkedPaths);
  }

  // 2. DOCKER_HOST environment variable
  const envResult = resolveFromEnv(checkedPaths);
  if (envResult) {
    return { socketPath: envResult, checkedPaths };
  }

  // 3. Known default paths
  const defaultResult = resolveFromDefaults(checkedPaths);
  if (defaultResult) {
    return { socketPath: defaultResult, checkedPaths };
  }

  return {
    socketPath: null,
    checkedPaths,
    error: 'No accessible Docker or Podman socket found.',
  };
}

/**
 * Resolves an explicitly supplied socket path from CLI arguments.
 * @param {string} explicitPath
 * @param {string[]} checkedPaths
 * @returns {{ socketPath: string | null, checkedPaths: string[], error?: string }}
 */
function resolveExplicit(explicitPath, checkedPaths) {
  checkedPaths.push(explicitPath);
  if (isValidSocket(explicitPath)) {
    return { socketPath: explicitPath, checkedPaths };
  }
  return {
    socketPath: null,
    checkedPaths,
    error: `Explicit socket path does not exist or is not a socket: ${explicitPath}`,
  };
}

/**
 * Resolves socket path specified by DOCKER_HOST environment variable.
 * @param {string[]} checkedPaths
 * @returns {string | null}
 */
function resolveFromEnv(checkedPaths) {
  const rawHost = process.env.DOCKER_HOST;
  if (!rawHost) return null;

  let hostPath = rawHost;
  if (hostPath.startsWith('unix://')) {
    hostPath = hostPath.replace(/^unix:\/\//, '');
  }

  if (hostPath.startsWith('/')) {
    checkedPaths.push(hostPath);
    if (isValidSocket(hostPath)) {
      return hostPath;
    }
  }

  return null;
}

/**
 * Resolves socket path by iterating through known default platform paths.
 * @param {string[]} checkedPaths
 * @returns {string | null}
 */
function resolveFromDefaults(checkedPaths) {
  for (const candidate of DEFAULT_SOCKET_PATHS) {
    if (!candidate || checkedPaths.includes(candidate)) continue;
    checkedPaths.push(candidate);
    if (isValidSocket(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Checks whether the given path exists and is a valid socket or character device.
 * @param {string} socketPath
 * @returns {boolean}
 */
export function isValidSocket(socketPath) {
  try {
    const stat = fs.statSync(socketPath);
    return stat.isSocket() || stat.isCharacterDevice() || stat.isFIFO();
  } catch {
    return false;
  }
}
