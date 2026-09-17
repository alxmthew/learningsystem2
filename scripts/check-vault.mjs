#!/usr/bin/env node
// Checks the spec constraints that have no UI yet. Phase 0 has no app, so this
// script is the only thing holding them. Run it before every commit that
// touches vault/.
//
//   node scripts/check-vault.mjs
//
// Exits non-zero on any error. Dangling edges are warnings, not errors: an edge
// can legitimately point at something you have not written down yet.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VAULT = join(ROOT, 'vault');

const INBOX_CAP = 40;
const FOCUS_MIN = 3;
const FOCUS_MAX = 5;
const NODE_STATUS = ['unexplored', 'circling', 'working', 'can-teach'];
const QUESTION_STATUS = ['active', 'dormant', 'parked'];
const CADENCE = ['daily', 'weekly', 'seasonal'];
const RESOURCE_STATE = ['inbox', 'queued', 'passed', 'dropped'];
const MEDIUM = ['essay', 'paper', 'podcast', 'video', 'book', 'conversation', 'course'];
const EDGE_TYPES = ['supports', 'contradicts', 'depends_on', 'instance_of', 'tension_with', 'bridges', 'answers', 'prompted_by'];
const TRUNKS = ['reality', 'mind', 'life', 'civilization', 'creation'];

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

/* ---------- a deliberately small yaml reader ----------------------------
   It understands exactly the shapes this vault uses: scalars, folded and
   literal blocks, flow lists, block lists, and block lists of mappings. It
   throws on anything else rather than guessing, so a parse failure here means
   "write it the way the rest of the vault is written", not "the file is fine".
------------------------------------------------------------------------- */

function scalar(raw) {
  const s = raw.trim();
  if (s === '' || s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return Number(s);
  if (s.startsWith("'") && s.endsWith("'") && s.length >= 2) return s.slice(1, -1).replace(/''/g, "'");
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) return s.slice(1, -1).replace(/\\"/g, '"');
  return s;
}

function flowList(raw) {
  const inner = raw.trim().slice(1, -1).trim();
  if (inner === '') return [];
  return inner.split(',').map((v) => scalar(v));
}

function parseYaml(text, where) {
  const lines = text.split('\n');
  const out = {};
  let i = 0;
  const indentOf = (l) => l.length - l.trimStart().length;
  const blank = (l) => l.trim() === '' || l.trim().startsWith('#');

  const gatherBlock = (baseIndent, fold) => {
    const buf = [];
    i++;
    while (i < lines.length) {
      const l = lines[i];
      if (l.trim() !== '' && indentOf(l) <= baseIndent) break;
      buf.push(l.slice(baseIndent + 2));
      i++;
    }
    while (buf.length && buf[buf.length - 1].trim() === '') buf.pop();
    return fold ? buf.join(' ').replace(/\s+/g, ' ').trim() : buf.join('\n');
  };

  const parseMapping = (baseIndent) => {
    const obj = {};
    while (i < lines.length) {
      const line = lines[i];
      if (blank(line)) { i++; continue; }
      const ind = indentOf(line);
      if (ind < baseIndent) break;
      if (ind > baseIndent) throw new Error(`${where}:${i + 1}: unexpected indentation`);
      const m = line.trim().match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (!m) throw new Error(`${where}:${i + 1}: cannot read "${line.trim()}"`);
      const [, key, rest] = m;
      if (rest === '>-' || rest === '>' || rest === '|' || rest === '|-') {
        obj[key] = gatherBlock(ind, rest.startsWith('>'));
      } else if (rest.startsWith('[')) {
        obj[key] = flowList(rest);
        i++;
      } else if (rest === '') {
        i++;
        // either a block list or a nested mapping
        while (i < lines.length && blank(lines[i])) i++;
        if (i < lines.length && indentOf(lines[i]) > ind && lines[i].trim().startsWith('- ')) {
          obj[key] = parseList(indentOf(lines[i]));
        } else if (i < lines.length && indentOf(lines[i]) > ind) {
          obj[key] = parseMapping(indentOf(lines[i]));
        } else {
          obj[key] = null;
        }
      } else {
        obj[key] = scalar(rest);
        i++;
      }
    }
    return obj;
  };

  const parseList = (baseIndent) => {
    const arr = [];
    while (i < lines.length) {
      const line = lines[i];
      if (blank(line)) { i++; continue; }
      const ind = indentOf(line);
      if (ind < baseIndent) break;
      if (!line.trim().startsWith('- ')) break;
      const rest = line.trim().slice(2);
      const kv = rest.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (kv) {
        // a mapping item: rewrite the line so the mapping parser sees a clean start
        lines[i] = ' '.repeat(ind + 2) + rest;
        arr.push(parseMapping(ind + 2));
      } else {
        arr.push(scalar(rest));
        i++;
      }
    }
    return arr;
  };

  const res = parseMapping(0);
  Object.assign(out, res);
  return out;
}

function readEntity(abs) {
  const where = relative(ROOT, abs);
  const text = readFileSync(abs, 'utf8');
  if (!text.startsWith('---\n')) { err(where, 'no frontmatter'); return null; }
  const end = text.indexOf('\n---', 4);
  if (end === -1) { err(where, 'frontmatter is not closed'); return null; }
  try {
    const data = parseYaml(text.slice(4, end), where);
    return { where, data, body: text.slice(end + 4).trim(), file: abs };
  } catch (e) {
    err(where, e.message.replace(`${where}:`, 'line '));
    return null;
  }
}

function readYamlFile(rel) {
  const abs = join(VAULT, rel);
  if (!existsSync(abs)) { err(rel, 'missing'); return null; }
  try {
    return parseYaml(readFileSync(abs, 'utf8'), rel);
  } catch (e) {
    err(rel, e.message);
    return null;
  }
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const abs = join(dir, name);
    return statSync(abs).isDirectory() ? walk(abs) : abs.endsWith('.md') ? [abs] : [];
  });
}

