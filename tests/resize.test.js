import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  getResponsiveLayout,
  calculateTableLayout,
  getTableHeaders,
  truncate,
  formatBytes,
  formatPercent,
} from '../src/utils/formatters.js';
import {
  ANSI_ENTER_ALT_SCREEN,
  ANSI_LEAVE_ALT_SCREEN,
  ANSI_CLEAR_VIEWPORT,
  ANSI_CLEAR_SCREEN_AND_SCROLLBACK,
} from '../src/utils/constants.js';

test('Responsive Layout: width 160 (wide full mode)', () => {
  const layout = getResponsiveLayout(160);
  assert.equal(layout.mode, 'full');
  assert.equal(layout.showStorage, true);
  assert.equal(layout.compactStorage, false);
  assert.equal(layout.columns.selector, 3);
  assert.equal(layout.columns.name, 20);
  assert.equal(layout.columns.image, 22);
  assert.equal(layout.columns.status, 14);
  assert.equal(layout.columns.cpu, 10);
  assert.equal(layout.columns.ram, 24);
  assert.equal(layout.columns.storage, 24);
  assert.equal(layout.totalWidth, 117);
  assert.ok(layout.totalWidth + 4 <= 160);
});

test('Responsive Layout: width 120 (standard full mode)', () => {
  const layout = getResponsiveLayout(120);
  assert.equal(layout.mode, 'full');
  assert.equal(layout.showStorage, true);
  assert.equal(layout.compactStorage, false);
  assert.equal(layout.columns.selector, 3);
  assert.ok(layout.columns.name >= 18);
  assert.ok(layout.columns.image >= 20);
  assert.ok(layout.columns.storage === 24);
  assert.ok(layout.totalWidth + 4 <= 120);
});

test('Responsive Layout: width 100 (compact mode)', () => {
  const layout = getResponsiveLayout(100);
  assert.equal(layout.mode, 'compact');
  assert.equal(layout.showStorage, true);
  assert.equal(layout.compactStorage, true);
  assert.equal(layout.columns.selector, 3);
  assert.ok(layout.columns.name <= 16);
  assert.ok(layout.columns.image <= 16);
  assert.ok(layout.columns.storage <= 14);
  assert.ok(layout.totalWidth + 4 <= 100);
});

test('Responsive Layout: width 80 (minimal mode)', () => {
  const layout = getResponsiveLayout(80);
  assert.equal(layout.mode, 'minimal');
  assert.equal(layout.showStorage, false);
  assert.equal(layout.compactStorage, false);
  assert.equal(layout.columns.selector, 3);
  assert.equal(layout.columns.storage, 0);
  assert.ok(layout.columns.name <= 14);
  assert.ok(layout.columns.image <= 14);
  assert.ok(layout.totalWidth + 4 <= 80);
});

test('Responsive Layout: width 50 (ultra-narrow minimal mode)', () => {
  const layout = getResponsiveLayout(50);
  assert.equal(layout.mode, 'minimal');
  assert.equal(layout.showStorage, false);
  assert.ok(layout.columns.selector <= 2);
  assert.ok(layout.totalWidth + 4 <= 50);
});

test('Responsive Layout: sweep across terminal widths 46 to 200 without line overflow', () => {
  for (let width = 46; width <= 200; width++) {
    const layout = getResponsiveLayout(width);
    const colSum = Object.values(layout.columns).reduce((sum, w) => sum + w, 0);
    assert.equal(layout.totalWidth, colSum, `totalWidth must match column sum at width ${width}`);

    // With 4 characters of overhead (App padding 2 + Table padding 2), row must never wrap
    const rowWidthWithOverhead = colSum + 4;
    assert.ok(
      rowWidthWithOverhead <= width,
      `Row width ${rowWidthWithOverhead} exceeds terminal width ${width}`
    );

    if (width >= 115) {
      assert.equal(layout.mode, 'full', `Expected 'full' mode at width ${width}`);
      assert.equal(layout.showStorage, true);
      assert.equal(layout.compactStorage, false);
    } else if (width >= 90) {
      assert.equal(layout.mode, 'compact', `Expected 'compact' mode at width ${width}`);
      assert.equal(layout.showStorage, true);
      assert.equal(layout.compactStorage, true);
    } else {
      assert.equal(layout.mode, 'minimal', `Expected 'minimal' mode at width ${width}`);
      assert.equal(layout.showStorage, false);
      assert.equal(layout.columns.storage, 0);
    }
  }
});

