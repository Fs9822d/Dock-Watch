import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.jsx';
import {
  ANSI_ENTER_ALT_SCREEN,
  ANSI_LEAVE_ALT_SCREEN,
  ANSI_CLEAR_VIEWPORT,
} from './utils/constants.js';

function parseCliArgs() {
  const args = process.argv.slice(2);
  const options = {
    socket: null,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--version' || arg === '-v') {
      options.version = true;
    } else if (arg === '--socket' || arg === '-s') {
      options.socket = args[++i];
    } else if (arg.startsWith('--socket=')) {
      options.socket = arg.split('=')[1];
    }
  }

  return options;
}

function showHelp() {
  console.log(`
dock-watch - Automated Flight Recorder & Diagnostics for Docker Containers

USAGE:
  dock-watch [OPTIONS]

OPTIONS:
  -s, --socket <path>   Explicit UNIX domain socket path (e.g. /var/run/docker.sock)
  -h, --help            Show this help manual
  -v, --version         Show dock-watch version

KEYBOARD CONTROLS:
  ↑ / ↓                 Navigate between active containers
  Enter / Space         Expand / Collapse container inspector
  r                     Force instant telemetry refresh
  q                     Quit dock-watch
`);
}

let isCleanedUp = false;
export function cleanup() {
  if (isCleanedUp) return;
  isCleanedUp = true;
  // Leave alternate screen buffer and restore cursor
  if (process.stdout.isTTY) {
    try {
      process.stdout.write(ANSI_LEAVE_ALT_SCREEN);
    } catch {
      // Ignore errors if stream is closed
    }
  }
}

async function main() {
  const options = parseCliArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (options.version) {
    console.log('dock-watch v1.0.0');
    process.exit(0);
  }

  // Enter the alternate screen buffer and reset cursor to home (1,1)
  // This isolates dock-watch from the shell scrollback history and prevents ghost line retention
  if (process.stdout.isTTY) {
    process.stdout.write(ANSI_ENTER_ALT_SCREEN);
  }

  // Render the Ink TUI
  const app = render(<App cliSocketPath={options.socket} />);

  // Handle terminal resizing (SIGWINCH): debounce, reset line count, clear viewport, and force rerender
  let resizeTimer = null;
  const handleResize = () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (typeof app.clear === 'function') {
        app.clear();
      }
      if (process.stdout.isTTY) {
        process.stdout.write(ANSI_CLEAR_VIEWPORT);
      }
      // Force rerender with fresh dimensions so vertical-only resize immediately repaints
      app.rerender(
        <App
          cliSocketPath={options.socket}
          forcedColumns={process.stdout.columns || 120}
          resizeTick={Date.now()}
        />
      );
    }, 60);
  };

  if (process.stdout.isTTY) {
    process.stdout.on('resize', handleResize);
  }

  const handleExit = () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    if (process.stdout.isTTY) {
      process.stdout.off('resize', handleResize);
    }
    app.unmount();
    cleanup();
    process.exit(0);
  };

  // Handle termination signals cleanly
  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
  process.on('SIGHUP', handleExit);
  process.on('exit', () => {
    cleanup();
  });

  try {
    await app.waitUntilExit();
  } finally {
    if (resizeTimer) clearTimeout(resizeTimer);
    if (process.stdout.isTTY) {
      process.stdout.off('resize', handleResize);
    }
    app.unmount();
    cleanup();
  }
}

process.on('unhandledRejection', (err) => {
  cleanup();
  console.error('Fatal dock-watch unhandled rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  cleanup();
  console.error('Fatal dock-watch uncaught exception:', err);
  process.exit(1);
});

main().catch((err) => {
  cleanup();
  console.error('Fatal dock-watch error:', err);
  process.exit(1);
});