/* ---------- load --------------------------------------------------------- */

if (!existsSync(VAULT)) {
  console.error('no vault/. Run: node scripts/seed-vault.mjs');
  process.exit(1);
}

const load = (sub) => walk(join(VAULT, sub)).map(readEntity).filter(Boolean);
const nodes = load('map');
const questions = load('questions');
const beliefs = load('beliefs');
const claims = load('claims');
const resources = load('resources');
const passes = load('passes');
const all = [...nodes, ...questions, ...beliefs, ...claims, ...resources, ...passes];

const byId = new Map();
for (const e of all) {
  const id = e.data.id;
  if (!id) { err(e.where, 'no id'); continue; }
  if (id !== basename(e.file, '.md')) err(e.where, `id "${id}" does not match the filename`);
  if (byId.has(id)) err(e.where, `id "${id}" is already used by ${byId.get(id).where}`);
  else byId.set(id, e);
}

const isA = (id, type) => byId.get(id)?.data.type === type;
const exists = (id) => byId.has(id);

/* ---------- nodes: depth cap 3 ------------------------------------------ */

for (const n of nodes) {
  const { data, where } = n;
  const segs = relative(join(VAULT, 'map'), n.file).split('/');
  if (segs.length > 3) err(where, `depth cap: ${segs.length} levels below map/. Flatten into terms[] or split the parent node.`);
  const [trunkDir] = segs;
  if (!TRUNKS.includes(trunkDir)) err(where, `"${trunkDir}" is not one of the five trunks`);
  if (data.trunk !== trunkDir) err(where, `trunk "${data.trunk}" does not match its folder "${trunkDir}"`);
  if (!NODE_STATUS.includes(data.status)) err(where, `status "${data.status}" is not one of ${NODE_STATUS.join(', ')}`);
  if (data.parent) {
    if (!isA(data.parent, 'node')) err(where, `parent "${data.parent}" is not a node`);
    else if (byId.get(data.parent).data.parent) err(where, `depth cap: parent "${data.parent}" already has a parent`);
    if (segs.length === 3 && segs[1] !== data.parent) err(where, `parent "${data.parent}" does not match its folder "${segs[1]}"`);
  } else if (segs.length !== 2) {
    err(where, 'a node with no parent belongs directly under its trunk folder');
  }
}

