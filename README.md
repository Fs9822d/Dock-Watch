# dock-watch

`dock-watch` is a terminal user interface (TUI) for inspecting Docker or
Podman containers and watching their live resource usage. It connects directly
to the container engine over its UNIX domain socket and displays container
state, CPU, memory, storage, block I/O, and network metrics.

The application is intentionally small: it uses Node.js, React, Ink, and
Node's built-in HTTP client. It does not require a separate backend service.

## Features

- Lists running and stopped containers.
- Polls live container telemetry once per second.
- Displays CPU usage and online CPU count.
- Displays memory usage after subtracting inactive filesystem cache.
- Displays writable container storage and virtual root filesystem size.
- Aggregates block-device read and write totals.
- Aggregates network receive and transmit totals across interfaces.
- Expands a container inspector with image, state, ports, command, and metrics.
- Automatically reconnects when the Docker socket becomes unavailable.
- Supports Docker Desktop, standard Docker sockets, and rootless Docker/Podman
  socket locations.
- Allows an explicit socket path through the command line.

## Requirements

- Node.js with support for the `node22` build target.
- npm.
- Docker or Podman running locally.
- Read/write access to the engine UNIX socket.

The most common Docker socket is:

```text
/var/run/docker.sock
```

On Linux, access to this socket is commonly restricted to `root` and members
of the `docker` group. If dock-watch cannot connect, check both that the
daemon is running and that the current user can access the socket.

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Fs9822d/Dock-Watch.git
cd Dock-Watch
npm install
```

## Running

Build the bundled executable:

```bash
npm run build
```

Start the application:

```bash
npm start
```

The build writes the bundled executable to `dist/dock-watch.js`. The package
also exposes the `dock-watch` command when installed or linked as a package.

For local development, rebuild after source changes:

```bash
npm run build
node dist/dock-watch.js
```

`npm run dev` currently runs the already-built file; it does not watch or
rebuild source files automatically.

## Command-line options

```text
dock-watch [OPTIONS]

  -s, --socket <path>   Use an explicit Docker/Podman UNIX socket
  -h, --help            Show help
  -v, --version         Show the version
```

Examples:

```bash
dock-watch --socket /var/run/docker.sock
dock-watch --socket "$XDG_RUNTIME_DIR/podman/podman.sock"
```

## Socket discovery

Unless `--socket` is supplied, dock-watch searches in this order:

1. A UNIX socket supplied by `--socket`.
2. The path in `DOCKER_HOST`, including `unix:///...` values.
3. `/var/run/docker.sock`.
4. User-level Docker and Podman socket paths under `XDG_RUNTIME_DIR`.
5. `/run/user/<uid>/docker.sock`.
6. `/run/user/<uid>/podman/podman.sock`.
7. macOS Docker Desktop's `~/.docker/run/docker.sock`.

Only local absolute UNIX socket paths are supported by the resolver. TCP
Docker hosts such as `tcp://127.0.0.1:2375` are not interpreted as socket
paths.

If no usable socket is found, the UI shows the paths it checked and retries
the connection automatically.

## Keyboard controls

| Key | Action |
| --- | --- |
| `↑` / `↓` | Select a container |
| `Enter` / `Space` | Expand or collapse the selected container inspector |
| `r` | Refresh immediately |
| `q` | Quit |

## How it works

The application follows this flow:

```text
CLI arguments
    ↓
React/Ink application
    ↓
Docker socket resolution
    ↓
Docker daemon health check
    ↓
List containers
    ↓
Fetch stats for running containers
    ↓
Normalize raw Docker stats
    ↓
Render the TUI
```

### Polling intervals

- Container telemetry: every 1 second.
- Storage sizes: every 15 seconds.
- Reconnection attempts: every 2 seconds while disconnected.

Storage sizes are fetched less frequently because Docker may need additional
work to calculate `SizeRw` and `SizeRootFs`. The latest storage values are
cached between telemetry polls.

## Project structure

