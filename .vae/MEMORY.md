# Agent memory

<!-- One tagged line per durable fact NOT derivable from code, git or docs:
- VERIFIED[scope] fact BC evidence
- HYPOTHESIS[scope] claim BC observation; falsifier=`cmd`
- UNKNOWN[scope] gap BC missing evidence
[scope] = the narrowest path|module|command|condition the evidence covers, not a topic: the entry decides nothing
outside it, and recurrence inside one subsystem never widens it.
Every line carries its BC and stays within 240 chars. Replace stale lines instead of appending.
Mechanizable lessons belong in tests or .vae/VERIFY.py.
Budget 4 KiB (`vae.py doctor --repo .`); entries are injected at session start. -->
- VERIFIED[Bun, defuss-dson 1.5.0 decodeFrame(s) at an offset] offsets held as doubles (decoded refs) deoptimized the reader, scanBatches 0.70 vs 0.52 of 0.5.0; 1.5.1 converts them itself BC OSR exits 503→0 with int32
- VERIFIED[defuss-db bench store, Node 26/Bun 1.4.4] format 4 compact pages: 100k load 13.0-15.7→8.7-9.5 s, 11→5 compactions, 102→33 MiB; warm reads unchanged; Bun get is bimodal 13/23 µs in every format, not a format effect BC A/B 2026-11-21
- VERIFIED[release artifacts] user keeps no release tarballs, ZIPs or checksums; make e2e repacks output/<pkg>-<version>.tgz, so publish right after make release or from the repo BC user request 2026-11-24