/* ---------- questions ---------------------------------------------------- */

for (const { data, where } of questions) {
  if (!data.current_answer || String(data.current_answer).trim() === '')
    err(where, 'no current_answer. A question without a provisional answer is a mood, not an inquiry.');
  if (!QUESTION_STATUS.includes(data.status)) err(where, `status "${data.status}" is not one of ${QUESTION_STATUS.join(', ')}`);
  if (!CADENCE.includes(data.cadence)) err(where, `cadence "${data.cadence}" is not one of ${CADENCE.join(', ')}`);
  if (!Number.isInteger(data.confidence) || data.confidence < 0 || data.confidence > 100)
    err(where, `confidence "${data.confidence}" is not an integer 0 to 100`);
  if (!TRUNKS.includes(data.trunk)) err(where, `"${data.trunk}" is not one of the five trunks`);
  for (const id of data.nodes || []) if (!isA(id, 'node')) warn(where, `nodes: "${id}" is not a node in the map`);
}

/* ---------- beliefs: no credence change without a reason ----------------- */

for (const { data, where } of beliefs) {
  const h = data.history;
  if (!Array.isArray(h) || h.length === 0) { err(where, 'no history'); continue; }
  h.forEach((entry, idx) => {
    if (!entry.why || String(entry.why).trim() === '')
      err(where, `history[${idx}] has no why. A credence change without a stated reason is rejected.`);
    if (!Number.isInteger(entry.credence) || entry.credence < 0 || entry.credence > 100)
      err(where, `history[${idx}] credence "${entry.credence}" is not an integer 0 to 100`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entry.date)))
      err(where, `history[${idx}] date "${entry.date}" is not YYYY-MM-DD`);
  });
  const last = h[h.length - 1];
  if (data.credence !== last?.credence)
    err(where, `credence ${data.credence} does not match the last history entry (${last?.credence}). Every move writes a history entry.`);
  if (!data.falsifier || String(data.falsifier).trim() === '')
    err(where, 'no falsifier. A belief you cannot imagine being wrong about is a preference.');
  for (const id of data.load_bearing_for || []) if (!isA(id, 'question')) warn(where, `load_bearing_for: "${id}" is not a question`);
  for (const id of data.nodes || []) if (!isA(id, 'node')) warn(where, `nodes: "${id}" is not a node in the map`);
}

/* ---------- resources: the inbox cap and the drain ----------------------- */

const inbox = resources.filter((r) => relative(VAULT, r.file).startsWith('resources/inbox/'));
if (inbox.length > INBOX_CAP)
  err('resources/inbox', `${inbox.length} items, cap is ${INBOX_CAP}. Queue or drop before adding more. The cap is the feature.`);

for (const { data, where, file } of resources) {
  if (!RESOURCE_STATE.includes(data.state)) err(where, `state "${data.state}" is not one of ${RESOURCE_STATE.join(', ')}`);
  if (data.medium && !MEDIUM.includes(data.medium)) warn(where, `medium "${data.medium}" is not one of ${MEDIUM.join(', ')}`);
  const inInbox = relative(VAULT, file).startsWith('resources/inbox/');
  const queued = data.queued_against || [];
  if (data.state === 'inbox' && !inInbox) err(where, 'state is inbox but the file is not in resources/inbox/');
  if (data.state !== 'inbox' && inInbox) err(where, `state is "${data.state}" but the file is still in resources/inbox/`);
  if (!inInbox && queued.length === 0 && data.state !== 'dropped')
    err(where, 'no queued_against. A resource leaves the inbox only against a question or a node.');
  for (const id of queued) {
    if (!exists(id)) warn(where, `queued_against: "${id}" does not exist`);
    else if (!isA(id, 'node') && !isA(id, 'question')) err(where, `queued_against: "${id}" is a ${byId.get(id).data.type}, not a question or node`);
  }
  if (data.state === 'passed') {
    if (!data.pass) err(where, 'state is passed but there is no pass file');
    else if (!existsSync(join(VAULT, data.pass))) err(where, `pass file "${data.pass}" does not exist`);
  }
}

