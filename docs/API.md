# API (formats 2, 3 and 4)

VERIFIED: All methods return promises unless listed as synchronous. Runtime values use DSON, including binary views, dates, bigint, undefined and cyclic references. Generic `T` describes application values; DBSONL does not perform application schema validation.

## Construction

| Export | Contract |
| --- | --- |
| `createMemoryBackend(options?)` | New isolated memory namespace; share the returned object between clients |
| `createFileBackend(root, options?)` from `/server` | Native Storage plus whole-file OS locks and directory fsync, including the root's ancestors at creation; `scanWorkers` and `scanThreshold` set the scan pool, `syncReadBytes` the largest read that blocks under asynchronous I/O (default 16384) |
| `createBrowserBackend(storage, namespace, locks, writeChunkBytes?)` from `/browser` | Supplied Storage plus Web Locks; fourth argument defaults to 65536 |
| `openDbsonl<T>(backend, name, options?)` | Read persistent metadata; missing database requires `create: true`, which also completes an interrupted create (empty head and generations) |

Names contain 1 through 64 lowercase letters, digits, hyphens or underscores, beginning with a letter or digit. Keys are strings of at most 4096 UTF-16 code units, including empty strings. Ordering uses JavaScript string comparison, not locale collation. Native and browser namespaces must be application-owned and consistently coordinated.

## Operations

| Method | Result and behavior |
| --- | --- |
| `get(key)` | `{found: false}` or `{found: true, value, revision}`; presence is separate from undefined |
| `put(key, value, options?)` | Single-operation atomic batch |
| `delete(key, options?)` | Atomic delete; deleting an absent key is valid |
| `batch(mutations, {ifRevision?, signal?}?)` | One revision for all operations; duplicate keys apply in input order |
| `batchFrames(mutations, {ifRevision?, signal?}?)` | `batch` for values the caller already encoded: `{operation: 'put', key, frame}` or `{operation: 'delete', key}`, where `frame` is what `encodeFrame` of `defuss-dson/sequence` returns, or what `frame()` returns |
| `frame(value)` (synchronous) | Encode a value as `put` would and return an `OwnedFrame` that `batchFrames` and `putFrame` of any handle of this package commit without a copy or a check |
| `transaction(callback, {signal?}?)` | `{result, revision, count}`; callback runs once; a changed read key aborts publication |
| `beginRead({at?}?)` | Explicit immutable snapshot with `head`, `revision`, `count`, `get`, `scan`, `scanBatches`, `split`, `close`; `at` pins the head of a snapshot that is still open elsewhere |
| `stats()` | Current revision, count, generation, committedBytes, cacheBytes, cachePages, durability |
| `verify()` | Full persisted logical integrity traversal; returns revision and count |
| `compact({mode?, signal?}?)` | Copy live data and rebuild index; returns revision, beforeBytes, afterBytes |
| `collect()` | Remove unpinned obsolete generations; returns removed and retained filenames |
| `close()` | Stop admission, drain work and close owned snapshots; idempotent |

VERIFIED: Nonempty batches advance revision even for a delete of an absent key. Empty batches validate `ifRevision` but do not advance revision. A transaction records the revision of every key it reads through `get`, including absence. At commit it fails with `CONFLICT` if any of those keys changed, appeared or disappeared since its snapshot, which prevents write skew and point-read phantoms. A scan cannot be checked key by key, so after a scan, and after more than `maxTransactionOperations` distinct reads, the transaction falls back to the whole-database revision check. Writers on disjoint keys therefore commit without conflict. A read-only callback can conflict. There is no automatic callback retry.

VERIFIED: Commits queued on one handle publish as a group under one commit lock: one append, one generation flush and one head flush. Each member is checked in queue order against the state the members before it leave, gets its own revision and receipt, and fails alone: a cancelled, conflicting or over-budget member is rejected, and if the shared write fails before publication the members are retried one at a time. Readers never see a state between members, so the outcome equals committing them one by one. A transaction started while its handle's group holds the commit lock pins the last flushed head instead of waiting for the group. A forming group waits for transactions on the same handle that already hold a snapshot, at most half the previous group's publication time, so concurrent transactions share a group instead of alternating between small ones; a commit can therefore wait that long before its group starts. A transaction that outlasts one such wait is not waited for again.

