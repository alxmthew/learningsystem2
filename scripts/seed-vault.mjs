#!/usr/bin/env node
// Builds vault/ from seed/seed-map.json.
// Node builtins only. There is no package.json in Phase 0 and there should not be one.
//
//   node scripts/seed-vault.mjs            refuses to overwrite an existing vault
//   node scripts/seed-vault.mjs --force    rebuilds from seed, destroying hand edits

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VAULT = join(ROOT, 'vault');
const TODAY = process.env.DELTA_SEED_DATE || new Date().toISOString().slice(0, 10);
const FORCE = process.argv.includes('--force');

/* ---------- yaml emitters ---------------------------------------------- */

const RESERVED = /^(true|false|null|yes|no|on|off|~)$/i;
const NUMBERISH = /^[-+]?(\d[\d_]*(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;

function plainSafe(s, flow = false) {
  if (s === '' || s.includes('\n')) return false;
  if (/^\s|\s$/.test(s)) return false;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(s)) return false;
  if (/:\s|\s#/.test(s)) return false;
  if (/[:#]$/.test(s)) return false;
  if (RESERVED.test(s) || NUMBERISH.test(s)) return false;
  if (flow && /[,[\]{}]/.test(s)) return false;
  return true;
}

const quoted = (s) => `'${s.replace(/'/g, "''")}'`;

function inline(s, flow = false) {
  return plainSafe(s, flow) ? s : quoted(s);
}

function wrap(s, width) {
  const out = [];
  let line = '';
  for (const word of s.split(/\s+/)) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= width) line += ' ' + word;
    else { out.push(line); line = word; }
  }
  if (line) out.push(line);
  return out;
}

// A scalar field. Long prose folds into a block scalar so the file stays readable.
function field(key, value, indent = 0) {
  const pad = ' '.repeat(indent);
  if (value === null || value === undefined) return `${pad}${key}: null`;
  if (typeof value === 'number' || typeof value === 'boolean') return `${pad}${key}: ${value}`;
  const s = String(value);
  if (s.length > 76 || s.includes('\n')) {
    const body = wrap(s.replace(/\s+/g, ' ').trim(), 76)
      .map((l) => `${pad}  ${l}`)
      .join('\n');
    return `${pad}${key}: >-\n${body}`;
  }
  return `${pad}${key}: ${inline(s)}`;
}

// A list of short strings. Flow style while it fits on one line, block style after that.
function listField(key, values, indent = 0) {
  const pad = ' '.repeat(indent);
  if (!values || values.length === 0) return `${pad}${key}: []`;
  const flow = `${pad}${key}: [${values.map((v) => inline(String(v), true)).join(', ')}]`;
  if (flow.length <= 100) return flow;
  return `${pad}${key}:\n` + values.map((v) => `${pad}  - ${inline(String(v))}`).join('\n');
}

function frontmatter(lines) {
  return ['---', ...lines.filter(Boolean), '---'].join('\n');
}

function doc(lines, body) {
  return frontmatter(lines) + '\n\n' + body.trimEnd() + '\n';
}

function write(relPath, contents) {
  const abs = join(VAULT, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, contents, 'utf8');
  return relPath;
}

/* ---------- entity writers --------------------------------------------- */

function nodeBody(n) {
  const parts = [`# ${n.name}`];
  if (n.question) parts.push(`> ${n.question}`);
  if (n.note) parts.push(n.note);
  return parts.join('\n\n');
}

function writeNode(n, { trunk, parent }) {
  const rel = parent
    ? `map/${trunk}/${parent}/${n.id}.md`
    : `map/${trunk}/${n.id}.md`;
  const fm = [
    field('id', n.id),
    'type: node',
    field('trunk', trunk),
    field('parent', parent ?? null),
    field('name', n.name),
    field('question', n.question ?? null),
    field('status', n.status || 'unexplored'),
    listField('terms', n.terms || []),
    field('last_touched', null),
  ];
  return write(rel, doc(fm, nodeBody(n)));
}

function writeQuestion(q) {
  const fm = [
    field('id', q.id),
    'type: question',
    field('trunk', q.trunk),
    field('text', q.text),
    field('status', q.status || 'active'),
    field('cadence', q.cadence || 'weekly'),
    field('current_answer', q.current_answer || "I don't have one yet."),
    field('confidence', q.confidence ?? 0),
    field('next_move', q.next_move ?? null),
    field('last_moved', TODAY),
    listField('nodes', q.nodes || []),
  ];
  // No invented next_move. An empty one is the honest state on day one.
  const body = [`# ${q.text}`, '## Where I got to', '_Nothing written yet._'].join('\n\n');
  return write(`questions/${q.id}.md`, doc(fm, body));
}

function writeBelief(b) {
  const history = (b.history || []).map((h) => {
    const date = h.date === 'seed' ? TODAY : h.date;
    return [
      `  - date: ${date}`,
      `    credence: ${h.credence}`,
      field('why', h.why, 4),
    ].join('\n');
  });
  const fm = [
    field('id', b.id),
    'type: belief',
    field('proposition', b.proposition),
    field('credence', b.credence),
    'history:',
    history.join('\n'),
    field('falsifier', b.falsifier),
    listField('load_bearing_for', b.load_bearing_for || []),
    listField('nodes', b.nodes || []),
    field('last_examined', null),
  ];
  const body = [`# ${b.proposition}`, '## Why I hold it', '_Not written yet. `/examine` this belief to start._'].join('\n\n');
  return write(`beliefs/${b.id}.md`, doc(fm, body));
}

function writeEdges(edges) {
  const lines = [
    '# Typed relations between nodes. The tree cannot express what matters most.',
    '# Types: supports | contradicts | depends_on | instance_of | tension_with | bridges | answers | prompted_by',
    '# `bridges` across trunks is the interesting one, and the only edge the map draws as a curve.',
    '',
    'edges:',
  ];
  for (const e of edges) {
    lines.push(`  - from: ${inline(e.from)}`);
    lines.push(`    type: ${inline(e.type)}`);
    lines.push(`    to: ${inline(e.to)}`);
    if (e.note) lines.push(field('note', e.note, 4));
  }
  return write('edges.yaml', lines.join('\n') + '\n');
}

function writeFocus(focus) {
  const lines = [
    '# The rotation. Hard cap of 3 to 5, enforced at write time.',
    '# To add a sixth you must retire one and write a line of "where I got to",',
    '# which is appended to that question file under ## Where I got to.',
    '',
    'focus:',
    ...focus.map((id) => `  - ${inline(id)}`),
    '',
    '# Questions pulled out of rotation, newest first. Kept so the trail is visible.',
    'retired: []',
  ];
  return write('focus.yaml', lines.join('\n') + '\n');
}

/* ---------- run --------------------------------------------------------- */

const seed = JSON.parse(readFileSync(join(ROOT, 'seed', 'seed-map.json'), 'utf8'));

if (existsSync(VAULT) && !FORCE) {
  console.error('vault/ already exists. Pass --force to rebuild it from seed, which destroys hand edits.');
  process.exit(1);
}
if (existsSync(VAULT)) rmSync(VAULT, { recursive: true, force: true });

let nodeCount = 0;
for (const trunk of seed.trunks) {
  for (const node of trunk.nodes) {
    writeNode(node, { trunk: trunk.id, parent: null });
    nodeCount++;
    for (const child of node.children || []) {
      writeNode(child, { trunk: trunk.id, parent: node.id });
      nodeCount++;
      if (child.children?.length) {
        // Depth cap 3 is load-bearing. Anything deeper is a sign the node should split.
        console.error(`depth cap: ${child.id} has children. Flatten them into terms[] or split the parent node.`);
        process.exit(1);
      }
    }
  }
}

for (const q of seed.questions) writeQuestion(q);
for (const b of seed.beliefs) writeBelief(b);
writeEdges(seed.edges);
writeFocus(seed.focus);

// The trunks themselves are fixed in the spec, not user-editable, so they are a
// single reference file rather than five near-empty ones.
write(
  'map/trunks.yaml',
  [
    '# Five fixed top-level domains. Not user-editable in v1.',
    '',
    'trunks:',
    ...seed.trunks.flatMap((t) => [
      `  - id: ${inline(t.id)}`,
      `    name: ${inline(t.name)}`,
      field('question', t.question, 4),
    ]),
  ].join('\n') + '\n'
);

for (const dir of ['resources/inbox', 'passes', 'claims', 'outputs/essays', 'outputs/experiments', 'collisions']) {
  mkdirSync(join(VAULT, dir), { recursive: true });
  writeFileSync(join(VAULT, dir, '.gitkeep'), '');
}

console.log(`vault built: ${nodeCount} nodes, ${seed.questions.length} questions, ${seed.beliefs.length} beliefs, ${seed.edges.length} edges, ${seed.focus.length} in focus`);
