/** ESM consumers reach only installed package exports; no workspace source is resolvable here. */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openDbsonl, createMemoryBackend, type Backend } from 'defuss-dbsonl';
import { createFileBackend } from 'defuss-dbsonl/server';
import { encodeFrame } from 'defuss-dson/sequence';

const root = await mkdtemp(resolve('esm-'));
try {
  const backends: [string, Backend][] = [
    ['memory', createMemoryBackend()],
    ['native-async', await createFileBackend(resolve(root, 'async'))],
    ['native-sync', await createFileBackend(resolve(root, 'sync'), { io: 'sync' })],
  ];
  for (const [label, backend] of backends) {
    const db = await openDbsonl<{ when: Date; bytes: Uint8Array; big: bigint }>(backend, 'esm', { create: true });
    const value = { when: new Date(42), bytes: new Uint8Array([0, 10, 255]), big: 100n };
    await db.batch([{ operation: 'put', key: 'typed', value }, { operation: 'put', key: 'gone', value }, { operation: 'delete', key: 'gone' }]);
    const found = await db.get('typed');
    assert.ok(found.found, label);
    assert.deepEqual(found.value, value, label);
    assert.deepEqual(await db.get('gone'), { found: false }, label);
    const session = await db.beginRead();
    const batches = []; for await (const batch of session.scanBatches({ batchSize: 2 })) batches.push(batch);
    assert.equal(batches.length,1); assert.deepEqual(batches[0]![0]!.value,value); await session.close();
    assert.deepEqual(await db.verify(), { revision: 1, count: 1 }, label);
    // Frames the caller encoded commit as they are and read back as values, in a batch and in a transaction.
    await db.batchFrames([{ operation: 'put', key: 'framed', frame: encodeFrame(value) }, { operation: 'delete', key: 'typed' }]);
    await db.transaction(tx => { tx.putFrame('staged', encodeFrame(value)); });
    // A frame the handle encoded commits without a second check.
    await db.batchFrames([{ operation: 'put', key: 'owned', frame: db.frame(value) }]);
    for (const key of ['framed', 'staged', 'owned']) assert.deepEqual((await db.get(key)).value, value, `${label} ${key}`);
    assert.deepEqual(await db.verify(), { revision: 4, count: 3 }, label);
    await db.close();
  }
  console.log(JSON.stringify({ runtime: process.versions.bun ? 'Bun' : 'Node', version: process.versions.bun ?? process.version, backends: backends.map(([label]) => label) }));
} finally { await rm(root, { recursive: true, force: true }); }
