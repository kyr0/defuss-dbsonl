# defuss-dbsonl 0.10.0

Transactional key-value storage for Node.js, Bun and browser workers. Values are DSON, so dates, binary views, bigint, `undefined` and cyclic references survive storage. It is built on [defuss-dson](https://dson.defuss.org) 1.5.1 and [defuss-storage](https://storage.defuss.org) 0.4.1 and ships TypeScript declarations with ESM and CommonJS builds. It is designed as the backing store and API of [defuss-dataview](https://dataview.defuss.org), which adds filters, sorting and paging for table and tree grids. Project website: [dbsonl.defuss.org](https://dbsonl.defuss.org).

VERIFIED: A database is a persistent copy-on-write B+tree with immutable snapshots, atomic batches, optimistic serializable transactions, compaction and process-safe coordination. Opening reads two small manifest slots instead of replaying a log, and readers never block writers.

## Install

```sh
bun add defuss-dbsonl
# or
npm install defuss-dbsonl
```

The package is on the npm registry. It needs Node.js 20.19 or newer, Bun, or a dedicated browser worker with OPFS and Web Locks. `defuss-dson` and `defuss-storage` install with it.

VERIFIED: The native lock addon, `@lickle/lock`, ships prebuilt binaries as optional dependencies for Linux x64 glibc, macOS x64 and arm64, and Windows x64, so nothing compiles during installation. On 2026-11-16, `bun add defuss-dbsonl@0.5.0` and `npm install defuss-dbsonl@0.5.0` in empty projects each installed five packages, none of which declares an install script, and the `/server` entry stored and read a value under both Node.js and Bun on macOS arm64.

To install a local build instead, `make release` writes the tarball to `validation/`; add it with `bun add ./validation/defuss-dbsonl-<version>.tgz`.

## Use

```ts
import { openDbsonl } from 'defuss-dbsonl';
import { createFileBackend } from 'defuss-dbsonl/server';

const backend = await createFileBackend('./data');
const db = await openDbsonl<number>(backend, 'accounts', { create: true });
await db.batch([
  { operation: 'put', key: 'alice', value: 100 },
  { operation: 'put', key: 'bob', value: 50 },
]);

const before = await db.beginRead();
try {
  await db.transaction(async tx => {
    const alice = (await tx.get('alice')).value!;
    const bob = (await tx.get('bob')).value!;
    tx.put('alice', alice - 20);
    tx.put('bob', bob + 20);
  });
  console.log((await before.get('alice')).value); // 100: the snapshot keeps its root.
  await db.compact();
} finally {
  await before.close();
  await db.collect();
  await db.close();
}
```

The transaction callback runs once. A concurrent commit that changed a key the callback read makes it fail with `CONFLICT` instead of retrying, because a retry would repeat any side effects in your callback; after a scan, any concurrent commit does. Retry explicitly where that is safe. Concurrent batches and transactions on one handle publish together: one write and one pair of flushes for the queued group, while each keeps its own revision and receipt. `ifRevision` gives compare-and-swap for changes prepared outside a transaction.

A caller that already holds a value's DSON frame, for example because it keeps an encoded snapshot of the value, commits it with `batchFrames()` or `tx.putFrame()` instead of encoding the value again. DBSONL copies the frame and decodes it once to check it, so a damaged or partial frame is refused before it commits; reads return the value. A caller that encodes only to keep a snapshot until it commits can take it with `db.frame(value)` instead: the engine keeps the bytes, so committing the snapshot needs no copy and no check, and took 0.99 to 1.11 of the time of `batch` with the values, against 1.18 to 2.71 for encoding, decoding and committing the copy ([PERFORMANCE.md](docs/PERFORMANCE.md#caller-encoded-frames-on-macos-arm64)); [API](docs/API.md) lists the checks.

For bulk reads, a snapshot's `scanBatches()` yields the same rows as `scan()` in arrays of up to 256. It tracks one pull per batch instead of one per row, so a full scan takes less time; [API](docs/API.md) has its byte budget and options.

On native storage, `scanBatches()` uses worker threads by itself once a snapshot range holds at least 5000 rows: a pool of up to four workers decodes the rows and hands them back in key order. A full scan of 100,000 documents took 105 ms instead of 401 ms under Node. `createFileBackend(root, { scanWorkers: 0 })` turns the pool off; scans with a `sizeOf` callback, `scan()` row iterators and memory and browser backends stay in the calling thread.

To run your own filters and aggregates in workers, or to scan in browser workers, `split(n)` cuts a snapshot into at most `n` key ranges with exact row counts. Each worker opens its own backend and handle on the same files, pins the same snapshot with `beginRead({ at: head })` and scans one range. The first snapshot must stay open until every worker has pinned. In Node.js and Bun worker threads, open native backends with `{ io: 'sync' }`: a scanning thread can block itself, and asynchronous reads queue on the thread pool that all threads of a process share.

```ts
// Coordinator: pin, split, hand out the head and one range per worker.
const session = await db.beginRead();
const ranges = await session.split(4);
// Worker, on its own createFileBackend(root, { io: 'sync' }) and openDbsonl(backend, 'accounts'):
const view = await workerDb.beginRead({ at: head });
for await (const batch of view.scanBatches(range)) { /* decode and filter here */ }
await view.close();
```

With 8 worker threads that keep their rows, a full scan of 100,000 native documents took 22 ms under Node against 121 ms in one thread, with the index cached on every handle ([PERFORMANCE.md](docs/PERFORMANCE.md#parallel-scans-on-macos-arm64)).

Memory storage needs no platform entry:

```ts
import { createMemoryBackend, openDbsonl } from 'defuss-dbsonl';
const db = await openDbsonl(createMemoryBackend(), 'example', { create: true });
await db.put('binary', new Uint8Array([1, 2, 3]));
await db.close();
```

In a dedicated browser worker:

```ts
import { createOPFSStorage } from 'defuss-storage/opfs';
import { createBrowserBackend } from 'defuss-dbsonl/browser';
import { openDbsonl } from 'defuss-dbsonl';
const namespace = 'my-app';
const storage = await createOPFSStorage({ name: namespace });
const backend = createBrowserBackend(storage, namespace, navigator.locks);
const db = await openDbsonl(backend, 'documents', { create: true });
await db.put('hello', { bytes: new Uint8Array([42]), time: new Date() });
await db.close();
```

Every adapter that reaches the same files must use the same Web Locks namespace, because the namespace is the only thing that tells two workers they share a database. `createDirectoryStorage` works the same way. With Storage admission limits below 64 KiB, pass the accepted write chunk size as the fourth `createBrowserBackend` argument.

| Entry | Contents | Why it is separate |
| --- | --- | --- |
| `defuss-dbsonl` | `openDbsonl`, `createMemoryBackend`, errors, types | Runs anywhere; declarations need neither Node nor DOM types |
| `defuss-dbsonl/server` | `createFileBackend` for Node.js and Bun | Loads the native lock addon and `node:fs`, which browser bundles must not see |
| `defuss-dbsonl/browser` | `createBrowserBackend` over Web Locks | Keeps the Web Locks adapter out of server bundles |

## Design choices

Each row names the obvious alternative, the reason it was not taken and the cost of the choice.

| Concern | Plausible alternative | Chosen | Why | Cost |
| --- | --- | --- | --- | --- |
| Finding keys | In-memory key map rebuilt by replaying a log | Persistent B+tree, fanout 32, bounded page cache | Memory does not grow with key count and open needs no replay | Uncached point reads perform disk I/O |
| Readers versus writers | Read locks that block commits | Immutable roots and shared generation pins | A slow reader cannot stall writers | Old generations stay on disk until readers close |
| Atomic publication | Write a new file, then rename it | Two checksummed head slots, written alternately | OPFS and Storage expose no uniform atomic rename | Every commit writes one 4 KiB slot |
| Multiple writers | One owning process | OS whole-file locks or Web Locks, held per commit group | Independent processes and workers can share one database | Commits still serialize to keep one revision order |
| Transactions | One revision check for the whole database | Each point read rechecked at commit; the whole-database check after a scan | Writers on disjoint keys commit without retrying, and write skew and phantoms are still ruled out | A transaction keeps the revision of every key it read, up to `maxTransactionOperations` keys, then falls back to the whole-database check |
| Space reuse | In-place updates or a background vacuum | Explicit `compact()` and `collect()` | No hidden I/O; the application chooses when to pay | Compaction needs disk space for one live copy |
| Stale locks | Lock files that expire after a timeout | Kernel locks released on process death | A paused process never loses ownership to a second writer | Requires the native addon on servers |

VERIFIED: `compact()` lets writers continue while it copies and returns `CONFLICT` if one of them published meanwhile. `compact({ mode: 'exclusive' })` queues writers instead, which guarantees progress under sustained write traffic. Existing snapshots stay readable either way. Compaction does not delete anything; `collect()` reclaims unpinned obsolete and abandoned generations.

## Guarantees and boundaries

VERIFIED: A published root makes a whole batch visible at once. Values and index pages are flushed before a head slot is written. Native factories also sync the directory after creating or removing a file, before any head refers to it; a commit only appends to and overwrites existing files. Two checksummed slots survive an interrupted write of either one. A writer reuses any unpublished tail left by a failed commit. Published corruption fails validation; nothing repairs data automatically, because a guessed repair can turn damage into silent data loss.

VERIFIED: Native locking uses `@lickle/lock` 0.0.1, which takes whole-file `flock`/`LockFileEx` locks through a Node-API addon. Version 0.3.0 was tested on Linux x64; on 2026-11-14 the full suite, including process termination and the packed-package run, also passed on macOS arm64. Both used Node 24.22.1 and Bun 1.4.3. Chromium workers were tested with real OPFS, directory handles and Web Locks. Memory backends coordinate only clients that share one backend object.

VERIFIED: No test run has exercised power cuts, network filesystems, Windows or Firefox, so their behavior is unknown. WebKit has run only the website demos, including the OPFS counter, in Playwright's WebKit build at iPhone size; the browser test suite runs in Chromium. The addon ships binaries for Linux x64 glibc, macOS x64/arm64 and Windows x64. The native factory refuses to start where directory sync is unsupported, rather than silently promising less durability. OPFS has no directory-sync API and reports `durability: 'file'`; memory reports `'memory'`. There is no distributed consensus, encryption or protection against hostile writers.

Resource budgets cap retained engine work. The page cache is bounded by encoded bytes and page count, independent of key count. Decoded values, active traversal paths, caller-held values, snapshots and the memory adapter's stored bytes are outside that budget. [API](docs/API.md) lists the defaults and error codes.

## Compatibility

VERIFIED: Versions 0.2 through 0.6 share the on-disk format and the lock protocol. The packed-package suite runs 0.2.0 and the current build concurrently on Node and Bun against one database, so upgrading needs no migration.

Version 0.4.0 renamed the native entry from `defuss-dbsonl/node` to `defuss-dbsonl/server` and removed the `/legacy` and `/records` subpaths. Data in the v0.1 log format must be migrated with defuss-dbsonl 0.3.x first; that release ships `defuss-dbsonl/legacy` and `examples/migrate.ts`. See [CHANGELOG.md](CHANGELOG.md).

## Develop and verify

```sh
make setup    # pinned Node/Bun/Redis via mise, dependencies, Chromium, WebKit, VAE runtime
make verify   # lint, tests, coverage, packed-package e2e
make bench    # matched v0.2 versus current benchmarks
make bench-scan   # full scans, row by row and in batches, against the vendored 0.5.0
make bench-redis  # current build versus a throwaway loopback Redis, run as mise exec -- make bench-redis
make bench-frames # values through batch against caller-encoded frames and frame() handles through batchFrames
make dev      # rebuild the website demos and serve docs/ on 127.0.0.1:3000
make vae      # verification, review and documentation gate
make release  # tarball, source ZIP and checksums; never publishes or commits
```

VERIFIED: `make verify` runs strict type checks, lint, real-storage tests, coverage thresholds and a packed-package suite on Node, Bun and Chromium, plus the website in WebKit at iPhone size. That suite runs mixed Node/Bun processes on both 0.2.0 and the current build, kills writers mid-batch and runs concurrent browser workers. `make release` packages only after the pinned defuss-vae 0.9.0 gate passes for the current source fingerprint. `make` lists every target; `.env.example` documents the browser executable overrides.

| Page | Answers |
| --- | --- |
| [docs/index.html](docs/index.html) | The project website, with demos that run the library in the visitor's tab; `make site` rebuilds its bundles |
| [ARCH.md](ARCH.md) | Why the protocol is built this way: lock order, crashes, reclamation, security |
| [docs/API.md](docs/API.md) | Every operation, option default, budget and error code |
| [docs/FORMAT.md](docs/FORMAT.md) | Files on disk, slot layout and publication order |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | Benchmark protocol, results and the reasons behind the read path |

Every authored source folder has its own ARCH.md.
