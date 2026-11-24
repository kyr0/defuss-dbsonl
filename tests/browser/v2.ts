/** Separate dedicated workers share real OPFS files and Web Locks. */
import { createOPFSStorage } from 'defuss-storage/opfs';
import { createDirectoryStorage } from 'defuss-storage/directory';
import { createBrowserBackend } from 'defuss-dbsonl/browser';
import { openDbsonl } from 'defuss-dbsonl';
import { encodeFrame } from 'defuss-dson/sequence';
self.onmessage = async ({ data }) => {
  try {
    const namespace = `dbsonl-${data.namespace}-${data.mode === 'directory' ? 'directory' : 'v2'}`;
    // Directory handles are the other supported browser Storage; they need the same lock namespace discipline.
    const storage = data.mode === 'directory'
      ? await createDirectoryStorage(await (await navigator.storage.getDirectory()).getDirectoryHandle(namespace, { create: true }), { name: namespace })
      : await createOPFSStorage({ name: namespace });
    const backend = createBrowserBackend(storage, namespace, navigator.locks);
    const db = await openDbsonl<number>(backend, 'browser', { create: true });
    let reply: Record<string, unknown> = {};
    if (data.mode === 'part') {
      // A nested worker: its own storage, backend and handle, pinned to the head it was sent.
      const session = await db.beginRead({ at: data.head }); const keys: string[] = [];
      for await (const batch of session.scanBatches({ ...data.range, batchSize: 5 })) for (const row of batch) keys.push(row.key);
      await session.close(); await db.close(); self.postMessage({ ok: true, keys }); return;
    }
    if (data.mode === 'split') {
      // Three nested workers scan split() ranges of one pinned snapshot while this worker writes and compacts.
      const session = await db.beginRead(), expected: string[] = [];
      for await (const row of session.scan()) expected.push(row.key);
      const ranges = await session.split(3);
      const parts = ranges.map(range => new Promise<string[]>((resolve, reject) => {
        const worker = new Worker(self.location.href, { type: 'module' });
        worker.onmessage = event => { worker.terminate(); if (event.data.ok) resolve(event.data.keys); else reject(new Error(event.data.error)); };
        worker.onerror = event => { worker.terminate(); reject(new Error(event.message)); };
        worker.postMessage({ namespace: data.namespace, mode: 'part', head: session.head, range });
      }));
      for (let i = 0; i < 10; i++) await db.put(`split-${i}`, i);
      await db.compact();
      const union = (await Promise.all(parts)).flat();
      if (JSON.stringify(union) !== JSON.stringify(expected)) throw new Error('Split ranges do not add up to the full scan.');
      await session.close();
      reply = { ranges: ranges.length, rows: union.length };
    } else if (data.mode === 'directory') {
      await db.transaction(tx => { tx.put('a', 1); tx.put('b', 2); });
      if ((await db.verify()).count !== 2) throw new Error('Directory-handle transaction failed.');
    } else if (data.mode === 'scan') {
      // Shared OPFS readers in several workers, beside a writer that takes the same files alone.
      for (let pass = 0; pass < 20; pass++) {
        const session = await db.beginRead(); let rows = 0;
        for await (const row of session.scan()) { rows++; if ((await session.get(row.key)).revision !== row.revision) throw new Error('Parallel read disagrees with its scan.'); }
        if (rows !== session.count) throw new Error('Parallel scan count differs.');
        await session.close();
      }
    } else if (data.mode === 'write') {
      for (let i = 0; i < 30; i++) await db.put(`w-${i}`, i);
      // Frames the caller encoded, on OPFS: in a batch and in a transaction.
      await db.batchFrames([{ operation: 'put', key: 'w-frame', frame: encodeFrame(30) }]);
      await db.transaction(tx => { tx.putFrame('w-frame-tx', encodeFrame(31)); });
      if ((await db.get('w-frame')).value !== 30 || (await db.get('w-frame-tx')).value !== 31) throw new Error('OPFS frame commits failed.');
      await db.compact(); await db.collect();
    } else if (data.mode !== 'verify') {
      for (let i = 0; i < 15; i++) {
        for (;;) {
          try { await db.transaction(async tx => { tx.put('counter', ((await tx.get('counter')).value ?? 0) + 1); tx.put(`${data.mode}-${i}`, i); }); break; }
          catch (error) { if ((error as { code?: string }).code !== 'CONFLICT') throw error; }
        }
      }
    } else {
      if ((await db.get('counter')).value !== 30) throw new Error('Cross-worker updates were lost.');
      const snapshot = await db.beginRead(); await db.put('counter', 31); await db.compact();
      if ((await snapshot.get('counter')).value !== 30) throw new Error('Snapshot changed.');
      if ((await db.collect()).retained.length !== 1) throw new Error('Pinned generation was not retained.');
      await snapshot.close(); if ((await db.collect()).removed.length !== 1) throw new Error('Unpinned generation was not reclaimed.');
      await db.verify();
    }
    const batchSession = await db.beginRead(); let batchRows = 0;
    for await (const batch of batchSession.scanBatches({ batchSize: 7 })) batchRows += batch.length;
    if (batchRows !== batchSession.count) throw new Error('Native browser batch count differs.');
    await batchSession.close();
    await db.close(); self.postMessage({ ok: true, ...reply });
  } catch (error) { self.postMessage({ ok: false, error: error instanceof Error ? error.stack : String(error) }); }
};
