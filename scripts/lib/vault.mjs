// Reading the vault. Shared by check-vault.mjs and build-viewer.mjs.
//
// The yaml reader below is deliberately small. It understands exactly the shapes
// this vault uses: scalars, folded and literal blocks, flow lists, block lists,
// and block lists of mappings. It throws on anything else rather than guessing,
// so a parse failure means "write it the way the rest of the vault is written",
// not "the file is fine and the tool is broken".

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const VAULT = join(ROOT, 'vault');

export function scalar(raw) {
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
  return inner === '' ? [] : inner.split(',').map((v) => scalar(v));
}

export function parseYaml(text, where) {
  const lines = text.split('\n');
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
      if (/^([A-Za-z_][\w-]*):\s*(.*)$/.test(rest)) {
        lines[i] = ' '.repeat(ind + 2) + rest;
        arr.push(parseMapping(ind + 2));
      } else {
        arr.push(scalar(rest));
        i++;
      }
    }
    return arr;
  };

  return parseMapping(0);
}

export function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const abs = join(dir, name);
    return statSync(abs).isDirectory() ? walk(abs) : abs.endsWith('.md') ? [abs] : [];
  });
}

// Returns { where, data, body, file } or { where, error }.
export function readEntity(abs) {
  const where = relative(ROOT, abs);
  const text = readFileSync(abs, 'utf8');
  if (!text.startsWith('---\n')) return { where, file: abs, error: 'no frontmatter' };
  const end = text.indexOf('\n---', 4);
  if (end === -1) return { where, file: abs, error: 'frontmatter is not closed' };
  try {
    return { where, file: abs, data: parseYaml(text.slice(4, end), where), body: text.slice(end + 4).trim() };
  } catch (e) {
    return { where, file: abs, error: e.message.replace(`${where}:`, 'line ') };
  }
}

export function readVaultYaml(rel) {
  const abs = join(VAULT, rel);
  if (!existsSync(abs)) return { rel, error: 'missing' };
  try {
    return { rel, data: parseYaml(readFileSync(abs, 'utf8'), rel) };
  } catch (e) {
    return { rel, error: e.message };
  }
}

// Loads everything. `errors` collects files that could not be read at all.
export function loadVault() {
  const errors = [];
  const load = (sub) =>
    walk(join(VAULT, sub))
      .map(readEntity)
      .filter((e) => {
        if (e.error) { errors.push(`${e.where}: ${e.error}`); return false; }
        return true;
      });

  const sets = {
    nodes: load('map'),
    questions: load('questions'),
    beliefs: load('beliefs'),
    claims: load('claims'),
    resources: load('resources'),
    passes: load('passes'),
  };
  const all = Object.values(sets).flat();
  const byId = new Map();
  for (const e of all) if (e.data.id && !byId.has(e.data.id)) byId.set(e.data.id, e);

  return {
    ...sets,
    all,
    byId,
    errors,
    focus: readVaultYaml('focus.yaml'),
    edges: readVaultYaml('edges.yaml'),
    trunks: readVaultYaml('map/trunks.yaml'),
    inbox: sets.resources.filter((r) => relative(VAULT, r.file).startsWith('resources/inbox/')),
    idOf: (e) => basename(e.file, '.md'),
  };
}
