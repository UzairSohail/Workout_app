// Builds public/exercises.json from free-exercise-db (public domain, Unlicense).
// Usage: npm run data            (downloads the pinned commit)
//        npm run data -- <path>  (uses a local copy of dist/exercises.json)
import { readFile, writeFile } from 'node:fs/promises';

export const FEDB_COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5';
const url = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${FEDB_COMMIT}/dist/exercises.json`;

const local = process.argv[2];
const raw = local ? JSON.parse(await readFile(local, 'utf8')) : await (await fetch(url)).json();

const slim = raw.map((x) => ({
  id: x.id,
  name: x.name,
  category: x.category,
  equipment: x.equipment ?? 'body only',
  level: x.level,
  force: x.force ?? undefined,
  mechanic: x.mechanic ?? undefined,
  primaryMuscles: x.primaryMuscles,
  secondaryMuscles: x.secondaryMuscles,
  instructions: x.instructions,
  images: x.images,
}));
slim.sort((a, b) => a.name.localeCompare(b.name));
await writeFile(new URL('../public/exercises.json', import.meta.url), JSON.stringify(slim));
console.log(`Wrote ${slim.length} exercises`);
