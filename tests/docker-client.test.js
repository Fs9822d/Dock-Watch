import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DockerClient } from '../src/client/docker-client.js';

test('DockerClient communicates over UNIX domain socket', async () => {
  const tmpSocketPath = path.join(os.tmpdir(), `test-docker-http-${Date.now()}.sock`);

  // Mock Docker HTTP daemon
  const server = http.createServer((req, res) => {
    if (req.url === '/_ping') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    } else if (req.url?.startsWith('/containers/json')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify([
          {
            Id: 'a1b2c3d4e5f6',
            Names: ['/web-server'],
            Image: 'nginx:alpine',
            State: 'running',
            Status: 'Up 2 hours',
          },
        ])
      );
    } else if (req.url?.includes('/stats')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          read: '2026-10-26T20:00:00Z',
          memory_stats: { usage: 104857600, limit: 1073741824 },
        })
      );
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Not found' }));
    }
  });

  await new Promise((resolve) => server.listen(tmpSocketPath, resolve));
  const client = new DockerClient(tmpSocketPath);

  try {
    // 1. Ping
    const pingOk = await client.ping();
    assert.equal(pingOk, true);

    // 2. List Containers
    const containers = await client.listContainers();
    assert.equal(Array.isArray(containers), true);
    assert.equal(containers.length, 1);
    assert.equal(containers[0].Names[0], '/web-server');

    // 3. Stats
    const stats = await client.getContainerStats('a1b2c3d4e5f6');
    assert.equal(stats.memory_stats.usage, 104857600);

    // 4. 404 Error handling
    await assert.rejects(
      async () => client.request('/unknown-endpoint'),
      (err) => {
        assert.ok(err.message.includes('404'));
        return true;
      }
    );
  } finally {
    server.close();
    try {
      fs.unlinkSync(tmpSocketPath);
    } catch {}
  }
});
