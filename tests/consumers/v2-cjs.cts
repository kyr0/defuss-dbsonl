/** CommonJS consumers exercise both the isomorphic and native entry points. */
import { openDbsonl, createMemoryBackend } from 'defuss-dbsonl';
import { createFileBackend } from 'defuss-dbsonl/server';
import { encodeFrame } from 'defuss-dson/sequence';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
async function main() {
  const root = await mkdtemp(resolve('cjs-v2-'));
  try {
    for (const backend of [createMemoryBackend(), await createFileBackend(root)]) {
      const db = await openDbsonl<number>(backend, 'cjs', { create: true });
      await db.transaction(tx => { tx.putFrame('a', db.frame(1)); tx.putFrame('b', encodeFrame(2)); });
      await db.batchFrames([{ operation: 'put', key: 'c', frame: encodeFrame(3) }]);
      if ((await db.verify()).count !== 3 || (await db.get('b')).value !== 2 || (await db.get('c')).value !== 3) throw new Error('CommonJS transaction or frame batch failed.');
      await db.close();
    }
    // The CommonJS build starts the ESM scan worker that ships beside it.
    const backend = await createFileBackend(root, { scanWorkers: 2, scanThreshold: 100 });
    const db = await openDbsonl<number>(backend, 'cjs-scan', { create: true });
    await db.batch(Array.from({ length: 1000 }, (_, i) => ({ operation: 'put' as const, key: `k${String(i).padStart(4, '0')}`, value: i })));
    const session = await db.beginRead(); let sum = 0;
    for await (const batch of session.scanBatches()) for (const row of batch) sum += row.value;
    await session.close(); await db.close();
    if (sum !== 499500 || backend.parallel?.scans !== 1) throw new Error(`CommonJS worker scan failed: sum=${sum} scans=${backend.parallel?.scans}.`);
  } finally { await rm(root, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
