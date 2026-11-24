# Episodes

<!-- Newest last. The gate appends FAIL|DONE|FINDING; past 100 entries it trims only its own oldest DONE|FAIL|learned
FINDING (git keeps them). Leads (LESSON, FINDING learn=none) stay until wrap settles them; doctor fails above 30.
Agents append `<UTC ISO> s=<session> LESSON <VAE-DIALECT>` only for a falsified HYPOTHESIS, a dead end, or a root cause.
Session start injects the 3 newest open entries: LESSON, FINDING learn=none, FAIL without a later DONE.
Wrap: EVERY lead becomes a test | .vae/VERIFY.py rule | one MEMORY line with BC, then delete; OR delete BC evidence. -->

2026-11-14T13:56:12Z s=afa01d3f FINDING scripts/e2e.ts:69 learn=none: dev-harness fix; no proportionate mechanical check for every listen call
2026-11-14T13:56:12Z s=afa01d3f FINDING docs/LEGACY.md:13-28,45 learn=none: semantic doc drift; not mechanically checkable
2026-11-14T13:56:12Z s=afa01d3f FINDING ARCH.md:37; docs/PERFORMANCE.md:55,83 learn=none: semantic scope
2026-11-14T13:56:12Z s=afa01d3f FINDING docs/PERFORMANCE.md:3,81 learn=none: semantic evidence
2026-11-14T13:56:12Z s=afa01d3f FINDING tests/browser/ARCH.md:7; scripts/ARCH.md:3,12; tests/ARCH.md; src/legacy/ARCH.md:19; docs/legacy/ARCH.md:3; docs/legacy/API.md:3 learn=none: semantic doc drift
2026-11-14T14:32:48Z s=afa01d3f FINDING scripts/bench.ts:38 learn=none: report-text correctness; no proportionate mechanical check
2026-11-15T14:41:31Z s=afa01d3f FINDING site/demo.ts:conflicts learn=none: Demo-only control flow; forcing a memory put to fail needs a fault hook the public API does not offer, so no real-subsystem test can trigger it.
2026-11-15T14:41:31Z s=afa01d3f FINDING site/demo.ts:snapshots learn=none: Presentation state; the e2e run drives the transfer path.
2026-11-15T15:56:37Z s=afa01d3f FINDING docs/index.html:hero-title learn=none: Copy decision by the human; no mechanical check applies.
2026-11-15T16:01:02Z s=afa01d3f FINDING docs/index.html:hero-title learn=none: Copy accuracy; the types demo in e2e covers the round-trip behavior the copy describes.
2026-11-15T16:01:02Z s=afa01d3f FINDING docs/index.html:hero rotate learn=none: Component limit documented in its CSS comment; one-off markup.
2026-11-15T16:01:02Z s=afa01d3f FINDING docs/index.html:mk-hero-desc learn=none: Prose repetition; not mechanically checkable.
2026-11-15T16:06:10Z s=afa01d3f FINDING docs/PERFORMANCE.md:intro learn=none: Reference wording; not mechanically checkable.
2026-11-15T16:06:10Z s=afa01d3f FINDING docs/index.html:hero-title learn=none: Copy accuracy; the e2e types demo covers the round trip.
2026-11-15T16:06:10Z s=afa01d3f FINDING docs/index.html:hero rotate learn=none: Component limit documented in its CSS; one-off markup.
2026-11-15T16:06:10Z s=afa01d3f FINDING site/demo.ts:conflicts learn=none: Demo-only control flow; forcing a memory put to fail needs a fault hook the public API does not offer.
2026-11-15T16:09:19Z s=afa01d3f FINDING docs/index.html:#tests learn=none: Keeping them current needs either generating the page section from output/coverage at make site time or a check against coverage-summary; neither exists yet. Ra
2026-11-15T16:09:19Z s=afa01d3f FINDING docs/index.html:#stack learn=none: Positioning copy; README carries the same sentence.
2026-11-15T16:09:19Z s=afa01d3f FINDING docs/index.html:hero rotate learn=none: Component limit documented in its CSS.
2026-11-15T16:10:10Z s=afa01d3f FINDING docs/index.html:#why open card learn=none: Copy accuracy; checked against ARCH.md and the benchmark file.
2026-11-15T16:22:10Z s=afa01d3f FINDING docs/index.html:#tests rings learn=none: Component behavior read from its source; one-off markup.
2026-11-15T16:24:56Z s=afa01d3f FINDING scripts/bench.ts:baselines learn=none: Benchmark harness change; checksum mismatch throws before measuring, which is the mechanical guard.
2026-11-15T16:31:44Z s=afa01d3f FINDING docs/PERFORMANCE.md:3 B01 learn=none: Root cause not established; no regression test before the cause is known (timing assertions are banned in correctness tests by tests/ARCH.md). Raised to the hum
2026-11-15T17:13:42Z s=afa01d3f FINDING docs/index.html:hero transfer.ts learn=none: Example copy checked against docs/API.md and the demo behavior covered by make e2e.
2026-11-15T17:14:05Z s=afa01d3f FINDING docs/index.html:#stack learn=none: One-off link.
2026-11-15T17:15:10Z s=afa01d3f FINDING docs/index.html:#performance learn=none: Label copy; Node.js embeds V8 and Bun embeds JavaScriptCore.
2026-11-16T11:46:21Z s=85830ead FINDING scripts/bench-redis.ts:configGet dir learn=none: The guard itself is the mechanical check and runs on every make bench-redis.
2026-11-16T11:46:21Z s=85830ead FINDING scripts/e2e.ts:db-sheet wait learn=none: One-off test-code defect; the passing e2e run covers it.
2026-11-16T11:46:21Z s=85830ead FINDING site/opfs.worker.ts:open learn=none: Whether a transient open failure caused the iPhone report is not established; no device was available.
2026-11-16T11:46:21Z s=85830ead FINDING site/ARCH.md:9 L01 learn=none: Wording fix.
2026-11-16T11:46:21Z s=85830ead FINDING CHANGELOG.md:7 P04 learn=none: Wording fix.
2026-11-16T11:46:21Z s=85830ead FINDING docs/PERFORMANCE.md:46 B03 learn=none: Wording fix.
2026-11-16T11:46:21Z s=85830ead FINDING docs/index.html:.table tbody .table-row:nth-child(even) learn=none: Root cause documented in the CSS comment; no rule kind can check rendered color.
2026-11-16T11:46:21Z s=85830ead FINDING docs/index.html:.db-install .tab-list learn=none: Visual layout; e2e asserts no sideways page scroll, not label truncation.
2026-11-16T11:46:21Z s=85830ead FINDING docs/index.html:.db-points learn=none: Visual layout.
2026-11-16T11:46:21Z s=85830ead FINDING scripts/redis-worker.ts:connect learn=none: Comment only.
2026-11-16T15:04:31Z s=85830ead FINDING src/core/tree.ts:BatchTree.finish, src/core/store.ts:commit learn=none: Only a tree-construction defect could trigger it; no real input produces an invalid page to test with.
2026-11-16T16:02:49Z s=85830ead FINDING src/core/store.ts:drain learn=none: A test that queued the commit from the cancelled member's rejection handler passed with and without the fix; the window depends on microtask order inside the co
2026-11-16T16:02:49Z s=85830ead FINDING src/core/store.ts:close learn=none: Release after connection close was already handled by the release function; no deterministic failing case observed.
2026-11-16T16:02:49Z s=85830ead FINDING src/core/store.ts:awaitSiblings (removed) learn=none: Documented in docs/PERFORMANCE.md as a rejected experiment.
2026-11-16T16:02:49Z s=85830ead FINDING src/core/codec.ts:allocate (removed) learn=none: Documented in docs/PERFORMANCE.md.
2026-11-16T16:02:49Z s=85830ead FINDING tests/commit-groups.test.ts learn=none: Test code only.
2026-11-16T17:59:39Z s=85830ead FINDING src/core/io.ts:publish, Appender.value; src/core/store.ts:encode learn=none: Cross-version reading stays gated by make e2e, which runs the 0.2.0 tarball with its own defuss-dson 1.3.0 concurrently with the new build on one database.
2026-11-16T17:59:39Z s=85830ead FINDING validation/bench-redis-macos-arm64.json learn=none: Process-to-process variance under Bun; the isolated checked read loop was faster on 1.4.0 (8.6-15 vs 20-24 ms).
2026-11-16T19:03:10Z s=85830ead FINDING src/core/store.ts:drain readHead learn=none: Equivalent outcome by code reading; retries in publishGroup still pass no head and re-read it.
2026-11-16T19:03:10Z s=85830ead FINDING scripts/redis-worker.ts:collect learn=none: Documented in docs/PERFORMANCE.md: it turned Bun's memory batch from 0.47 to 1.61 of Redis's time.
2026-11-16T19:03:10Z s=85830ead FINDING tree.ts split threshold (probe, reverted) learn=none: Documented as rejected in docs/PERFORMANCE.md.
2026-11-16T19:37:01Z s=85830ead FINDING package.json:version learn=none: Version bump only; no code path changed.
2026-11-16T19:57:55Z s=a4ea8ca3 FINDING README.md:17 (B evidence) learn=none: Prose evidence slip; not mechanically checkable.
2026-11-16T19:57:55Z s=a4ea8ca3 FINDING docs/index.html: What you get, Guarantees, conflict demo, page-cache and several-writers cards (L logic) learn=none: Semantic doc drift; no deterministic rule distinguishes old from new wording.
2026-11-16T19:57:55Z s=a4ea8ca3 FINDING docs/PERFORMANCE.md macOS section (B evidence) learn=none: Prose evidence slip.
2026-11-16T21:13:21Z s=a4ea8ca3 FINDING docs/index.html:Redis comparison script guard learn=none: A CDN outage is not reproducible in e2e without blocking the request; proportionate check would mock the network, which the project rules forbid.
2026-11-16T21:13:21Z s=a4ea8ca3 FINDING docs/index.html:RUNS learn=none: Figures change only with a new benchmark run; a test pinning them would pin values that worked once.
2026-11-16T22:12:24Z s=a4ea8ca3 FINDING src/index.ts:BatchScanOptions learn=none: pkgroll reports this as a warning, not an exit code; failing the build on dts warnings would be a broader tooling change.
2026-11-16T22:12:24Z s=a4ea8ca3 FINDING src/core/io.ts:readValue, src/core/store.ts:cachedValue learn=none: Structure cleanup, no defect.
2026-11-16T22:12:24Z s=a4ea8ca3 FINDING scripts/bench-scan.ts:record learn=none: Naming only.
2026-11-17T00:12:30Z s=a4ea8ca3 FINDING CHANGELOG.md:0.6.0 P-precision learn=none: Wording only.
2026-11-17T00:40:14Z s=a4ea8ca3 FINDING src/core/io.ts:readCachedValues learn=none: Simplification; behavior covered by the existing batches test.
2026-11-20T05:09:19Z s=ad85a3b9 FINDING src/core/store.ts:ReadSession.parallel learn=none: A timing regression; correctness is covered by the limit cases in tests/scan-workers.test.ts, and speed belongs to make bench-parallel, not a timed test.
2026-11-20T05:30:47Z s=ad85a3b9 FINDING src/core/store.ts:batchBytes/parallel scan, src/scan-pool.ts learn=none: A design decision recorded in ARCH.md; no code was added.
2026-11-20T06:47:03Z s=ad85a3b9 FINDING ARCH.md#parallel-scans learn=none: Documentation omission, no code.
2026-11-20T06:47:03Z s=ad85a3b9 FINDING scripts/e2e.ts:Redis gauges learn=none: The assertion follows the published data by design.
2026-11-20T13:23:14Z s=dbsonl-r FINDING src/core/store.ts:ReadSession.parallel; src/core/tree.ts:split learn=none: A timing bound would pin this machine's speed; tests/scan-workers.test.ts now also runs {gte, limit} through the new planning path and compares rows with one th
2026-11-20T13:23:14Z s=dbsonl-r FINDING CHANGELOG.md:13 B learn=none: One-off wording left from the 0.4.0 bump.
2026-11-20T13:23:14Z s=dbsonl-r FINDING CHANGELOG.md:17 B learn=none: Figures were replaced in PERFORMANCE.md after the changelog line was written.
2026-11-20T13:23:14Z s=dbsonl-r FINDING README.md:3 P learn=none: Version bump missed in the intro sentence.
2026-11-20T13:23:14Z s=dbsonl-r FINDING src/core/io.ts:publish; src/core/backend.ts:locked; src/core/types.ts:ParallelScanRequest learn=none: Found by the docs stage's per-function check, which covers this class.
2026-11-21T00:02:09Z s=dbsonl-r FINDING docs/API.md maxCacheBytes, page cache charge learn=none: decoded page memory per page was not measured; reported to the human for the defuss-db upgrade
2026-11-21T00:02:09Z s=dbsonl-r FINDING src/core/page.ts:175 oxlint unicorn/no-new-array learn=none: make lint enforces it
2026-11-21T00:09:31Z s=dbsonl-r FINDING package.json, README.md:1, CHANGELOG.md, docs/FORMAT.md, docs/index.html badge, comments in src/core/store.ts, io.ts, types.ts learn=none: version wording; the gate re-verifies the tree
2026-11-23T23:32:45Z s=cc782d00 FINDING src/core/store.ts:ownFrame learn=test: tests/frames.test.ts malformed test: a zero buffer of maxRecordBytes + 17 bytes must be RangeError; removing the bound fails it (mutation probe).
2026-11-23T23:32:45Z s=cc782d00 FINDING tests/frames.test.ts:copy test learn=test: Mutations slice(), no copy and no trailing-bytes check each fail one frames test (probes, restored, no vae:probe left).
2026-11-23T23:32:45Z s=cc782d00 FINDING tests/frames.test.ts:concurrent test title learn=none: Naming only; no recurring mechanism to check.
2026-11-23T23:32:45Z s=cc782d00 FINDING ARCH.md:97 L03 learn=none: Epistemic wording; no deterministic rule expresses it.
2026-11-23T23:32:45Z s=cc782d00 FINDING ARCH.md:96 B04 learn=none: One-off wording.
2026-11-23T23:32:45Z s=cc782d00 FINDING CHANGELOG.md:5 S06/B03 learn=none: One-off wording.
2026-11-23T23:32:45Z s=cc782d00 FINDING README.md:54 T04/P01 learn=none: One-off wording.
2026-11-23T23:32:45Z s=cc782d00 FINDING docs/API.md:39 A10/P08 learn=none: One-off structure.
2026-11-23T23:32:45Z s=cc782d00 FINDING tests/consumers/ARCH.md:8 P08 learn=none: One-off wording.
2026-11-24T00:25:31Z s=cc782d00 DONE fp=80e1b9e99e85 cov=94.5% paths=ARCH.md,CHANGELOG.md,Makefile,README.md(+21)
2026-11-24T00:25:31Z s=cc782d00 FINDING README.md:53, docs/API.md:43, CHANGELOG.md:5 B03 learn=none: Hand-computed ratios; no rule ties page numbers to output/bench-frames.json, which is gitignored and overwritten per run.
2026-11-24T00:25:31Z s=cc782d00 FINDING docs/API.md:43 B01 (OwnedFrame across ESM and CJS) learn=none: Probe confirmed the documented behavior; a dual-build e2e test would pin an accepted limitation, not a requirement.
2026-11-24T00:36:39Z s=dbsonl-r DONE fp=ecfaa3d60041 cov=94.5% paths=ARCH.md,CHANGELOG.md,Makefile,README.md(+60)
2026-11-24T00:36:39Z s=dbsonl-r FINDING src/core/store.ts:publishGroup (Recovered branch) learn=test: tests/format3.test.ts 'a write rejected before recovery stays rejected when its group is checked again' fails on memory and native storage without the fix and p
2026-11-24T00:36:39Z s=dbsonl-r FINDING release scope: paths unchanged since fingerprint 8bccbf (0.9.0 release plus the esbuild 0.28.2 bump, commit b7e8ba3) learn=none: Scope bookkeeping for a cumulative release session, not a defect.
2026-11-24T00:39:28Z s=cc782d00 DONE fp=8aeac17f9e07 cov=94.5% paths=ARCH.md,CHANGELOG.md,Makefile,README.md(+25)
2026-11-24T00:39:28Z s=cc782d00 FINDING validation/bench.json, validation/bench-scale.json, validation/coverage-summary.json, validation/e2e.json learn=none: Generated release evidence, no code or doc defect.
2026-11-24T01:10:38Z s=cc782d00 DONE fp=dcf22696fb91 cov=94.5% paths=ARCH.md,CHANGELOG.md,Makefile,README.md(+22)
2026-11-24T01:10:38Z s=cc782d00 FINDING scripts/release.ts (validation copies) learn=verifier: .vae/VERIFY.py rule release.no-validation-writes (not_regex validation/ in scripts/release.ts); a probe line made it fail, then was removed.
2026-11-24T01:11:40Z s=dbsonl-r DONE fp=2c66f52e6dbd cov=94.5% paths=ARCH.md,CHANGELOG.md,Makefile,README.md(+61)
2026-11-24T01:11:40Z s=dbsonl-r FINDING src/core/page.ts encodeCompactPage/decodeCompactPage, src/core/tree.ts toPage, src/core/io.ts Appender.compact, src/core/store.ts (format 4) learn=test: tests/format4.test.ts and tests/format3.test.ts cover hard keys, deletes, compaction, reopening, mismatch, malformed pages and format 3 staying format 3
2026-11-24T01:11:40Z s=dbsonl-r FINDING tests/format3.test.ts format 2 case learn=test: the test runs on memory and native storage
2026-11-24T01:11:40Z s=dbsonl-r FINDING src/core/store.ts:remember (page cache eviction) learn=test: tests/mvcc.test.ts checks both limits at one page and 40 pages and that the cache is never emptied; removing the guard for the just-loaded page fails it (expect
2026-11-24T01:11:40Z s=dbsonl-r FINDING src/server.ts:spawnScanWorker; src/core/{common,io,tree,store}.ts constructors; tsconfig.json learn=verifier: make lint runs tsc with erasableSyntaxOnly, which rejects parameter properties, enums and namespaces, the syntax Node's type stripping cannot load.
2026-11-24T01:13:05Z s=cc782d00 DONE fp=1cef1e894201 cov=94.5% paths=ARCH.md,CHANGELOG.md,Makefile,README.md(+22)
2026-11-24T01:13:05Z s=cc782d00 FINDING scripts/release.ts (ZIP file list) learn=none: Checked by inspecting a release ZIP; a test would need a full make release, which the gate cannot run.
2026-11-24T01:14:13Z s=dbsonl-r DONE fp=4fe5a3f23f49 cov=94.5% paths=ARCH.md,CHANGELOG.md,Makefile,README.md(+61)
2026-11-24T01:14:13Z s=dbsonl-r FINDING src/core/store.ts effective/memoryPages/publishGroup/session/verify/compact/create, src/core/io.ts checkHead/commitRecord/recoverTail/readRecord/readChanges/sameRef, src/core/tree.ts BatchTree (optional writer, load, mine, memoryPages, open, isMemoryPage), src/core/page.ts encodeChanges/decodeChanges, src/core/types.ts Head, tests/format5.test.ts, tests/older.ts, tests/format3|format4|mvcc|contracts tests, consumers wording, docs/FORMAT.md, docs/API.md, ARCH.md, src/core/ARCH.md, tests/ARCH.md, CHANGELOG 0.9.0, version 0.9.0 learn=test: tests/format5.test.ts pins replay, checkpoints, corruption and worker replay; .vae/MEMORY.md records the tarball overwrite
2026-11-24T01:14:13Z s=dbsonl-r FINDING src/core/io.ts readFrames/checkedFrame/readGeneration/crc32c, src/core/page.ts checksum export, src/core/store.ts compact() copy loop, tests/compaction-copy.test.ts, ARCH.md, src/core/ARCH.md, tests/ARCH.md, CHANGELOG.md 0.8.1, package.json/README/docs/index.html version learn=test: tests/compaction-copy.test.ts pins the copy path's correctness and corruption detection
2026-11-24T01:14:13Z s=dbsonl-r FINDING src/core/page.ts decode (falsified hypothesis) learn=memory: recorded in .vae/MEMORY.md so nobody chases it again
