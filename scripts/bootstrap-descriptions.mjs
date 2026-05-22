#!/usr/bin/env node
// One-shot: for each repo listed in the current README, if its GitHub
// repo.description is empty, set it to the description text from the README
// via `gh repo edit`. Run locally once; afterwards GitHub is the source of truth.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(ROOT, 'README.md');
const readme = readFileSync(sourcePath, 'utf8');
console.log(`Parsing entries from: ${sourcePath}`);

// Match: - <emoji> **[name](https://github.com/owner/repo)** - description
const re =
  /^- \S+ \*\*\[[^\]]+\]\(https:\/\/github\.com\/([^/]+\/[^)]+)\)\*\* - (.+)$/gm;
const entries = [];
let m;
while ((m = re.exec(readme)) !== null) {
  entries.push({ slug: m[1], description: m[2].trim() });
}

if (entries.length === 0) {
  console.error('No project entries parsed from README.');
  process.exit(1);
}

const skipped = [];
const updated = [];
const failed = [];

for (const { slug, description } of entries) {
  let current;
  try {
    current = execFileSync(
      'gh',
      ['api', `repos/${slug}`, '--jq', '.description'],
      {
        encoding: 'utf8'
      }
    ).trim();
  } catch (e) {
    failed.push({ slug, reason: `read failed: ${e.message}` });
    continue;
  }
  if (current && current !== 'null') {
    skipped.push({ slug, current });
    continue;
  }
  try {
    execFileSync('gh', ['repo', 'edit', slug, '--description', description], {
      stdio: 'inherit'
    });
    updated.push({ slug, description });
  } catch (e) {
    failed.push({ slug, reason: `edit failed: ${e.message}` });
  }
}

console.log(`\n--- summary ---`);
console.log(`updated: ${updated.length}`);
for (const u of updated) console.log(`  ✓ ${u.slug}  →  ${u.description}`);
console.log(`already had description: ${skipped.length}`);
for (const s of skipped) console.log(`  · ${s.slug}`);
if (failed.length) {
  console.log(`failed: ${failed.length}`);
  for (const f of failed) console.log(`  ✗ ${f.slug}  (${f.reason})`);
  process.exit(1);
}
