// SIGKILL and power loss leave directories until the next run's sweep.
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const STALE_MS = 60 * 60 * 1000;
const STALE_NAME = /^proofline-(site|axe)-/;
const owned = new Set();
let listenersInstalled = false;

export function sweepStale({ dir = tmpdir(), now = Date.now() } = {}) {
  const removed = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return removed; }
  for (const entry of entries) {
    if (!STALE_NAME.test(entry.name) || !entry.isDirectory()) continue;
    try {
      const path = join(dir, entry.name);
      if (now - statSync(path).mtimeMs <= STALE_MS) continue;
      rmSync(path, { recursive: true, force: true });
      removed.push(entry.name);
    } catch { /* Another process may have removed or locked this entry. */ }
  }
  return removed;
}

export function removeTempDirs() {
  for (const dir of owned) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* The next sweep can retry. */ }
    owned.delete(dir);
  }
}

export function makeTempDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  owned.add(dir);
  if (!listenersInstalled) {
    listenersInstalled = true;
    process.once('exit', removeTempDirs);
    // A runner that dies first breaks these pipes; the next write then ends this process through an uncaught EPIPE that skips the exit event.
    for (const stream of [process.stdout, process.stderr]) {
      stream.once('error', (error) => {
        removeTempDirs();
        if (error.code === 'EPIPE') process.exit(1);
        throw error;
      });
    }
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.once(signal, () => {
        removeTempDirs();
        if (process.listenerCount(signal) === 0) process.kill(process.pid, signal);
      });
    }
  }
  return dir;
}
