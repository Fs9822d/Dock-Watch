import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { resolveDockerSocket } from '../client/socket-resolver.js';
import { DockerClient } from '../client/docker-client.js';
import { parseContainerStats } from '../telemetry/stats-parser.js';
import { cleanContainerName } from '../utils/formatters.js';
import { POLL_INTERVAL_MS, STORAGE_REFRESH_INTERVAL_MS } from '../utils/constants.js';
import { Header } from './Header.jsx';
import { ContainerTable } from './ContainerTable.jsx';
import { DisconnectedView } from './DisconnectedView.jsx';
import { Footer } from './Footer.jsx';

export function App({
  cliSocketPath = null,
  initialColumns = null,
  forcedColumns = null,
  resizeTick = 0,
}) {
  const { exit } = useApp();

  const columns = forcedColumns || initialColumns || process.stdout.columns || 120;
  const [status, setStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected'
  const [socketPath, setSocketPath] = useState(null);
  const [checkedPaths, setCheckedPaths] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);

  const [containers, setContainers] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [countdown, setCountdown] = useState(2);

  // References to preserve data across polling ticks
  const clientRef = useRef(null);
  const storageCacheRef = useRef(new Map()); // containerId -> { sizeRw, sizeRootFs, lastFetched }
  const isFetchingRef = useRef(false);

  // Initialize or attempt connection
  const attemptConnection = useCallback(async () => {
    const resolution = resolveDockerSocket(cliSocketPath);
    setCheckedPaths(resolution.checkedPaths);

    if (!resolution.socketPath) {
      setStatus('disconnected');
      setErrorMsg(resolution.error || 'No valid Docker socket found.');
      setCountdown(2);
      return;
    }

    const client = new DockerClient(resolution.socketPath);
    const alive = await client.ping();

    if (alive) {
      clientRef.current = client;
      setSocketPath(resolution.socketPath);
      setStatus('connected');
      setErrorMsg(null);
    } else {
      setStatus('disconnected');
      setErrorMsg(`Socket exists at ${resolution.socketPath} but daemon failed health check ping.`);
      setCountdown(2);
    }
  }, [cliSocketPath]);

  // Primary Telemetry & Container Polling Loop
  const pollTelemetry = useCallback(async () => {
    if (!clientRef.current || isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const rawList = await clientRef.current.listContainers({ all: true });

      const updatedContainers = await Promise.all(
        rawList.map(async (raw) => {
          const id = raw.Id;
          const name = cleanContainerName(raw.Names);
          const image = raw.Image;
          const state = raw.State;
          const statusText = raw.Status;

          let parsedStats = null;
          // Only fetch live stats if container is active
          if (state === 'running') {
            try {
              const rawStats = await clientRef.current.getContainerStats(id);
              const cachedStorage = storageCacheRef.current.get(id) || {};
              parsedStats = parseContainerStats(rawStats, cachedStorage);
            } catch {
              // Container might have stopped during fetch
              parsedStats = null;
            }
          }

          return {
            id,
            name,
            image,
            state,
            status: statusText,
            command: raw.Command,
            Ports: raw.Ports,
            stats: parsedStats,
          };
        })
      );

      setContainers(updatedContainers);
      setLastUpdated(new Date());
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') {
        setStatus('disconnected');
        setErrorMsg(`Docker socket disconnected: ${err.message}`);
        setCountdown(2);
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  // Periodic Storage Size Fetch (Runs every 15s to minimize daemon disk I/O)
  const pollStorageSizes = useCallback(async () => {
    if (!clientRef.current) return;

    try {
      // Query containers with size=true
      const listWithSize = await clientRef.current.listContainers({ all: true, size: true });
      for (const item of listWithSize) {
        if (item.Id) {
          storageCacheRef.current.set(item.Id, {
            sizeRw: item.SizeRw ?? null,
            sizeRootFs: item.SizeRootFs ?? null,
            lastFetched: Date.now(),
          });
        }
      }
    } catch {
      // Non-fatal, storage size update skipped for this cycle
    }
  }, []);

  // Initial connection mount
  useEffect(() => {
    attemptConnection();
  }, [attemptConnection]);

  // Telemetry Interval (1 second)
  useEffect(() => {
    if (status !== 'connected') return;

    pollTelemetry();
    pollStorageSizes();

    const telemetryTimer = setInterval(pollTelemetry, POLL_INTERVAL_MS);
    const storageTimer = setInterval(pollStorageSizes, STORAGE_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(telemetryTimer);
      clearInterval(storageTimer);
    };
  }, [status, pollTelemetry, pollStorageSizes]);

  // Reconnection Countdown Timer (When disconnected)
  useEffect(() => {
    if (status !== 'disconnected') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          attemptConnection();
          return 2;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, attemptConnection]);

  // Keyboard navigation & controls
  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }

    if (input === 'r') {
      if (status === 'disconnected') {
        attemptConnection();
      } else {
        pollTelemetry();
        pollStorageSizes();
      }
      return;
    }

    if (status !== 'connected' || containers.length === 0) return;

    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : containers.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev < containers.length - 1 ? prev + 1 : 0));
    } else if (key.return || input === ' ') {
      const current = containers[selectedIndex];
      if (current) {
        setExpandedId((prev) => (prev === current.id ? null : current.id));
      }
    }
  });

  const runningCount = containers.filter((c) => c.state === 'running').length;

  if (columns < 46) {
    return (
      <Box borderStyle="single" borderColor="yellow" padding={1} margin={1} flexDirection="column">
        <Text bold color="yellow">⚠️  TERMINAL WINDOW TOO NARROW</Text>
        <Text dimColor>Current width: {columns} cols. Minimum required: 46 cols.</Text>
        <Text dimColor>Please expand your terminal window.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        socketPath={socketPath}
        isConnected={status === 'connected'}
        runningCount={runningCount}
        totalCount={containers.length}
        columns={columns}
      />

      {status === 'connecting' ? (
        <Box borderStyle="single" borderColor="cyan" padding={1} marginY={1} justifyContent="center">
          <Text color="cyan">🔍 Discovering Docker daemon socket...</Text>
        </Box>
      ) : status === 'disconnected' ? (
        <DisconnectedView
          checkedPaths={checkedPaths}
          countdown={countdown}
          error={errorMsg}
          columns={columns}
        />
      ) : (
        <ContainerTable
          containers={containers}
          selectedIndex={selectedIndex}
          expandedId={expandedId}
          columns={columns}
        />
      )}

      <Footer lastUpdated={lastUpdated} isConnected={status === 'connected'} columns={columns} />
    </Box>
  );
}