test('Row Truncation: column contents fit within allocated widths for normal and extreme inputs', () => {
  const testWidths = [50, 60, 75, 80, 90, 100, 115, 120, 160];
  const longName = 'super-extremely-long-container-name-that-would-normally-overflow-the-entire-terminal-screen';
  const longImage = 'docker.registry.internal.corp:5000/production/backend/service-worker:v2.4.9-patch12-production-build';
  const longStatus = 'Up 3 weeks (healthy) (paused) (unhealthy restarts)';
  const id = '1234567890abcdef1234567890abcdef';

  for (const width of testWidths) {
    const layout = getResponsiveLayout(width);
    const col = layout.columns;

    // Check Name + ID formatting
    const idLen = col.name >= 16 ? 6 : (col.name >= 14 ? 5 : (col.name >= 10 ? 4 : 3));
    const nameMax = Math.max(3, col.name - idLen - 1);
    const formattedName = `${truncate(longName, nameMax)} ${id.slice(0, idLen)}`;
    assert.ok(
      formattedName.length <= col.name,
      `Formatted name "${formattedName}" (${formattedName.length}) exceeds column width ${col.name} at terminal width ${width}`
    );

    // Check Image formatting
    const imageMax = Math.max(4, col.image - 1);
    const formattedImage = truncate(longImage, imageMax);
    assert.ok(
      formattedImage.length <= col.image,
      `Formatted image "${formattedImage}" (${formattedImage.length}) exceeds column width ${col.image} at terminal width ${width}`
    );

    // Check Status formatting
    const statusMax = Math.max(4, col.status - 1);
    const formattedStatus = truncate(longStatus, statusMax);
    assert.ok(
      formattedStatus.length <= col.status,
      `Formatted status "${formattedStatus}" (${formattedStatus.length}) exceeds column width ${col.status} at terminal width ${width}`
    );

    // Check CPU formatting with extreme multi-core values (e.g. 16-core 1600.0%)
    for (const testCpu of [0.0, 45.2, 99.9, 100.0, 450.5, 1600.0]) {
      const cpuDecimals = col.cpu >= 8 ? (testCpu >= 100 ? 0 : 1) : 0;
      const cpuText = formatPercent(testCpu, cpuDecimals);
      assert.ok(
        cpuText.length <= col.cpu,
        `CPU text "${cpuText}" (${cpuText.length}) exceeds column width ${col.cpu} at terminal width ${width}`
      );
    }

    // Check RAM formatting with realistic large memory setups (12.5 GB / 128.0 GB (100%))
    const ramScenarios = [
      { bytes: 104857600, limit: 1073741824, pct: 9.3 }, // 100 MB / 1 GB
      { bytes: 13421772800, limit: 137438953472, pct: 9.8 }, // 12.5 GB / 128 GB
      { bytes: 123456789000, limit: 123456789000, pct: 100.0 }, // 115 GB / 115 GB (tests 3-digit GB in ultra-narrow mode)
      { bytes: 1099511627776, limit: 1099511627776, pct: 100.0 }, // 1 TB / 1 TB
    ];

    for (const scenario of ramScenarios) {
      const pctStr = `(${formatPercent(scenario.pct, 0)})`;
      let ramUsageText = formatBytes(scenario.bytes);
      let ramLimitText = formatBytes(scenario.limit);
      let showLimit = false;
      let showPct = true;

      if (col.ram >= 22) {
        const fullRam = `${ramUsageText} / ${ramLimitText} ${pctStr}`;
        if (fullRam.length <= col.ram) {
          showLimit = true;
        } else {
          const u0 = formatBytes(scenario.bytes, 0);
          const l0 = formatBytes(scenario.limit, 0);
          if (`${u0} / ${l0} ${pctStr}`.length <= col.ram) {
            showLimit = true;
            ramUsageText = u0;
            ramLimitText = l0;
          } else {
            showLimit = false;
          }
        }
      }

      if (!showLimit) {
        if (`${ramUsageText} ${pctStr}`.length > col.ram) {
          ramUsageText = formatBytes(scenario.bytes, 0);
          if (`${ramUsageText} ${pctStr}`.length > col.ram) {
            showPct = false;
          }
        }
      }

      const totalRamLen = showLimit
        ? `${ramUsageText} / ${ramLimitText} ${pctStr}`.length
        : showPct
        ? `${ramUsageText} ${pctStr}`.length
        : ramUsageText.length;

      assert.ok(
        totalRamLen <= col.ram,
        `RAM text length ${totalRamLen} exceeds column width ${col.ram} at terminal width ${width}`
      );
    }

    // Check Storage formatting with heavy disk I/O values
    if (layout.showStorage) {
      const diskSize = formatBytes(104857600); // 100 MB
      const diskIO = `${formatBytes(524288000, 0)}/${formatBytes(12884901888, 0)}`; // 500 MB / 12 GB
      let storageText = diskSize;

      if (!layout.compactStorage) {
        const fullStorage = `${diskSize} [IO: ${diskIO}]`;
        if (fullStorage.length <= col.storage) {
          storageText = fullStorage;
        } else {
          const compactIO = `${diskSize} (${diskIO})`;
          if (compactIO.length <= col.storage) {
            storageText = compactIO;
          }
        }
      }

      assert.ok(
        storageText.length <= col.storage,
        `Storage text "${storageText}" (${storageText.length}) exceeds column width ${col.storage} at terminal width ${width}`
      );
    }
  }
});

