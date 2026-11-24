# Architecture: package consumers

VERIFIED: These programs run after `scripts/e2e.ts` installs the packed tarball into a clean temporary project. Their imports resolve the package's `exports` map, not workspace source. Source-level tests cannot catch a missing export, a broken CommonJS build or declarations that need ambient types; these consumers can.

| File | Checks |
| --- | --- |
| `esm.ts` | ESM imports of the root and `/server` entries; rich DSON values through memory, native async and native sync backends, as values, as caller-encoded frames through `batchFrames` and `putFrame`, and as `frame()` handles; runs under Node and Bun |
| `v2-cjs.cts` | CommonJS imports of the root and `/server` entries, including the native lock binding; a transaction with `putFrame` of a `frame()` handle and of a frame, a `batchFrames` commit and a scan through the worker pool, whose ESM worker the CommonJS build starts, under Node and Bun |
| `v2-types.ts` | Root declarations compile with neither Node nor DOM ambient types; it contains intentional type-error assertions, among them a frame mutation that carries a value and a look-alike `OwnedFrame`, and is compiled, not run |
| `parallel.ts`, `parallel-worker.ts` | Four worker threads, each with its own native backend, scan the `split()` ranges of one pinned snapshot while the main thread commits and compacts; their counts and checksums add up to the full scan, and a backend created in a worker thread has no pool of its own. A default backend then scans the pinned snapshot through its own pool, in key order, with the same checksum; runs under Node and Bun |
| `v2.ts`, `v2-worker.ts` | Simultaneous writer processes, process-killed snapshots, killed atomic batches, reopening and reclamation |

VERIFIED: The contention run installs the shipped 0.2.0 tarball beside the current one, so format and lock compatibility are tested with live processes rather than copied files. Four writer processes, both versions under both runtimes, commit 60 increments without a lost update while an older snapshot stays unchanged. The 0.2.0 build creates the shared database, so both versions write format 2, and it must refuse a format 3 database that the current build created with `UNSUPPORTED`. The 0.2.0 baseline names its native entry `/node`; `scripts/e2e.ts` rewrites that one import for the baseline copy of `v2-worker.ts`.

VERIFIED: Killed processes establish process-termination behavior, not power-loss guarantees. All records and native directories are synthetic and temporary. No consumer starts a public server or contacts a production service.
