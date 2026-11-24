/** VERIFIED: plans/ENCODE-ONCE.md: frames a caller encoded commit like values through batchFrames and putFrame. */
import { expect, test, beforeAll } from 'vitest';
import { mkdtemp, mkdir, rm, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { encodeFrame } from 'defuss-dson/sequence';
import { createMemoryBackend, openDbsonl } from '../src/index.js';
import type { Backend, FrameMutation, Mutation } from '../src/index.js';
import { createFileBackend } from '../src/server.js';
beforeAll(async () => { await mkdir('tmp', { recursive: true }); });

async function rows<T>(source: AsyncIterable<T>): Promise<T[]> { const result: T[] = []; for await (const row of source) result.push(row); return result; }
async function failure(call: () => unknown): Promise<unknown> { try { await call(); } catch (error) { return error; } return undefined; }
/** Typed and cyclic DSON values: what a frame must carry exactly as put would. */
function values(): Record<string, unknown> {
  const cyclic: Record<string, unknown> = { name: 'loop' }; cyclic.self = cyclic;
  return {
    typed: { when: new Date(42), big: 2n ** 70n, bytes: new Uint8Array([0, 7, 255]), map: new Map<unknown, unknown>([[1, 'one'], ['set', new Set([1, 2])]]), nan: Number.NaN, nothing: undefined },
    cyclic, text: 'x'.repeat(5000), absent: undefined,
  };
}

for (const kind of ['memory', 'native'] as const) {
  test(`${kind}: batchFrames stores what batch stores, and every read path decodes the value, never the frame`, async () => {
    const root = await mkdtemp(resolve('tmp/frames-'));
    try {
      const backend = async (name: string): Promise<Backend> => kind === 'memory' ? createMemoryBackend() : createFileBackend(resolve(root, name));
      const byValue = await openDbsonl(await backend('value'), 'frames', { create: true });
      const byFrame = await openDbsonl(await backend('frame'), 'frames', { create: true });
      const input = values();
      const viaValue: Mutation<unknown>[] = [...Object.entries(input).map(([key, value]) => ({ operation: 'put' as const, key, value })), { operation: 'delete', key: 'text' }];
      const viaFrame: FrameMutation[] = [...Object.entries(input).map(([key, value]) => ({ operation: 'put' as const, key, frame: encodeFrame(value) })), { operation: 'delete', key: 'text' }];
      expect(await byFrame.batchFrames(viaFrame)).toEqual(await byValue.batch(viaValue));
      for (const db of [byValue, byFrame]) {
        const cyclic = await db.get('cyclic');
        expect(cyclic.found && (cyclic.value as { self: unknown }).self).toBe(cyclic.value);
        expect(await db.get('typed')).toEqual({ found: true, value: input.typed, revision: 1 });
        expect(await db.get('absent')).toEqual({ found: true, value: undefined, revision: 1 });
        expect(await db.get('text')).toEqual({ found: false });
      }
      // Same frames, same generation bytes: the frame path writes exactly what the value path writes.
      expect((await byFrame.stats()).committedBytes).toBe((await byValue.stats()).committedBytes);
      const snapshot = await byFrame.beginRead();
      expect((await rows(snapshot.scan())).map(row => [row.key, row.value instanceof Uint8Array])).toEqual([['absent', false], ['cyclic', false], ['typed', false]]);
      expect((await rows(snapshot.scanBatches())).flat().find(row => row.key === 'typed')?.value).toEqual(input.typed);
      await snapshot.close();
      expect(await byFrame.verify()).toEqual({ revision: 1, count: 3 });
      await byValue.close(); await byFrame.close();
      // Reopened from storage, the frames still decode.
      if (kind === 'native') { const reopened = await openDbsonl(await createFileBackend(resolve(root, 'frame')), 'frames'); expect((await reopened.get('typed')).value).toEqual(input.typed); await reopened.close(); }
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}

test('a transaction stages a frame: get and scan see the decoded value, and the commit publishes it with the other writes', async () => {
  const db = await openDbsonl(createMemoryBackend(), 'tx', { create: true });
  await db.put('b', 'base');
  const record = { id: 'r1', tags: new Set(['a']) };
  const { revision } = await db.transaction(async tx => {
    tx.putFrame('a', encodeFrame(record));
    tx.put('index:a', 'a');
    expect(await tx.get('a')).toEqual({ found: true, value: record, revision: 2 });
    expect((await rows(tx.scan())).map(row => [row.key, row.value])).toEqual([['a', record], ['b', 'base'], ['index:a', 'a']]);
    // A later frame replaces the staged one, and a delete replaces a staged frame.
    tx.putFrame('b', encodeFrame('first')); tx.putFrame('b', encodeFrame('second'));
    tx.putFrame('c', encodeFrame(1)); tx.delete('c');
  });
  expect(revision).toBe(2);
  expect(await db.get('a')).toEqual({ found: true, value: record, revision: 2 });
  expect((await db.get('b')).value).toBe('second');
  expect((await db.get('index:a')).value).toBe('a');
  expect((await db.get('c')).found).toBe(false);
  await db.close();
});

test('read-before-putFrame keeps insert-only semantics: of two transactions inserting one absent key, the later conflicts', async () => {
  const backend = createMemoryBackend();
  const db = await openDbsonl<string>(backend, 'insert', { create: true });
  const peer = await openDbsonl<string>(backend, 'insert');
  const insert = (handle: typeof db, value: string, between?: () => Promise<unknown>) => handle.transaction(async tx => {
    if ((await tx.get('log:1')).found) throw new Error('exists');
    await between?.();
    tx.putFrame('log:1', encodeFrame(value)); tx.putFrame('index:writer', encodeFrame(value));
  });
  await expect(insert(db, 'mine', () => insert(peer, 'theirs'))).rejects.toMatchObject({ code: 'CONFLICT' });
  // Nothing of the conflicting transaction was published, neither the record nor its index entry.
  expect((await db.get('log:1')).value).toBe('theirs');
  expect((await db.get('index:writer')).value).toBe('theirs');
  expect((await db.stats()).revision).toBe(1);
  await db.close(); await peer.close();
});

test('a frame is copied at admission: changing or reusing the caller buffer afterwards changes nothing stored', async () => {
  const db = await openDbsonl(createMemoryBackend(), 'copy', { create: true });
  const frame = encodeFrame({ n: 1 }), other = encodeFrame({ n: 2 });
  const committing = db.batchFrames([{ operation: 'put', key: 'a', frame }]);
  frame.set(other.subarray(0, frame.length));
  await committing;
  expect((await db.get('a')).value).toEqual({ n: 1 });
  await db.transaction(tx => { const reused = encodeFrame({ n: 3 }); tx.putFrame('b', reused); reused.fill(0); });
  expect((await db.get('b')).value).toEqual({ n: 3 });
  // A Node Buffer, whose slice() is a view of its memory, not a copy.
  const buffered = Buffer.from(encodeFrame({ n: 4 }));
  const pending = db.batchFrames([{ operation: 'put', key: 'd', frame: buffered }]); buffered.fill(0); await pending;
  expect((await db.get('d')).value).toEqual({ n: 4 });
  // A view into a larger buffer stores only its own bytes.
  const inner = encodeFrame('inner'), buffer = new Uint8Array(inner.length + 8).fill(0xee); buffer.set(inner, 4);
  await db.batchFrames([{ operation: 'put', key: 'c', frame: buffer.subarray(4, 4 + inner.length) }]);
  expect((await db.get('c')).value).toBe('inner');
  expect(await db.verify()).toEqual({ revision: 4, count: 4 });
  await db.close();
});

test('malformed, partial, extended or over-budget frames are TypeError or RangeError, before anything commits', async () => {
  const db = await openDbsonl(createMemoryBackend(), 'bad', { create: true, maxRecordBytes: 1024 });
  const good = encodeFrame({ ok: true });
  const flip = (index: number) => { const bytes = good.slice(); bytes[index]! ^= 1; return bytes; };
  const twice = new Uint8Array(good.length * 2); twice.set(good); twice.set(good, good.length);
  let deep: unknown[] = []; const top = deep; for (let i = 0; i < 600; i++) { const next: unknown[] = []; deep.push(next); deep = next; }
  const typeErrors: unknown[] = [
    undefined, 'frame', [...good], good.buffer, new DataView(good.buffer), new Uint8Array(0),
    good.subarray(0, good.length - 1), good.subarray(0, 8), flip(1), flip(good.length - 1), flip(8), twice,
    Uint8Array.of(...good, 0),
  ];
  // Bytes longer than any frame that fits are refused by their length, before they are copied or decoded.
  const rangeErrors = [encodeFrame('x'.repeat(2000)), encodeFrame(top, { maxDepth: 1000 }), new Uint8Array(1024 + 17)];
  for (const [frames, type] of [[typeErrors, TypeError], [rangeErrors, RangeError]] as const) {
    for (const frame of frames) {
      expect(await failure(() => db.batchFrames([{ operation: 'put', key: 'ok', frame: good }, { operation: 'put', key: 'bad', frame: frame as Uint8Array }]))).toBeInstanceOf(type);
      await db.transaction(tx => { expect(() => tx.putFrame('bad', frame as Uint8Array)).toThrow(type); });
    }
  }
  // A value where batchFrames expects a frame, and an unknown operation.
  expect(await failure(() => db.batchFrames([{ operation: 'put', key: 'v', value: 1 } as unknown as FrameMutation]))).toBeInstanceOf(TypeError);
  expect(await failure(() => db.batchFrames([{ operation: 'upsert', key: 'v', frame: good } as unknown as FrameMutation]))).toBeInstanceOf(TypeError);
  expect(await failure(() => db.batchFrames([{ operation: 'put', key: 'k'.repeat(4097), frame: good }]))).toBeInstanceOf(TypeError);
  expect(await db.stats()).toMatchObject({ revision: 0, count: 0 });
  // maxRecordBytes bounds a frame's payload exactly as it bounds the value put encodes: a payload of 1024 bytes fits, 1025 do not.
  const fits = Array.from({ length: 1024 }, (_, n) => n).find(n => encodeFrame(new Uint8Array(n)).length - 16 === 1024)!;
  expect(encodeFrame(new Uint8Array(fits + 1)).length - 16).toBe(1025);
  await expect(db.batchFrames([{ operation: 'put', key: 'max', frame: encodeFrame(new Uint8Array(fits)) }])).resolves.toMatchObject({ revision: 1 });
  await expect(db.put('max', new Uint8Array(fits))).resolves.toMatchObject({ revision: 2 });
  expect(await failure(() => db.batchFrames([{ operation: 'put', key: 'max', frame: encodeFrame(new Uint8Array(fits + 1)) }]))).toBeInstanceOf(RangeError);
  expect(await failure(() => db.put('max', new Uint8Array(fits + 1)))).toBeInstanceOf(RangeError);
  await db.close();
});

test('frame bytes count against transaction and pending budgets, and batchFrames honors ifRevision and cancellation', async () => {
  const db = await openDbsonl(createMemoryBackend(), 'budget', { create: true, maxTransactionBytes: 4096, maxPendingBytes: 6000 });
  // About 3.1 KB per operation: one fits each budget, two exceed it.
  const frame = encodeFrame('y'.repeat(1500));
  await expect(db.batchFrames([{ operation: 'put', key: 'a', frame }, { operation: 'put', key: 'b', frame }])).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
  await expect(db.transaction(tx => { tx.putFrame('a', frame); tx.putFrame('b', frame); })).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED' });
  // One admitted batch holds more than half the pending budget, so a second is refused until the first settles.
  const first = db.batchFrames([{ operation: 'put', key: 'a', frame }]);
  await expect(db.batchFrames([{ operation: 'put', key: 'b', frame }])).rejects.toMatchObject({ code: 'QUEUE_FULL' });
  await first;
  await expect(db.batchFrames([{ operation: 'put', key: 'b', frame }], { ifRevision: 0 })).rejects.toMatchObject({ code: 'CONFLICT' });
  const controller = new AbortController(); controller.abort();
  await expect(db.batchFrames([{ operation: 'put', key: 'b', frame }], { signal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' });
  await expect(db.batchFrames([{ operation: 'put', key: 'b', frame }], { ifRevision: 1 })).resolves.toEqual({ revision: 2, count: 2 });
  await db.close();
});

test('concurrent frame batches on two handles each commit once under a revision of their own, and an earlier snapshot keeps its view', async () => {
  const backend = createMemoryBackend();
  const a = await openDbsonl<number>(backend, 'concurrent', { create: true }), b = await openDbsonl<number>(backend, 'concurrent');
  const before = await a.beginRead();
  const receipts = await Promise.all(Array.from({ length: 40 }, (_, i) => (i % 2 ? a : b).batchFrames([{ operation: 'put', key: `k${i}`, frame: encodeFrame(i) }, { operation: 'put', key: 'last', frame: encodeFrame(i) }])));
  expect(new Set(receipts.map(receipt => receipt.revision)).size).toBe(40);
  expect(Math.max(...receipts.map(receipt => receipt.revision))).toBe(40);
  expect(await rows(before.scan())).toEqual([]);
  await before.close();
  const after = await b.beginRead();
  expect(after.count).toBe(41);
  // The last key holds the value of the batch that received the last revision.
  const last = receipts.findIndex(receipt => receipt.revision === 40);
  expect((await after.get('last')).value).toBe(last);
  await after.close();
  expect(await a.verify()).toEqual({ revision: 40, count: 41 });
  await a.close(); await b.close();
});

test.skipIf(process.getuid?.() === 0)('a frame batch whose head publication fails is COMMIT_UNCERTAIN, and the next writer adopts it', async () => {
  const root = await mkdtemp(resolve('tmp/frames-publication-'));
  try {
    const backend = await createFileBackend(root); let db = await openDbsonl(backend, 'publish', { create: true });
    await db.put('a', 1); await db.close();
    await chmod(resolve(root, 'publish.head'), 0o444);
    db = await openDbsonl(backend, 'publish');
    try {
      await expect(db.batchFrames([{ operation: 'put', key: 'a', frame: encodeFrame(2) }])).rejects.toMatchObject({ code: 'COMMIT_UNCERTAIN' });
      expect((await db.get('a')).value).toBe(1);
    } finally { await chmod(resolve(root, 'publish.head'), 0o600); }
    await db.batchFrames([{ operation: 'put', key: 'b', frame: encodeFrame(3) }]);
    expect((await db.get('a')).value).toBe(2);
    expect(await db.verify()).toEqual({ revision: 3, count: 2 });
    await db.close();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('db.frame() encodes once: its handle commits through batchFrames and putFrame as the value would, a snapshot taken at the call', async () => {
  const backend = createMemoryBackend();
  const db = await openDbsonl(backend, 'owned', { create: true }), peer = await openDbsonl(backend, 'owned');
  const byValue = await openDbsonl(createMemoryBackend(), 'owned', { create: true });
  const input = values(), record = { n: 1, at: new Date(5) };
  const owned = db.frame(record);
  // The handle holds the value as it was at the call; later changes to the value do not reach it.
  record.n = 2;
  expect(Object.isFrozen(owned)).toBe(true);
  expect(owned.byteLength).toBe(encodeFrame({ n: 1, at: new Date(5) }).length);
  await db.batchFrames([...Object.entries(input).map(([key, value]) => ({ operation: 'put' as const, key, frame: db.frame(value) })), { operation: 'put', key: 'record', frame: owned }]);
  await byValue.batch([...Object.entries(input).map(([key, value]) => ({ operation: 'put' as const, key, value })), { operation: 'put', key: 'record', value: { n: 1, at: new Date(5) } }]);
  expect((await db.stats()).committedBytes).toBe((await byValue.stats()).committedBytes);
  expect(await db.get('record')).toEqual({ found: true, value: { n: 1, at: new Date(5) }, revision: 1 });
  expect(await db.get('typed')).toEqual({ found: true, value: input.typed, revision: 1 });
  // One handle commits again, on another handle of the database too, and in a transaction.
  await peer.transaction(async tx => {
    tx.putFrame('again', owned);
    expect(await tx.get('again')).toEqual({ found: true, value: { n: 1, at: new Date(5) }, revision: 2 });
  });
  expect((await db.get('again')).value).toEqual({ n: 1, at: new Date(5) });
  expect(await db.verify()).toEqual({ revision: 2, count: 6 });
  await db.close(); await peer.close(); await byValue.close();
});

test('only a handle db.frame() made skips the check: look-alikes and clones are TypeError, and every handle still meets the record budget', async () => {
  const large = await openDbsonl(createMemoryBackend(), 'large', { create: true, maxRecordBytes: 4096 });
  const small = await openDbsonl(createMemoryBackend(), 'small', { create: true, maxRecordBytes: 1024 });
  const owned = large.frame(new Uint8Array(2000));
  for (const forged of [{ byteLength: owned.byteLength }, structuredClone(owned), Object.create(owned)]) {
    expect(await failure(() => small.batchFrames([{ operation: 'put', key: 'f', frame: forged as typeof owned }]))).toBeInstanceOf(TypeError);
    await small.transaction(tx => { expect(() => tx.putFrame('f', forged as typeof owned)).toThrow(TypeError); });
  }
  // A frame within the issuing handle's budget but not the receiving one's is refused as put refuses its value.
  expect(await failure(() => small.batchFrames([{ operation: 'put', key: 'f', frame: owned }]))).toBeInstanceOf(RangeError);
  expect(await failure(() => small.put('f', new Uint8Array(2000)))).toBeInstanceOf(RangeError);
  // frame() applies its own handle's budget and DSON's encoder checks.
  expect(() => small.frame(new Uint8Array(2000))).toThrow(RangeError);
  expect(() => small.frame(() => 1)).toThrow(TypeError);
  expect(await small.stats()).toMatchObject({ revision: 0, count: 0 });
  await expect(large.batchFrames([{ operation: 'put', key: 'f', frame: owned }])).resolves.toMatchObject({ revision: 1 });
  await small.close(); await large.close();
});
