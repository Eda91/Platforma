import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = process.argv[2];
if (!sourceDir) throw new Error('Usage: node prepare-data.mjs /absolute/path/to/private/geojson');
const sources = JSON.parse(await readFile(resolve(here, 'sources.json'), 'utf8'));
const target = resolve(here, 'private-data');
await mkdir(target, { recursive: true });
for (const file of [...sources.map(item => item.file), 'Palase_Statuset_Verifikuara.json']) {
  const source = resolve(sourceDir, file);
  JSON.parse(await readFile(source, 'utf8'));
  await copyFile(source, resolve(target, file));
}
console.log('Private data prepared. Use a PRIVATE backend repository only.');