```text
src/
├── index.jsx                    CLI entry point and process lifecycle
├── client/
│   ├── docker-client.js         Docker HTTP client over a UNIX socket
│   └── socket-resolver.js       Socket discovery and validation
├── telemetry/
│   └── stats-parser.js          Raw Docker stats normalization
├── ui/
│   ├── App.jsx                  Application state and polling orchestration
│   ├── ContainerTable.jsx       Main container table
│   ├── ContainerDetail.jsx      Expandable container inspector
│   ├── Header.jsx               Connection and container summary
│   ├── Footer.jsx               Keyboard controls and last sync time
│   └── DisconnectedView.jsx     Socket failure and reconnect screen
└── utils/
    ├── constants.js             Socket paths and polling intervals
    └── formatters.js            Byte, percentage, name, and color helpers

tests/
├── docker-client.test.js
├── formatters.test.js
├── socket-resolver.test.js
└── stats-parser.test.js
```

## Important implementation details

### Docker client

[`src/client/docker-client.js`](src/client/docker-client.js) uses
`node:http` with the `socketPath` option. It calls Docker endpoints including:

- `/_ping`
- `/containers/json`
- `/containers/{id}/stats?stream=0`
- `/containers/{id}/json`

Stats are requested as single snapshots rather than a streaming response.

### Telemetry parsing

[`src/telemetry/stats-parser.js`](src/telemetry/stats-parser.js) converts
Docker's raw response into a stable shape:

```js
{
  timestamp,
  cpu: { percent, onlineCpus },
  memory: {
    usageBytes,
    rawUsageBytes,
    limitBytes,
    percent
  },
  storage: {
    blockReadBytes,
    blockWriteBytes,
    sizeRwBytes,
    sizeRootFsBytes
  },
  network: {
    rxBytes,
    txBytes
  }
}
```

CPU percentage is calculated from the difference between current and previous
CPU counters. Memory usage subtracts inactive file cache and supports both
cgroups v1 and cgroups v2 field names. Block I/O and network values are
aggregated across all reported devices and interfaces.

### UI state

[`src/ui/App.jsx`](src/ui/App.jsx) owns the connection and polling lifecycle.
It keeps the Docker client in a ref, prevents overlapping telemetry requests,
stores storage-size results in a cache, and switches between connected and
disconnected views.

The final `main().catch(...)` in [`src/index.jsx`](src/index.jsx) is a
process-level safety net for errors that escape the application lifecycle. It
logs the error and exits with status `1`.

## Testing

Run the test suite with:

```bash
npm test
```

The tests use Node's built-in test runner and cover:

- Docker client request and response behavior.
- Socket path resolution.
- Formatting helpers.
- CPU, memory, block I/O, and network telemetry parsing.

When changing telemetry calculations or socket resolution, update the focused
tests in `tests/` alongside the implementation.

## Troubleshooting

### “No accessible Docker or Podman socket found”

Check whether the daemon is running:

```bash
docker info
```

For rootless Podman:

```bash
systemctl --user start podman.socket
podman info
```

For a non-standard socket, pass it explicitly:

```bash
dock-watch --socket /path/to/docker.sock
```

### Permission denied on `/var/run/docker.sock`

Verify the socket permissions:

```bash
ls -l /var/run/docker.sock
```

Use the normal Docker group configuration for your system, or run the
application with an account that has permission to access the socket. Avoid
changing socket permissions broadly just to make the application connect.

### The UI is empty

The table includes all containers returned by Docker, but live telemetry is
only requested for containers whose state is `running`. If there are no
containers, or if all containers are stopped, the UI will not show live
metrics.

### The source changes are not visible

The application runs the bundled file in `dist/`. Rebuild before starting:

```bash
npm run build
npm start
```

## Development guidelines

Keep responsibilities separated:

- Put Docker protocol and socket concerns in `src/client/`.
- Put metric conversion in `src/telemetry/`.
- Put rendering and interaction in `src/ui/`.
- Put shared constants and display helpers in `src/utils/`.

Prefer adding a focused test when changing behavior. Run `npm test` and
`npm run build` before submitting changes.

## License

This project is released under the MIT license.