/* ---------- passes ------------------------------------------------------- */

for (const { data, where } of passes) {
  if (!exists(data.resource)) warn(where, `resource "${data.resource}" does not exist`);
  if (data.nothing_changed === true && (!data.worth_it || String(data.worth_it).trim() === ''))
    err(where, 'nothing_changed is true with no worth_it. That outcome is legitimate, but it costs one sentence on why the time was spent.');
  if (data.nothing_changed !== true && (!data.changed || String(data.changed).trim() === ''))
    err(where, 'no changed. A pass exists because something moved.');
}

// three nothing_changed in a row against the same node is a flag, not an error
const byNode = new Map();
for (const p of [...passes].sort((a, b) => String(a.data.date).localeCompare(String(b.data.date)))) {
  const res = byId.get(p.data.resource);
  for (const target of res?.data.queued_against || []) {
    const run = byNode.get(target) || [];
    run.push(p);
    byNode.set(target, run);
  }
}
for (const [target, list] of byNode) {
  const tail = list.slice(-3);
  if (tail.length === 3 && tail.every((p) => p.data.nothing_changed === true))
    warn(`passes`, `three passes in a row against "${target}" changed nothing. Worth asking whether the question is the wrong one.`);
}

/* ---------- focus: the rotation cap -------------------------------------- */

const focusDoc = readYamlFile('focus.yaml');
if (focusDoc) {
  const focus = focusDoc.focus || [];
  if (focus.length < FOCUS_MIN || focus.length > FOCUS_MAX)
    err('focus.yaml', `${focus.length} focus questions, the cap is ${FOCUS_MIN} to ${FOCUS_MAX}. To add one, retire one and write where you got to.`);
  if (new Set(focus).size !== focus.length) err('focus.yaml', 'a question is listed twice');
  for (const id of focus) {
    if (!isA(id, 'question')) err('focus.yaml', `"${id}" is not a question`);
    else if (byId.get(id).data.status !== 'active') err('focus.yaml', `"${id}" is in rotation but its status is "${byId.get(id).data.status}"`);
  }
}

/* ---------- edges -------------------------------------------------------- */

const edgeDoc = readYamlFile('edges.yaml');
if (edgeDoc) {
  for (const [idx, e] of (edgeDoc.edges || []).entries()) {
    const at = `edges.yaml[${idx}] ${e.from} ${e.type} ${e.to}`;
    if (!EDGE_TYPES.includes(e.type)) err(at, `"${e.type}" is not one of ${EDGE_TYPES.join(', ')}`);
    for (const side of ['from', 'to']) {
      if (!exists(e[side])) warn(at, `${side} "${e[side]}" is not an entity in the vault. Either write the node or drop the edge.`);
    }
  }
}

/* ---------- report ------------------------------------------------------- */

const counts = { nodes: nodes.length, questions: questions.length, beliefs: beliefs.length, claims: claims.length, resources: resources.length, passes: passes.length };
console.log(Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ') + `, ${inbox.length}/${INBOX_CAP} in inbox`);

for (const w of warnings) console.log(`  warn  ${w}`);
for (const e of errors) console.error(`  ERROR ${e}`);

if (errors.length) {
  console.error(`\n${errors.length} error${errors.length === 1 ? '' : 's'}.`);
  process.exit(1);
}
console.log(warnings.length ? `\nclean, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.` : '\nclean.');
