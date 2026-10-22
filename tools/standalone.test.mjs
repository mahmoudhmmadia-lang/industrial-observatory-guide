import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

test('builds and serves from a clean standalone repository without sibling guides', async () => {
  const source = path.resolve(import.meta.dirname, '..');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'observatory-standalone-'));
  const isolated = path.join(scratch, 'guide');
  fs.mkdirSync(isolated);
  let server;
  try {
    for (const name of ['main.tex', 'chapters', 'assets', 'web', 'tools', 'package.json']) {
      fs.cpSync(path.join(source, name), path.join(isolated, name), {
        recursive: true,
        filter: file => !file.split(path.sep).includes('node_modules'),
      });
    }
    execFileSync(process.execPath, ['tools/build-html.mjs'], { cwd: isolated, stdio: 'pipe' });
    execFileSync(process.execPath, ['--test', 'tools/guide.test.mjs'], { cwd: isolated, stdio: 'pipe' });
    const { createServer } = await import(pathToFileURL(path.join(isolated, 'tools/serve-html.mjs')));
    server = createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const route of ['/', '/ar/index.html', '/ar/c1.html', '/ar/c2.html', '/assets/guide.css', '/assets/guide.js', '/assets/kayanos-mark.svg']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200, route);
      assert.ok((await response.text()).length > 0, route);
    }
    // Exercise the actual preview entrypoint too: its file watchers must be local.
    const { spawn } = await import('node:child_process');
    const child = spawn(process.execPath, ['tools/serve-html.mjs'], { cwd: isolated, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Preview startup timed out')), 10000);
        child.once('error', error => { clearTimeout(timeout); reject(error); });
        child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Preview exited: ${code}`)); });
        child.stdout.on('data', data => { if (String(data).includes('Guide:')) { clearTimeout(timeout); resolve(); } });
      });
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        const exited = new Promise(resolve => child.once('exit', resolve));
        child.kill();
        await exited;
      }
    }
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    // Only remove the unique temporary directory created by this test.
    assert.equal(path.dirname(scratch), path.resolve(os.tmpdir()));
    assert.ok(path.basename(scratch).startsWith('observatory-standalone-'));
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
