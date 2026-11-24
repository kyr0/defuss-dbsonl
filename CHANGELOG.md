# Changelog

## 0.10.0

VERIFIED: `db.batchFrames(mutations, options?)` and `tx.putFrame(key, frame)` commit DSON frames the caller already encoded, with the revisions, conflicts, commit groups, budgets and durability of `batch` and `put`. A `Uint8Array` frame is copied at call time and decoded once to check it; one that is not exactly one valid frame throws `TypeError`, one over a budget `RangeError`. `db.frame(value)` encodes a value into an `OwnedFrame` whose bytes stay in the engine, which those calls commit without a copy or a check. In a benchmark of 10,000 records, a caller that encodes each value, decodes the copy and commits it with `batch` took 1.18 to 2.71 times as long as `batch` alone; with `Uint8Array` frames it took 1.12 to 2.06 times, with `frame()` 0.99 to 1.11 times ([PERFORMANCE.md](docs/PERFORMANCE.md#caller-encoded-frames-on-macos-arm64)). The file format is unchanged. `make bench-frames` reproduces the measurement.

## 0.9.0

VERIFIED: New databases use format 5, which writes index pages only at checkpoints. Between them, a commit appends its values, a compact list of its key changes and its record, and flushes once; the handle that wrote it keeps the changed pages in memory, and every other handle, process or worker replays the records since the last checkpoint. A commit is a checkpoint when the log reaches 16 MiB or the pages held in memory would exceed `maxCachePages`. On a 100,000-document defuss-db load with one ordered index, commits of 256 documents took 2.50 s in all instead of 3.35 to 3.92 s, a 64-document commit 4.39 ms instead of 5.89 to 6.08 ms, and the load wrote 29 to 31 MiB instead of 107 to 166 MiB. Format 2 to 4 databases keep their format; 0.8 refuses format 5 with `UNSUPPORTED`.

## 0.8.1 (not published; its changes ship in 0.9.0)

VERIFIED: `compact()` copies value frames instead of decoding and re-encoding each value, and reads them in file order in batches of about 4 MiB. A 100,000-document defuss-db store with one ordered index compacted in 0.25 to 0.34 s instead of 2.9 to 3.6 s on macOS under Node.js. The file format is unchanged.

## 0.8.0

VERIFIED: A full page cache evicts down to 90% of its limits in one pass over its Map, instead of asking the Map for a new iterator for every evicted page. Each new iterator walked the slots that earlier deletes had left at the front of the Map: 4.3 µs per eviction with 10,000 pages cached, against 0.2 µs with one iterator per pass. In defuss-db's benchmark store of 100,000 documents with one index, committing 64 documents took 7.0 and 7.8 ms instead of 9.3 and 9.4 ms (medians of 41 commits, two alternating runs each), and the 100,000-document bulk load 12.8 and 13.6 s instead of 13.8 and 18.4 s. Second-chance eviction is unchanged, and a pass never evicts the page it has just loaded; `tests/mvcc.test.ts` checks both limits at one page and at 40.

VERIFIED: New databases use format 4: format 3's commit records with compact index pages. A page is a DSON frame of one byte array in which each key stores only what differs from the previous key, as UTF-16 code units in one byte each where they fit, and every number as a varint ([FORMAT.md](docs/FORMAT.md#compact-pages-format-4)). On the 8,336 leaves of a 100,000-document defuss-db store with one index, a page took 552 bytes instead of 5,528; under Node 24.22.1 encoding took 4.8 to 5.0 µs instead of 22.4 to 24.6 µs, and decoding with validation 3.6 to 3.7 µs instead of 17.3 to 18.9 µs. In defuss-db's benchmark (Node 26.13.1, two alternating runs each, both with the eviction change above), loading 100,000 documents in commits of 256 took 8.7 and 9.5 s instead of 13.0 and 15.7 s, with 5 background compactions instead of 11 and a 33.1 MiB file instead of 102.2 MiB; committing 64 documents took 6.0 and 6.2 ms instead of 7.9 and 9.2 ms. Under Bun 1.4.4 the load took 7.1 s instead of 11.7 s and the 64-document commit 5.9 ms instead of 7.3 ms. Warm reads did not change: a read by ID took 10.8 to 10.9 µs against 11.7 to 12.0 µs under Node, and Bun's 20.6 to 26.3 µs varied as much within each format as between them. Format 2 and 3 databases keep their format and their pages, so 0.7 can still share a format 3 database; 0.7 refuses a format 4 database with `UNSUPPORTED`. `tests/format4.test.ts` covers keys that a shared prefix or a byte per unit could break, deletes, compaction, reopening and malformed pages; `tests/format3.test.ts` covers a format 3 database that stays format 3.

## 0.7.0

VERIFIED: Durable commits and point reads on native storage took less time in `make bench-redis` than three runs earlier the same day. Point reads took 19 instead of 38 µs under Node and 12 instead of 47 µs under Bun, lone transactions 3.86 instead of 4.35 ms and 3.97 instead of 4.26 ms, and four contending writers 0.98 instead of 1.23 ms and 1.02 instead of 1.17 ms per commit. Three changes did this. Reads of up to 16 KiB are blocking calls under asynchronous I/O; the new `syncReadBytes` option sets the bound, and 0 restores thread-pool reads. The head and generation files stay open between commits as Storage shared writers, shared by every handle in the realm and closed with the last one. Holders of a shared lock on one connection share one flock, which keeps four writers on one handle in commit groups of four. Each batch's encoded bytes are counted once.

VERIFIED: defuss-storage is now 0.4.1, whose native adapter flushes with `fcntl(F_FULLFSYNC)` under Bun on macOS as Node.js does. Durable commits under Bun therefore cost a full device flush, about 3.8 ms per commit on the development machine, where the plain `fsync` of 0.4.0 took 0.02 to 0.07 ms and left data in the drive's cache.

VERIFIED: `make bench-redis` times atomic batches of 5000 writes for both engines instead of 1000. defuss-dbsonl took less time than Redis in 11 of 16 pairings, one of them a tie within 0.1%; Redis took less time for the four batches and for a lone durable Bun transaction, by 2%. The website shows these runs.

VERIFIED: New databases use format 3: every commit ends with a commit record in the generation, so on native files one flush of the generation makes it durable and the head slot is written without a flush. A lone durable transaction took 4.6 ms instead of 8.1 ms under Node on macOS, where each flush is a full `F_FULLFSYNC`. After a power loss, opening, committing, compaction and collection adopt the commits whose records survived with every frame before them intact by checksum; the head is flushed every 16 MiB to bound that walk. Existing format 2 databases keep format 2 and its two flushes, so 0.2 to 0.6 writers can still share them; those versions refuse a format 3 database with `UNSUPPORTED`. A commit whose head publication fails is now adoptable once its generation is flushed, so `COMMIT_UNCERTAIN` can turn out committed, as the code always allowed. `tests/format3.test.ts` covers lost head slots, a torn last record, adoption by another handle, a write rejected before adoption that stays rejected, a value shaped like a record and format 2 databases; the packed package checks that 0.2.0 refuses format 3 and shares a format 2 database with current writers.

VERIFIED: defuss-storage 0.4 shares read-only opens of one file, so reads on memory, OPFS and directory-handle storage take the file's I/O lock in shared mode; writes, truncation and removal still take it alone. Storage 0.4 rejects `BUSY` when a reader meets an owner or a removal, and the lock makes both wait instead. Parallel snapshot scans of one generation, in one worker or several, no longer take turns. Native storage already read through its own descriptors and is unchanged. The on-disk format and the lock order are unchanged.

VERIFIED: On native storage, `scanBatches()` runs in worker threads by default once its range or limit covers 5000 rows: `createFileBackend` starts a pool of up to four workers that scan key ranges of the pinned snapshot and send the batches back, which the calling thread yields in key order. The rows, their order and the error codes equal a scan in one thread. A full scan of 100,000 documents took 105 ms instead of 401 ms under Node and 113 ms instead of 418 ms under Bun. `scanWorkers` and `scanThreshold` configure the pool, and `scanWorkers: 0` turns it off. Backends in worker threads, memory and browser backends, `scan()` and scans with `sizeOf` stay in the calling thread. The package exports `./scan-worker`, the worker entry, which the server build loads beside itself.

VERIFIED: Parallel scans of your own. A snapshot's `split(parts, {gte?, lt?}?)` returns up to `parts` key ranges `{gte?, lt?, count}` with exact row counts that cover every row of the interval once, and `beginRead({at: head})` pins the head of a snapshot that is still open, from any worker, thread or process with its own handle. Ranges are cut by key from the index's subtree counts, not by byte offset, because a generation file also holds index pages and superseded values. The pin takes the commit lock in shared mode, so workers that pin at once do not queue. With 8 Node worker threads on native storage, a full scan of 100,000 documents took 22 ms against 130 ms in one thread with the index cached on every handle, and 26 ms against 401 ms with the defaults ([PERFORMANCE.md](docs/PERFORMANCE.md#parallel-scans-on-macos-arm64)); `make bench-parallel` measures it. Worker threads should open native backends with `{ io: 'sync' }`, because asynchronous reads share the process's libuv thread pool.

VERIFIED: `tests/scan-workers.test.ts` runs the pool's real worker threads against one-thread scans: rows, DSON types, order, ranges, limits, batch sizes, `LIMIT_EXCEEDED`, and pins released on close and on an early break. The packed package runs a default pool from the ESM and CommonJS builds under Node and Bun. `tests/parallel-scans.test.ts` checks that the ranges add up to the full scan, also within key intervals, on memory and native storage and that a second handle or backend reads the same snapshot until collection, then gets `CONFLICT`. The packed package runs four Node and Bun worker threads over the ranges of one pinned native snapshot while a writer commits and compacts, and nested OPFS workers in Chromium do the same.

VERIFIED: Node 26 runs the test suite too. It removed `--experimental-transform-types`, which the scan worker needed to load its TypeScript source in tests, so the source no longer uses parameter properties and `tsconfig.json` sets `erasableSyntaxOnly`. All 76 tests pass under Node 26.13.1 and the pinned 24.22.1, and the built package runs its scan pool under both. In the `make bench-redis` workloads, Node 26.13.1 took 0.94 to 1.02 of Node 24.22.1's time per workload, within the variation between passes, so the pinned toolchain stays on Node 24.22.1 ([PERFORMANCE.md](docs/PERFORMANCE.md#node-26-against-node-24-on-macos-arm64)).

VERIFIED: `tests/shared-reads.test.ts` covers overlapping reads, writers and removals that wait for readers, and parallel scans beside commits, compaction and collection; the overlap cases fail against the exclusive lock of 0.6.0. The browser suite runs three scanning workers beside a writing, compacting worker on OPFS.

## 0.6.0

VERIFIED: Snapshots have `scanBatches({gte?, lt?, limit?, signal?, batchSize?, maxBatchBytes?, sizeOf?})`, which yields the rows of `scan` as arrays of at most 256 rows and 4 MiB by default, with one tracked pull per batch and one tree step per leaf. It is ported from the 0.4-based fork that defuss-dataview's DBSONL adapter used, with the option names and guarantees that adapter checks: a nonempty array per batch, at most `batchSize` rows and `sizeOf` applied once per row.

VERIFIED: Scans now read ahead 64 KiB on every backend, not only on backends with a positional `read`, so a memory or OPFS scan no longer opens, reads and closes the file once per row.

VERIFIED: defuss-dson is now 1.5.1, which writes the same frames as 1.3.0, reads each frame through one reader and converts frame offsets to int32 values, which Bun needs to decode at full speed when the offsets come from decoded index pages. `scanBatches` decodes the frames of a leaf that the read window already holds in one `decodeFrames` call; when a frame fails, it rereads that run frame by frame, so errors arrive at the same row as before.

VERIFIED: In three runs of the new `make bench-scan` over 100,000 documents, the row scan on memory storage took 0.61 of 0.5.0's time under Node and 0.63 under Bun; `scanBatches` took 0.46 and 0.52 on memory storage and 0.73 and 0.84 on native storage. Against the same source on defuss-dson 1.4.0, the version bump alone took 12% off `scanBatches` on Node memory storage and 8% on native storage, and `decodeFrames` another 6% on both; under Bun, 4% and 0%, then 5% on both. `vendor/defuss-dbsonl-0.5.0.tgz` is the published 0.5.0 package these runs compare against.

VERIFIED: `tests/batches.test.ts` covers batch scans on memory and native storage, and the packed-package and browser suites call `scanBatches` too. The on-disk format and lock protocol are unchanged.

## 0.5.1

VERIFIED: `package.json` names the project website, https://dbsonl.defuss.org, as its homepage, and links the GitHub repository and issue tracker. The README explains installing from npm: on 2026-11-16, `bun add defuss-dbsonl@0.5.0` and `npm install defuss-dbsonl@0.5.0` each installed five packages in an empty project with no install script, and the `/server` entry stored and read a value under Node.js and Bun on macOS arm64.

VERIFIED: The website describes 0.5.0: per-key transaction conflicts, commit groups, the second-chance page cache and the `make bench` figures of three runs on the 0.5.0 source. Against v0.3.0 in those runs no figure was slower in all three, and atomic batches took 1.6 times less time under Node.js and 2.4 times less under Bun. `docs/PERFORMANCE.md` has the tables; the 0.4.0 runs moved to `validation/bench-macos-arm64-0.4.0.json`.

VERIFIED: Below the hero, the website compares defuss-dbsonl with Redis 8.10.3 in the 16 pairings of `make bench-redis`. It shows the headline figures, four gauges that follow a runtime and storage switch, opening on Bun flushed to disk, and two dumbbell charts drawn with ECharts 6.1.0. The tables moved into that section. Under the DSON line, the hero has a second rotating line listing what defuss-dbsonl adds. `make e2e` checks that both charts draw, that the switches move the gauges, and that the page still does not scroll sideways at iPhone size.

VERIFIED: `tests/contracts.test.ts` adds eight tests for documented contracts no other test reached. Coverage rose from 91.33% to 93.86% of statements, 86.17% to 90.15% of branches, 96.39% to 97.29% of functions and 97.67% to 98.41% of lines. No production code changed.

## 0.5.0

VERIFIED: The website fits phones: code and tables scroll sideways instead of wrapping, tables tint every other row, cards put their icon beside the heading, and the install tabs stack. `make e2e` now also drives the website in WebKit at iPhone size, including the OPFS counter and the menu sheet, and fails if the page scrolls sideways.

VERIFIED: The OPFS demo replaces a worker that leaves a request unanswered for 5 s, retries a failed open on the next click and shows the browser error behind a failure. The demo was reported to stop on an iPhone after a delete; desktop WebKit and Chromium did not reproduce it, so the cause is still open.

VERIFIED: Commits got cheaper without changing the format or the lock protocol. A commit edits cached copies of the index pages on its paths instead of rereading and decoding them, and caches the pages it publishes. Publication patches the manifest parse cache, skips the directory sync (a commit creates no file), and truncates only when a failed commit left a tail. Native connections reuse one idle descriptor per lock name instead of reopening a lock file for every I/O lock and pin. In single-process probes on macOS arm64, a memory transaction fell from 0.31–0.38 ms to 0.14–0.15 ms and a durable Bun transaction from 1.16 ms to 0.50 ms; durable Node commits stay bound by their two flushes, which took about 3 ms each under Node on that host.

VERIFIED: Behavior change: a transaction now conflicts only when a key it read changed, appeared or disappeared after its snapshot, instead of on any concurrent commit. Writers on disjoint keys no longer retry; write skew and point-read phantoms are still rejected, and a transaction that scanned falls back to the whole-database check. With four contending writers, retries fell from 1.5 to 2.1 per commit to none.

VERIFIED: Commits queued on one handle publish as a group: one append, one generation flush and one head flush, with a revision and receipt per commit. A cancelled, conflicting or failing member is rejected alone. A transaction started while its handle's group holds the commit lock pins the last flushed head instead of waiting behind the group's flushes.

VERIFIED: A forming commit group waits, at most half the previous group's publication time, for transactions on its handle that already hold a snapshot. Four transaction writers on one handle had alternated between groups of one and three members; in full groups a contended durable Node commit fell from 4.4 to 2.1 ms on macOS arm64, and a contended memory commit from 65 to 59 µs under Node and from 72 to 63 µs under Bun. A transaction that outlasts one wait is not waited for again.

VERIFIED: defuss-dson is now 1.4.0, which writes the same frames as 1.3.0. In microbenchmarks of dbsonl's values, pages and manifests on macOS arm64 it encoded three to five times faster and decoded 2.5 to 6 times faster. Index pages and manifests use its `trusted` mode, which skips the per-property checks for plain data the engine built itself. On macOS arm64 a 24-entry leaf page encoded in 9 to 12 µs instead of 49 to 53 µs and decoded in 12 to 15 µs instead of 42 to 65 µs.

VERIFIED: Index pages are written by a page-specific DSON writer with the same bytes as `encodeFrame` in trusted mode (checked on 2000 generated pages per test run), about 30% faster per page, and the page cache evicts by second chance instead of reordering on every hit. Together they took a contended memory commit from 59 to 49 µs under Node and from 63 to 56 µs under Bun in single-process probes.

VERIFIED: Index edits and buffered appends run synchronously unless they need I/O, and native connections read the 8 KiB manifest with a blocking call; a cold manifest blocks the event loop for one 8 KiB read. A durable point read fell from 45 to 27 µs under Node and to about 33 µs under Bun in single-process probes.

VERIFIED: In `make bench-redis` on macOS arm64, defuss-dbsonl now takes less time than Redis in 12 of 16 pairings, against 4 for 0.4.0. The single durable Node writes still lose, because each commit flushes twice and a flush took about 3 ms under Node there, and so do the 1000-write batches in memory, where encoding each value as its own DSON frame costs more than Redis's `JSON.stringify`. `docs/PERFORMANCE.md` has the table.

VERIFIED: defuss-storage is now 0.3.1.

VERIFIED: `make bench-redis` compares the current build with a throwaway loopback Redis pinned in `mise.toml`: point reads, 1000-write batches, `WATCH`/`MULTI`/`EXEC` transactions against `transaction()`, and four contending writers. Each engine's turn starts after a full garbage collection, because otherwise one engine's garbage was collected inside the other's timed work. `docs/PERFORMANCE.md` has the results.

## 0.4.0

Breaking changes:

- The native entry `defuss-dbsonl/node` is renamed to `defuss-dbsonl/server`. Replace the import path; `createFileBackend` and its options are unchanged.
- The `defuss-dbsonl/legacy` subpath (the v0.1 log store) and the `defuss-dbsonl/records` frame API are removed, together with `examples/migrate.ts`. Migrate v0.1 data with defuss-dbsonl 0.3.x, then upgrade.

VERIFIED: Format 2 and the lock protocol are unchanged; the packed-package suite runs 0.2.0 and 0.4.0 writers concurrently against one database. `openDbsonl(..., { create: true })` completes an interrupted create: an empty head file whose generation files are all empty. Any persisted byte still fails closed with `CORRUPT`. Writer index-page loads use one known-length read. Browser tests cover directory-handle Storage through the format-2 API.

VERIFIED: Added a project website in `docs/index.html` whose demos run the library in the visitor's tab: a snapshot during transfers, a transaction conflict, a DSON round trip and an OPFS counter that survives reloads. `make e2e` drives every demo against the installed tarball. The npm package ships only the Markdown pages from `docs/`.

VERIFIED: `make bench` measures the vendored v0.2.0 and v0.3.0 builds beside the current build in one session. In three macOS arm64 runs, Bun ran some 0.4.0 read workloads slower than 0.3.0: snapshot reads and scans on memory storage by 20% to 26%, and scans on native storage by 12% to 34%. Node showed no consistent difference. `docs/PERFORMANCE.md` has the tables.

## 0.3.0

VERIFIED: Preserved format 2, all public operations, portable backends and legacy exports. Added per-database native descriptor ownership, local FIFO commit admission, nonblocking native lock attempts, concurrent positional reads and pipelined fresh-head/value reads. Metadata parsing is cached only while freshly read bytes match. Point values remain uncached and detached.

VERIFIED: Added bounded 64 KiB scan/compaction read-ahead and writer buffering before the existing durability barrier. Added repeated matched benchmarks against the shipped v0.2 tarball, Node/Bun equality-kernel measurements, mixed-version process tests and native resource/corruption regressions. Manual loop unrolling was measured and rejected for the shared implementation.

## 0.2.0

VERIFIED: Added persistent copy-on-write B+tree indexing, immutable snapshot roots, queued multi-client writers, atomic batches, optimistic serializable transactions, compare-and-swap revisions, streaming compaction, generation reclamation and full logical integrity verification. Native clients coordinate through whole-file OS locks; browser workers coordinate through Web Locks. Manifest publication uses two checksummed slots and a committed byte boundary.

VERIFIED: Added bounded page caching, aggregate pending-write admission, mixed Node/Bun process tests, SIGKILL coverage, browser-worker contention and a migration example. Retained the v0.1 implementation under `/legacy` and the unchanged frame API under `/records`. Root API and format are intentionally versioned changes; no automatic data rewrite occurs.

## 0.1.0

VERIFIED: Initial DSON framed record layer, append-only keyed log, bounded scans, explicit recovery inspection/repair and memory/native/browser adapter verification.
