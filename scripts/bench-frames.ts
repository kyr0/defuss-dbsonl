/** VERIFIED: Times committing caller values through batch against frames the caller encoded through batchFrames. */
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { arch, cpus, loadavg, platform, release } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const records = 10000, batchSize = 256, rounds = 7;
// Log entries of two sizes: about 200 bytes and about 4 KiB encoded.
const shapes = {
  small: (i: number) => ({ at: new Date(1_700_000_000_000 + i), level: 'info', message: `request ${i} served`, fields: { id: i, path: '/api/items', ms: i % 97 } }),
  large: (i: number) => ({ at: new Date(1_700_000_000_000 + i), level: 'warn', message: `slow request ${i} `.repeat(100), fields: { id: i, path: '/api/items', ms: i % 97, tags: ['a', 'b', 'c'] } }),
};
type Db = { batch(input: unknown[]): Promise<unknown>; batchFrames(input: unknown[]): Promise<unknown>; frame(value: unknown): unknown; stats(): Promise<{ count: number; committedBytes: number }>; close(): Promise<void> };
type Build = { openDbsonl(backend: unknown, name: string, options: object): Promise<Db>; createMemoryBackend(): unknown; createFileBackend(root: string): Promise<unknown> };
type Codec = { encodeFrame(value: unknown): Uint8Array; decodeFrame(bytes: Uint8Array): { value: unknown } };