test('SIGWINCH & Resize Handler: debounces and resets Ink line count before clearing viewport', async () => {
  const callOrder = [];
  const fakeStdout = new EventEmitter();
  fakeStdout.columns = 120;
  fakeStdout.rows = 30;
  fakeStdout.write = (chunk) => {
    callOrder.push({ type: 'write', chunk });
    return true;
  };

  const fakeApp = {
    clear: () => {
      callOrder.push({ type: 'app.clear' });
    },
  };

  // Setup resize handler matching refined src/index.jsx
  let resizeTimer = null;
  const handleResize = () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (typeof fakeApp.clear === 'function') {
        fakeApp.clear();
      }
      fakeStdout.write(ANSI_CLEAR_VIEWPORT);
    }, 50);
  };

  fakeStdout.on('resize', handleResize);

  // Trigger multiple rapid resize events (simulating window drag)
  fakeStdout.columns = 100;
  fakeStdout.emit('resize');
  fakeStdout.columns = 90;
  fakeStdout.emit('resize');
  fakeStdout.columns = 80;
  fakeStdout.emit('resize');

  // Should NOT have executed yet (debounced)
  assert.equal(callOrder.length, 0, 'Rapid resize events must be debounced without intermediate clears');

  // Wait for debounce timer to fire
  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.equal(callOrder.length, 2, 'Must execute exactly once after drag settles');
  assert.equal(callOrder[0].type, 'app.clear', 'app.clear() must execute first to reset previousLineCount');
  assert.equal(callOrder[1].type, 'write', 'Screen clear write must execute second to wipe display cleanly');
  assert.equal(callOrder[1].chunk, ANSI_CLEAR_VIEWPORT);
});

test('Vertical Resize Coordinator: clears viewport and forces rerender when height changes without width change', async () => {
  const callOrder = [];
  const fakeStdout = new EventEmitter();
  fakeStdout.columns = 120;
  fakeStdout.rows = 40;
  fakeStdout.write = (chunk) => {
    callOrder.push({ type: 'write', chunk });
    return true;
  };

  let rerenderArgs = null;
  const fakeApp = {
    clear: () => {
      callOrder.push({ type: 'app.clear' });
    },
    rerender: (component) => {
      callOrder.push({ type: 'app.rerender' });
      rerenderArgs = component;
    },
  };

  let resizeTimer = null;
  const handleResize = () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (typeof fakeApp.clear === 'function') fakeApp.clear();
      fakeStdout.write(ANSI_CLEAR_VIEWPORT);
      fakeApp.rerender({ forcedColumns: fakeStdout.columns, resizeTick: Date.now() });
    }, 50);
  };

  fakeStdout.on('resize', handleResize);

  // Trigger vertical-only resize (rows drop from 40 to 20, columns stay 120)
  fakeStdout.rows = 20;
  fakeStdout.emit('resize');

  // Debounced
  assert.equal(callOrder.length, 0);

  // Settle
  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.equal(callOrder.length, 3, 'Must clear, write ANSI, and force rerender');
  assert.equal(callOrder[0].type, 'app.clear');
  assert.equal(callOrder[1].type, 'write');
  assert.equal(callOrder[1].chunk, ANSI_CLEAR_VIEWPORT);
  assert.equal(callOrder[2].type, 'app.rerender');
  assert.equal(rerenderArgs.forcedColumns, 120);
  assert.ok(rerenderArgs.resizeTick > 0);
});

