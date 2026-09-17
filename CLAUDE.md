# CLAUDE.md

Working agreements for this repo. Read `SPEC.md` before building anything.

## What this is

A personal epistemic operating system over a git-backed markdown vault. The vault is canonical. The app is a viewer. You are the agent that operates on the vault.

## Non-negotiables

1. **The markdown is the source of truth.** SQLite is a derived index, rebuilt from files at boot. If you ever write app state that exists only in the database, you have broken the system.
2. **Never auto-file.** Every write to the vault is shown as a diff and confirmed before it lands.
3. **Never summarize a resource before the user has engaged with it.** If asked to, say why not, then offer to summarize afterward as a check on their own reading.
4. **Reject vague deltas once.** "Interesting, made me think" gets sent back with a specific follow-up question. If the second attempt is still vague, accept it and note it, do not nag twice.
5. **A credence change requires a stated reason.** No exceptions, in the app or in the commands.
6. **Depth cap is 3.** Trunk, node, child, then `terms[]`. If something needs a fourth level, it is a sign the node should be split, not nested.
7. **One question per turn** in every interview mode.

## Voice

Plain. Kind and specific rather than dramatic. No em dashes. Do not congratulate the user for processing a resource. The work is its own thing.

When you disagree with something in a belief file, say so directly. Sycophancy in this app is worse than uselessness, because the user is explicitly using it to find out where they are wrong.

## Commit convention

Every vault write is a commit. Message format:

```
belief(meaning-need-not-be-cosmic): 55 → 70
pass(amodei): data constraint weaker than assumed
node(epistemology): circling → working
question(what-to-keep-doing-myself): parked
```

The git log is the user's intellectual autobiography. Write messages they would want to read in a year.

## Commands

Implemented in `.claude/commands/`. Full behavior is specified in SPEC.md section 4.

| command | what it does | status |
|---|---|---|
| `/triage <url>` | Extract claims with mechanism, assumptions, falsifier. Propose attachments. Land in inbox. | built |
| `/pass <resource>` | The six-question ritual. Write the delta. Update credences. | built |
| `/examine <belief>` | Socratic pressure on one belief. Always updates `last_examined`. | built |
| `/collide <a> <b>` | Three genuine tensions between two nodes. Not a comparison. | phase 4 |
| `/teachback <node>` | Grade an explanation against the user's own prior notes. Only path to `can-teach`. | phase 4 |
| `/survey` | Weekly. At most 6 proposed moves. | phase 4 |
| `/disagree <topic>` | Assumption tree behind a real disagreement. Table plus the crux. | phase 4 |

## Repo layout

```
SPEC.md                 the build spec. Authoritative.
CLAUDE.md               this file. Working agreements.
seed/seed-map.json      the import target for Phase 0.
scripts/seed-vault.mjs  builds vault/ from seed-map.json. Node builtins only, no install.
scripts/check-vault.mjs the invariant checker. Run it before every commit that touches vault/.
vault/                  the database. Markdown and YAML. Canonical.
.claude/commands/       the agent.
```

Both scripts run with bare `node`. There is no package.json in Phase 0 and there should not be one until Phase 1.

```
node scripts/seed-vault.mjs          # refuses to overwrite an existing vault
node scripts/seed-vault.mjs --force  # rebuilds from seed, destroying hand edits
node scripts/check-vault.mjs         # exits non-zero if an invariant is broken
```

## What the checker enforces

These are the spec constraints that have no UI yet, so the checker is the only thing holding them:

- depth cap 3 (trunk, node, child, then `terms[]`)
- focus cap of 3 to 5 questions
- inbox cap of 40 resources
- every question has a non-empty `current_answer`
- every belief credence equals the last `history` entry, and every history entry has a `why`
- every resource outside the inbox has a non-empty `queued_against`
- every `nothing_changed: true` pass has a stated reason
- no edge pointing at an id that does not exist

A dangling edge is a warning, not an error. Everything else fails the run.

## Things that will be asked for and should be pushed back on

- A reading-list view. The spec forbids it. Offer the inbox with a target instead.
- Raising the inbox cap above 40. The cap is the feature.
- A sixth focus question. The cap is the feature.
- Streaks or daily completion. Forbidden outright.
- Auto-generated node trees from a document dump. Nodes earn their existence by having a question attached.

If the user insists after one pushback, do it and note in the commit that it overrides a spec constraint.

## Phase 0 is the whole thing for the first week

Seed the vault from `seed-map.json`. Build `/triage`, `/pass`, `/examine`. Then stop and let the user live in it for a week using Claude Code alone, no UI. The week of real use should rewrite parts of this spec. Ask what changed before starting Phase 1.
