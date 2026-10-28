// Local capability probe. No external connections, credentials or upstream calls.
import { createServer } from 'node:net';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const result = await new Promise(resolve => {
  const server = createServer();
  server.once('error', error => resolve({ allowed: false, code: error.code }));
  server.listen(0, '127.0.0.1', () => server.close(() => resolve({ allowed: true })));
});
console.log('loopback-listen:', JSON.stringify(result));
const child = spawnSync(process.execPath, [require.resolve('typescript/lib/tsc.js'), '--showConfig', '--project', 'tsconfig.json', '--pretty', 'false'], {
  encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024,
});
console.log('typescript-child:', JSON.stringify({ error: child.error?.code || null, status: child.status,
  stdoutBytes: child.stdout?.length || 0, stderrBytes: child.stderr?.length || 0 }));