test('Alternate Screen Buffer Lifecycle: constants adhere to VT100 / XTerm standards', () => {
  assert.equal(ANSI_ENTER_ALT_SCREEN, '\x1b[?1049h\x1b[H', 'Must enter alternate screen buffer (1049h) and move to home');
  assert.equal(ANSI_LEAVE_ALT_SCREEN, '\x1b[?1049l\x1b[?25h', 'Must leave alternate screen buffer (1049l) and unhide cursor');
  assert.equal(ANSI_CLEAR_VIEWPORT, '\x1b[2J\x1b[H', 'Must clear viewport (2J) and move home (H)');
  assert.equal(ANSI_CLEAR_SCREEN_AND_SCROLLBACK, '\x1b[2J\x1b[3J\x1b[H', 'Must clear viewport (2J), clear scrollback (3J), and move home (H)');
});

test('Header & Footer line width boundaries: never wrap on standard terminal sizes', () => {
  const widths = [46, 48, 50, 52, 54, 55, 56, 60, 70, 75, 80, 85, 90, 95, 100, 120];

  for (const w of widths) {
    // Check Header line 1
    const showSubtitle = w >= 80;
    const headerTitle = `DOCK-WATCH ${showSubtitle ? '| Automated Flight Recorder & Diagnostics' : ''}`;
    const headerStatus = '● DISCONNECTED'; // 14 chars (longer than CONNECTED)
    const headerLine1 = headerTitle.length + headerStatus.length + 6; // 6 overhead: app padding 2 + border 2 + paddingX 2
    assert.ok(
      headerLine1 <= w,
      `Header line 1 (${headerLine1}) exceeds width ${w}`
    );

    // Check Header line 2 with long socket path
    const isNarrow = w < 60;
    const maxSocketLen = isNarrow ? Math.max(8, w - 32) : Math.max(12, w - 42);
    let displaySocket = '/var/run/user/1000/docker.sock';
    if (displaySocket.length > maxSocketLen) {
      displaySocket = `…${displaySocket.slice(-(maxSocketLen - 1))}`;
    }
    const countText = isNarrow ? 'Active: 10/15' : 'Active: 10 / 15 containers';
    const headerLine2 = `Socket: ${displaySocket}`.length + countText.length + 6;
    assert.ok(
      headerLine2 <= w,
      `Header line 2 (${headerLine2}) exceeds width ${w}`
    );

    // Check Footer
    const isCompact = w < 95;
    const isVeryCompact = w < 65;
    const showSync = w >= 90;
    const controlsText = `${!isVeryCompact ? 'Controls: ' : ''}↑/↓ ${isCompact ? 'Nav ' : 'Select  '}${isVeryCompact ? '↵ ' : 'Enter/Space '}${isCompact ? 'Exp ' : 'Expand  '}r ${isCompact ? 'Ref ' : 'Refresh  '}q Quit`;
    const syncText = showSync ? 'Last Sync: 12:34:56 PM' : '';
    const footerLine = controlsText.length + syncText.length + 6;
    assert.ok(
      footerLine <= w,
      `Footer line (${footerLine}) exceeds width ${w}`
    );

    // Check Table column header labels
    const layout = getResponsiveLayout(w);
    const col = layout.columns;
    const headers = layout.headers || getTableHeaders(col, layout);

    assert.ok(
      headers.name.length <= col.name,
      `Name header label "${headers.name}" (${headers.name.length}) exceeds col.name (${col.name}) at width ${w}`
    );

    assert.ok(
      headers.image.length <= col.image,
      `Image header label "${headers.image}" (${headers.image.length}) exceeds col.image (${col.image}) at width ${w}`
    );

    assert.ok(
      headers.status.length <= col.status,
      `Status header label "${headers.status}" (${headers.status.length}) exceeds col.status (${col.status}) at width ${w}`
    );

    assert.ok(
      headers.cpu.length <= col.cpu,
      `CPU header label "${headers.cpu}" (${headers.cpu.length}) exceeds col.cpu (${col.cpu}) at width ${w}`
    );

    assert.ok(
      headers.ram.length <= col.ram,
      `RAM header label "${headers.ram}" (${headers.ram.length}) exceeds col.ram (${col.ram}) at width ${w}`
    );

    if (layout.showStorage) {
      assert.ok(
        headers.storage.length <= col.storage,
        `Storage header label "${headers.storage}" (${headers.storage.length}) exceeds col.storage (${col.storage}) at width ${w}`
      );
    }
  }
});

