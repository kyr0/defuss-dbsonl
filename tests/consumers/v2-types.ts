/** The platform-neutral entry works with no Node or DOM ambient declarations. */
import { openDbsonl, createMemoryBackend, type FrameMutation, type OwnedFrame, type Transaction, type ReadSession } from 'defuss-dbsonl';
const db = await openDbsonl<{ x: number }>(createMemoryBackend(), 'types', { create: true });
await db.put('a', { x: 1 });
// @ts-expect-error Generic values remain enforced through the batch API.
await db.put('bad', 1);
const session: ReadSession<{ x: number }> = await db.beginRead();
const found = await session.get('a'); if (found.found) { const value: number = found.value.x; void value; }
await db.transaction(async (tx: Transaction<{ x: number }>) => { tx.put('b', { x: 2 }); return (await tx.get('b')).found; });
for await (const batch of session.scanBatches({ sizeOf: row => row.value.x })) { const value: number = batch[0]!.value.x; void value; }
// Declarations only: frame mutations carry bytes, not values. This file is typechecked, never run.
const frames: FrameMutation[] = [{ operation: 'put', key: 'f', frame: new Uint8Array(0) }, { operation: 'delete', key: 'f' }];
await db.batchFrames(frames);
// @ts-expect-error A frame mutation has no value.
await db.batchFrames([{ operation: 'put', key: 'f', value: { x: 1 } }]);
await db.transaction((tx: Transaction<{ x: number }>) => { tx.putFrame('f', new Uint8Array(0)); tx.putFrame('g', db.frame({ x: 1 })); });
const owned: OwnedFrame = db.frame({ x: 2 }); void owned;
// @ts-expect-error frame() takes the handle's value type.
db.frame(1);
// @ts-expect-error An object with a byteLength is not an OwnedFrame.
await db.batchFrames([{ operation: 'put', key: 'f', frame: { byteLength: 1 } }]);
await session.close(); await db.close();
