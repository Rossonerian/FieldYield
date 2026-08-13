import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';

async function files(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? files(join(root, entry.name)) : [join(root, entry.name)]));
  return nested.flat();
}

const assets = await files('dist');
for (const file of assets.sort()) {
  const bytes = await readFile(file);
  process.stdout.write(`${relative('dist', file)}\t${(await stat(file)).size}\t${gzipSync(bytes).length} gzip\n`);
}
