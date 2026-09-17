#!/usr/bin/env node
// Bakes the vault into a single self-contained HTML file.
//
//   node scripts/build-viewer.mjs        writes viewer.html
//   open viewer.html                     no server, no install, no framework
//
// viewer.html is derived and gitignored. The markdown is canonical. Rebuild it
// whenever the vault changes; nothing in it is state.

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadVault, ROOT, VAULT } from './lib/vault.mjs';

if (!existsSync(VAULT)) {
  console.error('no vault/. Run: node scripts/seed-vault.mjs');
  process.exit(1);
}

const v = loadVault();
for (const e of v.errors) console.error(`  skipped  ${e}`);

const pick = (e, keys) => Object.fromEntries(keys.map((k) => [k, e.data[k] ?? null]));

const data = {
  built: new Date().toISOString().slice(0, 10),
  trunks: v.trunks.data?.trunks || [],
  nodes: v.nodes.map((e) => pick(e, ['id', 'name', 'trunk', 'parent', 'question', 'status', 'terms', 'last_touched'])),
  questions: v.questions.map((e) => pick(e, ['id', 'text', 'trunk', 'status', 'cadence', 'current_answer', 'confidence', 'next_move', 'last_moved', 'nodes'])),
  beliefs: v.beliefs.map((e) => pick(e, ['id', 'proposition', 'credence', 'history', 'falsifier', 'load_bearing_for', 'nodes', 'last_examined'])),
  claims: v.claims.map((e) => pick(e, ['id', 'holder', 'proposition', 'mechanism', 'assumptions', 'falsifier', 'my_credence', 'nodes', 'source'])),
  resources: v.resources.map((e) => ({
    ...pick(e, ['id', 'title', 'url', 'medium', 'minutes', 'state', 'queued_against', 'pass']),
    in_inbox: relative(VAULT, e.file).startsWith('resources/inbox/'),
  })),
  passes: v.passes.map((e) => pick(e, ['id', 'resource', 'date', 'minutes_spent', 'before', 'encountered', 'changed', 'follows', 'nothing_changed', 'worth_it'])),
  edges: v.edges.data?.edges || [],
  focus: v.focus.data?.focus || [],
};

// normalise the shapes the viewer indexes on
for (const n of data.nodes) n.terms = n.terms || [];
for (const b of data.beliefs) { b.history = b.history || []; b.load_bearing_for = b.load_bearing_for || []; b.nodes = b.nodes || []; }
for (const q of data.questions) q.nodes = q.nodes || [];
for (const r of data.resources) r.queued_against = r.queued_against || [];
data.nodes.forEach((n) => { n.type = 'node'; });
data.questions.forEach((q) => { q.type = 'question'; });
data.beliefs.forEach((b) => { b.type = 'belief'; });
data.resources.forEach((r) => { r.type = 'resource'; });
data.passes.forEach((p) => { p.type = 'pass'; });
data.claims.forEach((c) => { c.type = 'claim'; });

// U+2028 and U+2029 are legal in JSON but illegal raw inside a JS literal.
const LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
const json = JSON.stringify(data)
  .replace(/</g, '\\u003c')
  .split(LS).join('\\u2028')
  .split(PS).join('\\u2029');
const template = readFileSync(join(ROOT, 'viewer', 'template.html'), 'utf8');
if (!template.includes('/*__DATA__*/')) {
  console.error('viewer/template.html has no /*__DATA__*/ placeholder');
  process.exit(1);
}
const out = join(ROOT, 'viewer.html');
writeFileSync(out, template.replace('/*__DATA__*/ null', json), 'utf8');

const kb = (readFileSync(out).length / 1024).toFixed(0);
console.log(`viewer.html written, ${kb} KB. ${data.nodes.length} nodes, ${data.beliefs.length} beliefs, ${data.passes.length} passes.`);
console.log('open it with: open viewer.html   (macOS)   or   xdg-open viewer.html   (linux)');
