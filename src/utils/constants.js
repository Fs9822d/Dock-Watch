import path from 'node:path';
import os from 'node:os';

export const DEFAULT_SOCKET_PATHS = [
  // Standard system Docker daemon socket
  '/var/run/docker.sock',
  // Podman / Docker user rootless socket locations
  process.env.XDG_RUNTIME_DIR ? path.join(process.env.XDG_RUNTIME_DIR, 'docker.sock') : null,
  process.env.XDG_RUNTIME_DIR ? path.join(process.env.XDG_RUNTIME_DIR, 'podman/podman.sock') : null,
  typeof process.getuid === 'function' ? `/run/user/${process.getuid()}/docker.sock` : null,
  typeof process.getuid === 'function' ? `/run/user/${process.getuid()}/podman/podman.sock` : null,
  // macOS default Docker Desktop socket
  path.join(os.homedir(), '.docker/run/docker.sock'),
].filter(Boolean);

export const POLL_INTERVAL_MS = 1000;
export const STORAGE_REFRESH_INTERVAL_MS = 15000;

export const ANSI_ENTER_ALT_SCREEN = '\x1b[?1049h\x1b[H';
export const ANSI_LEAVE_ALT_SCREEN = '\x1b[?1049l\x1b[?25h';
export const ANSI_CLEAR_VIEWPORT = '\x1b[2J\x1b[H';
export const ANSI_CLEAR_SCREEN_AND_SCROLLBACK = ANSI_CLEAR_VIEWPORT;