A transaction exposes `revision`, async `get`, synchronous `put`/`putFrame`/`delete` and an async `scan`. Staging copies each value through the encoder, and each frame as `batchFrames` does. Replacing a staged key replaces its budget charge. Reads see staged writes; they report the snapshot revision plus one, while the commit receipt carries the revision the commit actually received. A transaction scan captures the staged overlay at its first pull and merges it with the immutable base in key order; subsequent staging is visible to a new scan. Transaction objects reject use after the callback finishes.

VERIFIED: `batchFrames` and `putFrame` accept a frame only if it is a `Uint8Array` that holds exactly one complete DSON frame and no other bytes. At call time they copy it and decode the copy under the handle's `maxRecordBytes`, depth 512 and 1,000,000 references, the limits every read applies; the decode checks the frame version, declared length, header and payload checksums and DSON structure. `maxRecordBytes` bounds a frame's payload as it bounds the value `put` encodes, so a frame fits exactly when `put` would accept its value. A frame that is not a `Uint8Array`, is truncated, damaged or followed by other bytes throws `TypeError`; one over a budget throws `RangeError`, as `put` does for the value. `putFrame` throws synchronously and `batchFrames` rejects; nothing of that transaction write or batch is staged or committed.

VERIFIED: The stored bytes are the copy, written unchanged, so changing or reusing the caller's buffer afterwards changes nothing committed; a Node `Buffer` is copied too, not sliced. Frame bytes count against `maxTransactionBytes` and `maxPendingBytes` like encoded values, and revisions, conflicts, commit groups and durability are those of `batch` and `put`. Reads, transaction reads included, return the decoded value, never the frame.

VERIFIED: `frame(value)` encodes under the handle's `maxRecordBytes` and throws as `put` would for the value. It returns a frozen object whose only property is `byteLength`; the bytes stay inside the engine, so a caller can keep the snapshot until it commits but cannot change it. `batchFrames` and `putFrame` take such an object without a copy or a decode, after checking its payload against the receiving handle's `maxRecordBytes` (`RangeError` if larger). A look-alike object, a structured clone or an `OwnedFrame` from another copy of the package, such as its CommonJS build beside the ESM one, throws `TypeError`. One `OwnedFrame` can be committed any number of times.

