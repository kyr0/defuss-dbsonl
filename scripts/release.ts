/** VERIFIED: packs the tarball and a source ZIP into output/ after the VAE gate passes, without remote mutation. */
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const { version } = JSON.parse(await readFile('package.json', 'utf8')) as { version: string };
// The gate checks current fingerprints and exits non-zero unless they pass, so a stale review cannot authorize packaging.
execFileSync('python3', ['tmp/vae-tooling/plugin/scripts/vae.py', 'gate', '--repo', '.', '--session', 'dbsonl-release'], { stdio: 'inherit' });
await mkdir('output', { recursive: true });
execFileSync(process.execPath, ['pm', 'pack', '--destination', 'output'], { stdio: 'inherit' });
// Git's own list, tracked files and untracked ones it does not ignore, so .env, build output, caches and ignored
// scratch copies stay out. A tracked file deleted but not yet staged is skipped.
const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0').filter(path => path && existsSync(path)).sort();
const archive = resolve('output', `defuss-dbsonl-v${version}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.zip`);
// Python's stdlib ZIP writer avoids adding a packaging dependency to the runtime.
execFileSync('python3', ['-c', 'import json,sys,zipfile; data=json.load(sys.stdin); z=zipfile.ZipFile(data["archive"],"w",zipfile.ZIP_DEFLATED); [z.write(p,"defuss-dbsonl/"+p) for p in data["files"]]; z.close()'], { input: JSON.stringify({ archive, files }), stdio: ['pipe', 'inherit', 'inherit'] });
console.log(`${resolve('output', `defuss-dbsonl-${version}.tgz`)}\n${archive}`);