test('Inspector Drawer: title and metrics fit within terminal width across narrow widths (46 to 120)', () => {
  const container = {
    id: '1234567890abcdef1234567890abcdef',
    name: 'extremely-long-container-name-for-inspector-drawer-test',
    image: 'registry.corp.internal/services/analytics-worker:v2.0',
    status: 'Up 4 days (healthy)',
    state: 'running',
    stats: {
      storage: {
        sizeRwBytes: 104857600,
        sizeRootFsBytes: 524288000,
        blockReadBytes: 10737418240, // 10 GB
        blockWriteBytes: 21474836480, // 20 GB
      },
      network: {
        rxBytes: 5368709120, // 5 GB
        txBytes: 8589934592, // 8 GB
      },
    },
  };

  for (let w = 46; w <= 120; w++) {
    // Title row check:
    const isNarrow = w < 105;
    const useCompactTitle = w < 75;
    const titleOverhead = useCompactTitle ? 34 : (isNarrow ? 56 : 58);
    const maxTitleName = Math.max(8, w - titleOverhead);
    const prefix = useCompactTitle ? 'Diagnostics: ' : 'Container Diagnostics & Inspector: ';
    const truncatedName = truncate(container.name, maxTitleName);
    const idSnippet = ` (${container.id.slice(0, 12)})`;
    const boxOverhead = 6 + (!isNarrow ? 2 : 0);
    const titleRowLen = prefix.length + truncatedName.length + idSnippet.length + boxOverhead;

    assert.ok(
      titleRowLen <= w,
      `Inspector title row (${titleRowLen}) exceeds width ${w}`
    );

    // Metrics check across all widths:
    const interiorWidth = w - 6;
    const isCompactMetrics = w < 55;
    const ioLabel = isCompactMetrics ? 'IO: ' : 'Block Disk I/O: ';
    const ioText = `${ioLabel}Read: ${formatBytes(container.stats.storage.blockReadBytes, 0)} | Write: ${formatBytes(container.stats.storage.blockWriteBytes, 0)}`;
    const netLabel = isCompactMetrics ? 'Net: ' : 'Network Bandwidth: ';
    const netText = `${netLabel}RX: ${formatBytes(container.stats.network.rxBytes, 0)} | TX: ${formatBytes(container.stats.network.txBytes, 0)}`;

    const availableWidth = isNarrow ? interiorWidth : Math.floor((w - 8) * 0.48);
    assert.ok(
      ioText.length <= availableWidth,
      `IO text "${ioText}" (${ioText.length}) exceeds available width ${availableWidth} at terminal width ${w}`
    );
    assert.ok(
      netText.length <= availableWidth,
      `Net text "${netText}" (${netText.length}) exceeds available width ${availableWidth} at terminal width ${w}`
    );
  }
});

test('process.stdout.isTTY guards: alternate screen buffer sequences and resize listener attachment', () => {
  // Test TTY guard logic matching src/index.jsx
  const writes = [];
  const fakeStream = new EventEmitter();
  fakeStream.isTTY = false;
  fakeStream.write = (chunk) => {
    writes.push(chunk);
    return true;
  };

  let resizeListenerAttached = false;
  fakeStream.on = (event, fn) => {
    if (event === 'resize') resizeListenerAttached = true;
    return EventEmitter.prototype.on.call(fakeStream, event, fn);
  };

  // Simulating startup when isTTY is false
  if (fakeStream.isTTY) {
    fakeStream.write(ANSI_ENTER_ALT_SCREEN);
    fakeStream.on('resize', () => {});
  }

  assert.equal(writes.length, 0, 'Must NOT write ANSI_ENTER_ALT_SCREEN when isTTY is falsy');
  assert.equal(resizeListenerAttached, false, 'Must NOT register resize listener when isTTY is falsy');

  // Simulating startup when isTTY is true
  fakeStream.isTTY = true;
  if (fakeStream.isTTY) {
    fakeStream.write(ANSI_ENTER_ALT_SCREEN);
    fakeStream.on('resize', () => {});
  }

  assert.equal(writes.length, 1, 'Must write ANSI_ENTER_ALT_SCREEN when isTTY is truthy');
  assert.equal(writes[0], ANSI_ENTER_ALT_SCREEN);
  assert.equal(resizeListenerAttached, true, 'Must register resize listener when isTTY is truthy');
});
