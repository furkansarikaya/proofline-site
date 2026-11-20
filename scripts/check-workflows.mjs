// Workflow permissions and action pin checks (ADR 0008).
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
  let source;
  try {
    source = readFileSync(file, 'utf8');
    doc = YAML.parse(source);
  } catch (error) {
    return [`cannot be parsed: ${error.message.split('\n')[0]}`];
  }
  const found = [];
  if (doc === null || typeof doc !== 'object' || doc.permissions === undefined || doc.permissions === null) found.push('missing top-level permissions');
  if (doc?.permissions === 'write-all') found.push('permissions: write-all');
  const parsed = [];
  for (const job of Object.values(doc?.jobs ?? {})) {
    if (job && typeof job === 'object') {
      if ('uses' in job) parsed.push(job.uses);
      for (const step of job.steps ?? []) if (step && typeof step === 'object' && 'uses' in step) parsed.push(step.uses);
    }
  }
  for (const value of parsed) {
    if (typeof value !== 'string' || !/^[^@\s]+@[0-9a-f]{40}$/.test(value)) found.push(`uses not pinned to a 40-character commit SHA: ${String(value)}`);
  }
  const raw = source.split('\n').map((line, index) => ({ line, index: index + 1 }))
    .filter(({ line }) => /^\s*(?:-\s+)?uses:\s/.test(line));
  for (const { line, index } of raw) {
    if (!/#\s*v\d+\.\d+\.\d+\s*$/.test(line)) found.push(`line ${index}: uses without a version comment (# vX.Y.Z)`);
  }
  if (parsed.length !== raw.length) found.push(`uses entries: ${parsed.length} parsed, ${raw.length} on their own line`);
  return found;
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
