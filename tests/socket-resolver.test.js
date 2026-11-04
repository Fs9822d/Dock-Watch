import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveDockerSocket, isValidSocket } from '../src/client/socket-resolver.js';

test('resolveDockerSocket handles explicit invalid path', () => {
  const result = resolveDockerSocket('/non/existent/path.sock');
  assert.equal(result.socketPath, null);
  assert.ok(result.checkedPaths.includes('/non/existent/path.sock'));
  assert.ok(result.error.includes('does not exist'));
});

test('resolveDockerSocket identifies active UNIX domain socket', async () => {
  const tmpSocketPath = path.join(os.tmpdir(), `test-mock-${Date.now()}.sock`);

  // Create real temporary UNIX socket server
  const server = net.createServer();
  await new Promise((resolve) => server.listen(tmpSocketPath, resolve));

  try {
    assert.equal(isValidSocket(tmpSocketPath), true);
    const result = resolveDockerSocket(tmpSocketPath);
    assert.equal(result.socketPath, tmpSocketPath);
  } finally {
    server.close();
    try {
      fs.unlinkSync(tmpSocketPath);
    } catch {}
  }
});

test('resolveDockerSocket lists candidates if no socket is available', () => {
  const result = resolveDockerSocket();
  assert.ok(Array.isArray(result.checkedPaths));
  assert.ok(result.checkedPaths.length > 0);
  assert.ok(result.checkedPaths.includes('/var/run/docker.sock'));
});
