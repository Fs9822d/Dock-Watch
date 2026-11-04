import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.jsx';

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

  // Render the Ink TUI
  const app = render(<App cliSocketPath={options.socket} />);

  // Handle termination signals cleanly
  process.on('SIGINT', () => {
    app.unmount();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    app.unmount();
    process.exit(0);
  });

  await app.waitUntilExit();
}

main().catch((err) => {
  console.error('Fatal dock-watch error:', err);
  process.exit(1);
});
