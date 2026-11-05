// Copie public/ vers dist-pages/ en préfixant les chemins absolus par BASE_PATH
// (ex. /beyboo pour https://akhimysah.github.io/beyboo/). Les routes /api/ ne sont
// pas réécrites : elles n'existent pas sur un hébergement statique.
import { cpSync, readdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const base = (process.env.BASE_PATH || '/beyboo').replace(/\/$/, '');
const src = new URL('../public/', import.meta.url).pathname;
const out = new URL('../dist-pages/', import.meta.url).pathname;

rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true });

const roots = 'index\\.html|index-en\\.html|manifest[\\w-]*\\.webmanifest|assets/|vendor/|en/|voice-profiles[\\w-]*\\.json|voice-tools\\.json|presidents\\.json|app-worker\\.js|face-detector-worker\\.js';
const pattern = new RegExp(`(['"(])/(${roots})`, 'g');
const textExt = new Set(['.html', '.js', '.css', '.json', '.webmanifest']);
let rewritten = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    if (statSync(file).isDirectory()) { if (name !== 'assets') walk(file); continue; }
    if (!textExt.has(extname(name))) continue;
    const before = readFileSync(file, 'utf8');
    let count = 0;
    let after = before.replace(pattern, (m, quote, rest) => { count++; return `${quote}${base}/${rest}`; });
    if (name.endsWith('.webmanifest')) after = after.replace('"scope": "/"', () => { count++; return `"scope": "${base}/"`; });
    if (count) { writeFileSync(file, after); rewritten += count; console.log(`${file.slice(out.length)}: ${count}`); }
  }
}
walk(out);
if (base) writeFileSync(join(out, '.nojekyll'), '');
console.log(`Base ${base || '/'} — ${rewritten} chemins réécrits dans dist-pages/`);