/** One process per runtime: the four paths commit the same records in the same batches, alternating order every round. */
async function worker(output: string): Promise<void> {
  const bun = (globalThis as { Bun?: { gc(force: boolean): void } }).Bun, nodeGc = (globalThis as { gc?: () => void }).gc;
  if (!bun && !nodeGc) throw new Error('Run the worker with --expose-gc under Node.js.');
  const collect = () => { if (bun) bun.gc(true); else nodeGc!(); };
  const build: Build = { ...await import(pathToFileURL(resolve('dist/index.mjs')).href), createFileBackend: (await import(pathToFileURL(resolve('dist/server.mjs')).href)).createFileBackend };
  const { encodeFrame, decodeFrame } = await import('defuss-dson/sequence') as Codec;
  const keys = Array.from({ length: records }, (_, i) => `log:${String(i).padStart(8, '0')}`);
  // Each path starts from the caller's values and ends when the last batch commits, so caller-side encoding counts.
  const paths: Record<string, (db: Db, values: unknown[]) => Promise<void>> = {
    // The value path alone: DBSONL encodes each value once.
    'batch': async (db, values) => { for (let i = 0; i < records; i += batchSize) await db.batch(keys.slice(i, i + batchSize).map((key, j) => ({ operation: 'put', key, value: values[i + j] }))); },
    // A caller that needs an owned snapshot encodes, decodes the copy and puts it: DBSONL encodes it again.
    'round trip + batch': async (db, values) => { for (let i = 0; i < records; i += batchSize) await db.batch(keys.slice(i, i + batchSize).map((key, j) => ({ operation: 'put', key, value: decodeFrame(encodeFrame(values[i + j])).value }))); },
    // The same caller keeps its frame and commits it; DBSONL checks and copies it instead of encoding.
    'batchFrames': async (db, values) => { for (let i = 0; i < records; i += batchSize) await db.batchFrames(keys.slice(i, i + batchSize).map((key, j) => ({ operation: 'put', key, frame: encodeFrame(values[i + j]) }))); },
    // The same caller takes its snapshot with db.frame(), which the commit takes without a copy or a check.
    'frame + batchFrames': async (db, values) => { for (let i = 0; i < records; i += batchSize) await db.batchFrames(keys.slice(i, i + batchSize).map((key, j) => ({ operation: 'put', key, frame: db.frame(values[i + j]) }))); },
  };
  const root = await mkdtemp(resolve('tmp/bench-frames-'));
  const load0 = loadavg()[0]!, result: Record<string, Record<string, { medianMs: number; samplesMs: number[]; committedBytes: number }>> = {};
  let run = 0;
  try {
    for (const storage of ['memory', 'native'] as const) {
      for (const [shape, record] of Object.entries(shapes)) {
        const values = Array.from({ length: records }, (_, i) => record(i)), cases = Object.entries(paths);
        const samples = cases.map(() => [] as number[]), bytes = cases.map(() => new Set<number>());
        // Two untimed warmup rounds; each run commits into a new database, so every path writes the same generation.
        for (let round = -2; round < rounds; round++) {
          const order = cases.map((_, i) => i); if (round % 2) order.reverse();
          for (const i of order) {
            const name = `r${run++}`, directory = storage === 'native' ? resolve(root, name) : undefined;
            const db = await build.openDbsonl(directory ? await build.createFileBackend(directory) : build.createMemoryBackend(), 'frames', { create: true });
            collect();
            const start = performance.now(); await cases[i]![1](db, values); const elapsed = performance.now() - start;
            const stats = await db.stats(); await db.close();
            if (directory) await rm(directory, { recursive: true, force: true });
            if (stats.count !== records) throw new Error(`${cases[i]![0]} committed ${stats.count} records.`);
            bytes[i]!.add(stats.committedBytes);
            if (round >= 0) samples[i]!.push(elapsed);
          }
        }
        // The paths must have written byte-identical amounts, or they did not commit the same frames.
        const written = new Set(bytes.flatMap(set => [...set]));
        if (written.size !== 1) throw new Error(`Paths wrote different generation sizes: ${[...written].join(' ')}`);
        result[`${storage} ${shape}`] = Object.fromEntries(cases.map(([label], i) => [label, { medianMs: [...samples[i]!].sort((a, b) => a - b)[rounds >> 1]!, samplesMs: samples[i]!, committedBytes: [...written][0]! }]));
      }
    }
  } finally { await rm(root, { recursive: true, force: true }); }
  const runtime = bun ? `bun ${process.versions.bun}` : `node ${process.versions.node}`;
  await writeFile(output, JSON.stringify({ runtime, records, batchSize, rounds, loadavg: [load0, loadavg()[0]], result }, null, 2) + '\n');
  for (const [label, cases] of Object.entries(result)) {
    console.log(`${new Date().toISOString()} INFO frame benchmark runtime=${runtime.replace(' ', '-')} case="${label}" ${Object.entries(cases).map(([path, { medianMs }]) => `${path.replaceAll(' ', '_').replace('+', 'plus')}_ms=${medianMs.toFixed(1)}`).join(' ')}`);
  }
}

if (process.argv[2] === '--worker') {
  await worker(process.argv[3]!);
} else {
  if (process.argv.length > 2) throw new Error('Usage: bun scripts/bench-frames.ts');
  const run = (command: string, args: string[]) => {
    const result = spawnSync(command, args, { encoding: 'utf8', timeout: 900000 });
    if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr}\n${result.stdout}`);
    process.stdout.write(result.stdout);
  };
  await mkdir('output', { recursive: true }); await mkdir('tmp', { recursive: true });
  const reports = [];
  for (const runtime of ['node', process.execPath]) {
    const output = `output/bench-frames-${runtime === 'node' ? 'node' : 'bun'}.json`;
    run(runtime, [...(runtime === 'node' ? ['--expose-gc'] : []), 'scripts/bench-frames.ts', '--worker', output]);
    reports.push(JSON.parse(await readFile(output, 'utf8')));
  }
  await writeFile('output/bench-frames.json', JSON.stringify({ generatedAt: new Date().toISOString(), host: { platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length }, protocol: `${records} records committed in batches of ${batchSize} into a new database per run, on memory and native (asynchronous I/O) storage; two warmup rounds and ${rounds} measured, path order reversed every round, garbage collected before each run; every run must commit every record and every path must write the same generation size.`, reports }, null, 2) + '\n');
}