VERIFIED: A `Uint8Array` frame costs a copy and one decode instead of an encode; an `OwnedFrame` costs neither. In a benchmark of 10,000 records, committing `Uint8Array` frames the caller encoded took 1.12 to 2.06 times as long as `batch` with the values, committing `frame()` handles 0.99 to 1.11 times, and a caller that encodes, decodes and then calls `batch` 1.18 to 2.71 times ([PERFORMANCE.md](PERFORMANCE.md#caller-encoded-frames-on-macos-arm64)).

Snapshot and transaction scans accept `{gte?, lt?, limit?, signal?}` and yield one `{key, value, revision}` per pull. `gte` is inclusive, `lt` exclusive. Returned values are owned decoded objects. A paused iterator becomes unusable when its snapshot closes. Use `try/finally` to close snapshots even after errors or early breaks.

VERIFIED: A snapshot's `scanBatches({gte?, lt?, limit?, signal?, batchSize?, maxBatchBytes?, sizeOf?})` yields the rows `scan` yields for the same range and limit, as fresh nonempty arrays of owned decoded `{key, value, revision}` records. A batch holds at most `batchSize` rows (default 256) and `maxBatchBytes` bytes (default 4 MiB). A row counts its encoded frame length, or the safe non-negative integer that `sizeOf(row)` returns; `sizeOf` runs once per row. When the next row would exceed the byte budget, the batch ends and that row starts the next one. A row larger than the whole budget fails the pull with `LIMIT_EXCEEDED`; batches yielded before it stay valid. Each pull is admitted before `sizeOf` runs, so `close()`, even when called from inside `sizeOf`, waits for the pull before it releases the snapshot. With one tracked pull per batch instead of per row, a full scan took 0.46 to 0.84 of the 0.5.0 row scan's time ([PERFORMANCE.md](PERFORMANCE.md#batch-scans-on-macos-arm64)). Transaction scans stay row iterators.

VERIFIED: On a native backend, `scanBatches` without `sizeOf` runs in the backend's worker pool when its range, or its `limit`, covers at least `scanThreshold` rows (default 5000). It yields the same rows in the same order and fails with the same codes as a scan in one thread; a batch can end early where one worker's range ends. `scanWorkers` (default up to 4, one fewer than the CPUs, on the main thread and 0 in worker threads) sets the pool size, and 0 turns it off. Closing the iterator or the snapshot returns after the workers have released their pins.

VERIFIED: A snapshot's `split(parts, {gte?, lt?}?)` returns 1 to `parts` ranges `{gte?, lt?, count}` in key order, no more than the interval's row count unless it is empty. The first has the given `gte` or none, the last the given `lt` or none, and each other boundary is a key of the snapshot, the next range's `gte`, so the ranges cover every row of the interval once, and each `count` is the exact number of rows in its range. Pass a range to `scan` or `scanBatches` as their `gte` and `lt`. An empty interval returns one range with `count: 0`; `parts` below 1 throws `RangeError`. With at least 8 rows per part, each range misses its share of the rows by at most a quarter: the cut opens every subtree above an eighth of a share, so a boundary lands at most an eighth of a share away from its target.

VERIFIED: `beginRead({at})` takes a snapshot's `head`, or a structured clone of it from another worker or process, and pins that root on this handle. It copies the head, checks its fields like a manifest slot, and throws `TypeError` for an invalid head or one newer than the published head. When the head's generation was collected, it rejects `CONFLICT`: begin a new read. The original snapshot, or any other pin, must stay open until this call returns, because collection removes a generation as soon as no pin holds it.

VERIFIED: Optimistic compaction is the default. A concurrent publication yields `CONFLICT` and leaves an unpublished candidate for `collect()`. Exclusive compaction holds the commit lock through copying; readers retain their roots and writers queue. Compaction does not change logical revision or record revisions. Collection refreshes the fallback head before deleting files and never removes an active generation pin.

## Options and memory accounting

| Open option | Default | Meaning |
| --- | --- | --- |
| `create` | false | Create only when no manifest exists |
| `maxRecordBytes` | 16777216 | DSON payload budget per application value |
| `maxTransactionBytes` | 67108864 | Sum of encoded values and frames, two bytes per key code unit and 64 bytes per staged operation |
| `maxTransactionOperations` | 10000 | Batch operations or distinct staged transaction keys |
| `maxPendingOperations` | 256 | Admitted top-level operations per database handle |
| `maxPendingBytes` | 134217728 | Aggregate encoded-write budget per database handle |
| `maxCacheBytes` | 8388608 | Encoded bytes represented in the page cache; format 4 and 5 pages encode about a tenth of the bytes of earlier formats, so `maxCachePages` usually binds first |
| `maxCachePages` | 1024 | Maximum cached decoded index pages. In format 5 also the most index pages a handle holds in memory for logged commits: a commit that would hold more writes its pages, a checkpoint |
| `signal` | absent | Cooperative cancellation while opening |

VERIFIED: There is no RAM map proportional to total live keys and no fixed live-key count limit. Budgets reject excess work rather than retain an unbounded hidden queue. The writer additionally bounds the encoded size of old index pages loaded into its dirty tree by `maxTransactionBytes`; this is a separate budget from staged values. Byte budgets exclude temporary encoder allocation, decoded object overhead, active traversal pages, caller references and memory-adapter storage. Snapshot pins are explicit resources; callers must close them. Zero cache budgets disable index caching. The fixed manifest parse cache is separate. Codec depth 512 and reference-table limit 1000000 remain DSON defaults; index pages use a separate 512 KiB codec limit. File offsets and revisions must fit safe JavaScript integers.

## Failures and retry policy

| Code | Meaning and action |
| --- | --- |
| `CONFLICT` | A read key, the revision after a scan, `ifRevision` or the publication changed; nothing was published; retry prepared work as appropriate |
| `QUEUE_FULL` | Per-handle admission exhausted; await existing work before retrying |
| `LIMIT_EXCEEDED` | Staging exceeds a configured transaction budget |
| `ABORTED` | Cancellation observed before publication started |
| `COMMIT_UNCERTAIN` | Publication or its flush failed, or publishing recovered format 3 or 4 commits failed; the commit may be durable, so inspect the current revision before retrying |
| `CORRUPT` | Invalid committed bytes, schema, ordering or addresses; preserve files for diagnosis |
| `UNSUPPORTED` | Unsupported manifest version or unavailable required platform primitive |
| `CLOSED` | Database, snapshot or completed transaction rejects new work |

VERIFIED: Storage codes such as `QUOTA_EXCEEDED`, `NOT_FOUND`, `PERMISSION_DENIED` and `IO_ERROR` propagate. Invalid arguments and codec limits can throw TypeError or RangeError. Branch on error codes rather than `instanceof`, because ESM and CJS class identities can differ.

An I/O failure before head publication leaves the old head authoritative and may leave an unpublished tail. Publication failure can mean the new head is already visible. There is no application-level deduplication of uncertain retries: use a transaction with an application operation ID when exactly-once effects matter. No API promises recovery after arbitrary corruption of both manifest slots.

## Custom backend contract

VERIFIED: `Backend` contains a Storage adapter, a positive `writeChunkBytes`, a durability label and a coordinator. `acquire` returns an idempotent async release; shared pins coexist, exclusive locks exclude all other owners, and try-only acquisition returns undefined immediately when busy. All participants must agree on lock names and scope. `syncDirectory` must match the advertised durability. `retire` runs only for unreferenced generations under the commit lock. The bundled factories are the supported implementations; custom coordinators must meet this protocol before storing valuable data.

## Native connection capabilities and performance

VERIFIED: `createFileBackend(root, {io: 'async'})` is the default. The `{io: 'sync'}` option uses blocking reads, writes, size queries and flushes; use it in a worker or CLI when throughput matters more than scheduling other tasks on that thread. With asynchronous I/O, reads of at most `syncReadBytes` bytes (default 16384), such as point reads of small values and index pages, are blocking calls too, because a thread-pool round trip took longer than a read from the OS page cache; scan windows of 64 KiB stay asynchronous. Set `syncReadBytes: 0` on network or slow storage, where an uncached read can block the thread for a long time. Lock attempts are always nonblocking and contended OS locks wait asynchronously. A single `get()` holds the commit lock through its read; explicit snapshots retain their independent lifetime and permit writers to proceed.

VERIFIED: Each open database retains at most two idle native read descriptors, its head and current generation files open for writing, plus at most eight idle lock descriptors (normally four), an 8 KiB manifest parse cache, and its configured page cache. Each active scan or compaction can retain a 64 KiB read-ahead window, on every backend; each active writer has a buffer of at most 64 KiB. Point reads never retain decoded or encoded values between calls. If the head changes, a native get may temporarily decode both its prior-root candidate and the current-root value; this work is bounded by two record budgets, excluding decoded-object overhead. These fixed buffers and descriptor resources are separate from `stats().cacheBytes`. Close database handles when idle generations should release OS resources immediately; unlinking a file held open by another process does not immediately free its disk blocks.

VERIFIED: Custom backends may optionally expose `connect(name)`, returning `{backend, close}` for a per-database scope. The engine closes that scope on failed open and after draining successful handles. An optional `read(name, offset, length)` performs fresh positional reads of immutable committed prefixes, or the manifest under the commit lock. It must honor read chunk limits, reject invalid names/symlinks/nonregular files and return owned bytes. It fills the requested range unless EOF is encountered; partial OS reads must be retried. It must allow concurrent readers and writers of disjoint, unpublished bytes. Omitting both capabilities retains the portable Storage path. The supplied native implementation provides them; OPFS deliberately keeps its exclusive-handle protocol.
