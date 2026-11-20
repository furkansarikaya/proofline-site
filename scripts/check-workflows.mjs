// Workflow permissions check (ADR 0008): every workflow needs a top-level `permissions` block and it must not be `write-all`.
//   node scripts/check-workflows.mjs [file|dir ...]     default: .github/workflows
// Exit status: 0 pass, 1 a workflow fails or none was found.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';

/** The workflow files named by the arguments: a file stands for itself, a directory for its *.yml and *.yaml files. */
function collect(targets) {
  const files = [];
  for (const target of targets) {
    if (!existsSync(target)) continue;
    if (statSync(target).isDirectory()) {
      for (const name of readdirSync(target).sort()) if (/\.ya?ml$/.test(name)) files.push(join(target, name));
    } else {
      files.push(target);
    }
  }
  return files;
}

/** Violations of one workflow file, as strings; empty when it passes. */
function violations(file) {
  let doc;
  try {
    doc = YAML.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return [`cannot be parsed: ${error.message.split('\n')[0]}`];
  }
  if (doc === null || typeof doc !== 'object' || doc.permissions === undefined || doc.permissions === null) return ['missing top-level permissions'];
  if (doc.permissions === 'write-all') return ['permissions: write-all'];
  return [];
}

const targets = process.argv.length > 2 ? process.argv.slice(2) : ['.github/workflows'];
const files = collect(targets);
let failing = 0;
for (const file of files) {
  const found = violations(file);
  if (found.length === 0) console.log(`ok ${file}`);
  else { failing++; for (const v of found) console.log(`${file}: ${v}`); }
}
console.log(`workflows: ${files.length} checked, ${failing} failing`);
process.exit(failing > 0 || files.length === 0 ? 1 : 0);
