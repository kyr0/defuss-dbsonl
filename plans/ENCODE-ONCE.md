# Encode-once ingestion: upstream DBSONL contract

Status: implemented in defuss-dbsonl 0.10.0 as `Dbsonl.batchFrames` and `Transaction.putFrame`, with every required semantic below, and the branded capability as `Dbsonl.frame(value)`, whose `OwnedFrame` handle commits without a copy or a decode (ARCH.md, Transactions, memory and lifecycle). The rest of this page is the proposal as written.

An additive upstream API could expose `Transaction.putFrame(key, frame)` and `db.batchFrames(mutations, options)` with a discriminated frame mutation type. Required semantics:

- Same key validation, limits, revision checks, conflict behavior, group commit and durability as value mutations. `tx.get` and scans decode the stored value, never expose wrapper bytes.
- Validate frame version, declared length, header/payload CRC32C and strict DSON structure/limits before accepting an untrusted frame. Require exactly one complete frame and no trailing bytes. A verified upstream encoder-produced owned frame could use an explicitly branded capability to avoid redundant semantic decoding, not an unchecked public boolean.
- Copy input at admission or use an explicit ownership transfer that detaches the whole buffer. Never retain mutable external memory. Account actual bytes plus key/metadata in pending and transaction admission.
- Stage encoded bytes directly, without decoding and re-encoding at publication. Preserve read-before-put semantics for insert-only logs and atomic secondary-index writes.
- Test parity with `put`/`batch`, typed cyclic values and malformed frames; concurrent writers, abort before publication, failure after publication, snapshot reads and ESM/CJS/native/OPFS. Benchmark against the existing value path with matched record sizes and commit policy.

Once upstream ships a verified interface, `defuss-logs` can retain the owned binary snapshot through admission and pass it to the transaction. Do not change upstream public APIs or repository contents as part of this release. Until then, v0.3 uses a strict binary round trip to establish snapshot ownership and relies on the public value-based commit path. This trades CPU for data integrity.
