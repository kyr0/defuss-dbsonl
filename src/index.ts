/** VERIFIED: The root entry is isomorphic; native locking lives only in the node subpath. */
export { openDbsonl } from './core/store.js';
export type { Dbsonl, ReadSession } from './core/store.js';
export { createMemoryBackend } from './core/backend.js';
export { DbsonlError, DEFAULT_OPTIONS } from './core/common.js';
export type { ErrorCode } from './core/common.js';
export type { Head, Page, Partition, ReadOptions, Ref, Backend, Coordinator, Release, Options, Lookup, Row, ScanOptions, BatchScanOptions, Mutation, FrameMutation, OwnedFrame, Commit, CommitOptions, Stats, Transaction } from './core/types.js';
