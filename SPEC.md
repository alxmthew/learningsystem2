# Delta

A personal epistemic operating system. Working name; rename freely.

The unit of progress is not a note saved. It is a **delta**: a measurable change in what you believe and why.

---

## 0. Read this first

This is a build spec for Claude Code. It describes a local-first app over a git-backed markdown vault, plus a set of agent commands that operate on that vault.

Three things make this not-Notion. If a design decision conflicts with one of these, the principle wins.

**1. The database is a folder of markdown files in git.**
Not a SaaS backend. Every belief, question, and processing pass is a file with YAML frontmatter. The app is a viewer and a capture surface. Claude Code can operate on the vault with plain file tools whether or not the app is running. Git history becomes the user's intellectual autobiography, diffable and permanent.

**2. Resources are evidence, not content.**
A link has no standing on its own. It exists only in relation to a question it might answer or a belief it might move. There is no "reading list" view. There is an inbox with a drain.

**3. Nothing is "consumed." Things are passed.**
A resource has exactly two terminal states: *passed* (it produced a written delta) or *dropped* (it did not earn one). No third state. No "read" checkbox.

---

## 1. Ontology

Six entity types. Resist adding a seventh.

### Trunk
Five fixed top-level domains. Not user-editable in v1.

| id | name | spine question |
|---|---|---|
| `reality` | Reality | What is true? |
| `mind` | Mind | How do minds work? |
| `life` | Life | How should I live? |
| `civilization` | Civilization | What world are we building? |
| `creation` | Creation | What do I do with what I know? |

### Node
A concept in the map. Max depth 3 below a trunk. Below depth 3, concepts live as a `terms` array on the leaf node, never as further nodes. This cap is load-bearing: infinite nesting is how these systems die.

```yaml
id: epistemology
type: node
trunk: reality
parent: null
name: Epistemology
question: How do I know what I think I know?
status: circling        # unexplored | circling | working | can-teach
terms: [justified true belief, induction, abduction, calibration]
last_touched: 2026-09-17
```

**Status is the only progress metric in the app.** It is set by teach-back, never by hand. Explanation:
- `unexplored` — on the map, nothing behind it
- `circling` — reading around it, cannot yet say anything of your own
- `working` — you have written a position, you can argue it, you know where it is weak
- `can-teach` — you explained it cold, from memory, and it held up

### Question
The spine of the system. Everything hangs off a question or it does not exist.

```yaml
id: what-to-keep-doing-myself
type: question
trunk: civilization
text: What should I deliberately keep doing myself even when AI does it better?
status: active          # active | dormant | parked
cadence: weekly         # daily | weekly | seasonal
current_answer: >
  Provisional. Anything where the doing is what produces the judgment...
confidence: 35
next_move: Write 400 words distinguishing offloading from atrophy.
last_moved: 2026-09-12
```

`current_answer` is required and starts as "I don't have one yet." A question without a provisional answer is a mood, not an inquiry. The app shows `last_moved` in days, prominently, and does not hide it.

### Claim
A proposition **someone else** holds. This is the most valuable entity in the system and the one every other tool gets wrong.

```yaml
id: amodei-near-end-of-exponential
type: claim
holder: Dario Amodei
proposition: Current scaling continues far enough to produce extremely capable systems within a few years.
mechanism: Compute + data + algorithmic gains compound; no observed wall in loss curves.
assumptions:
  - Benchmark gains transfer to economically meaningful work
  - Data does not become the binding constraint before 2028
  - No architectural discontinuity is required for agency and long-horizon planning
falsifier: Two consecutive frontier generations with flat real-task performance despite 10x compute.
date: 2025-11-04
source: resources/dwarkesh-amodei.md
my_credence: 45
nodes: [agi-timelines, scaling]
```

Claims are never merged into beliefs automatically. The point is to hold several incompatible ones side by side long enough to see which assumptions generate the disagreement.

### Belief
A proposition **you** hold, with a credence and a history.

```yaml
id: meaning-need-not-be-cosmic
type: belief
proposition: Meaning does not need to be cosmically objective to be real.
credence: 70
history:
  - {date: 2026-03-02, credence: 55, why: Started from Camus, mostly aesthetic preference}
  - {date: 2026-07-19, credence: 70, why: Vervaeke's participatory knowing gave it a mechanism}
falsifier: A case where a person's meaning survives only because they believe it is cosmically grounded, and no constructed account reproduces the effect.
load_bearing_for: [what-to-keep-doing-myself, unconditional-love]
last_examined: 2026-07-19
```

Credence is an integer 0 to 100. Every change writes a history entry with a `why`. **A credence change without a stated reason is rejected by the writer, in the app and in the agent.**

### Resource
An input. Minimal by design.

```yaml
id: dwarkesh-amodei
type: resource
title: Dario Amodei on the end of the exponential
url: https://...
medium: podcast        # essay | paper | podcast | video | book | conversation | course
minutes: 95
state: passed          # inbox | queued | passed | dropped
queued_against: [agi-timelines]   # question or node ids; required to leave inbox
pass: passes/2026-09-17-amodei.md
```

### Pass
The record of one input producing one change. This is the diary of the whole system.

```yaml
id: 2026-09-17-amodei
type: pass
resource: dwarkesh-amodei
date: 2026-09-17
minutes_spent: 95
before: I assumed data was the near-term binding constraint.
encountered: Argument that inference-time compute substitutes for data at the margin.
changed: Moved scaling-continues from 40 to 55. Data constraint is weaker than I thought for reasoning tasks specifically, not in general.
follows: Read the Bitter Lesson for Data Filtering piece next. Find the strongest steelman of the data-wall view.
nothing_changed: false
```

`nothing_changed: true` is a legitimate outcome and the app treats it as a real result, not a failure. But it requires one sentence on why the time was spent anyway. Three in a row on the same node triggers a flag in the weekly survey.

### Edge
Typed relations, stored in `vault/edges.yaml`. The tree cannot express what matters most.

Types: `supports`, `contradicts`, `depends_on`, `instance_of`, `tension_with`, `bridges`, `answers`, `prompted_by`.

`bridges` is the interesting one. Example: `god` (Reality) bridges `meaning` (Life) bridges `religion` (Civilization). The map renders bridges across trunks as the only lines that break the tree layout.

---

## 2. Vault layout

```
vault/
  map/
    reality/epistemology.md
    reality/philosophy-of-mind.md
    mind/learning.md
    life/vervaeke.md
    civilization/ai/compute.md
    creation/writing.md
  questions/
    what-to-keep-doing-myself.md
  beliefs/
    meaning-need-not-be-cosmic.md
  claims/
    amodei-near-end-of-exponential.md
  resources/
    inbox/                      # unqueued, capped
    dwarkesh-amodei.md
  passes/
    2026-09-17-amodei.md
  outputs/
    essays/
    experiments/
  collisions/
  edges.yaml
  focus.yaml
```

Frontmatter carries structure. The body carries prose: the actual thinking. Never put prose in frontmatter.

Every write is a git commit with a message generated from the entity type and the delta, e.g. `belief(meaning-need-not-be-cosmic): 55 → 70`.

---

## 3. Views

Six screens. Build them in this order.

### Rotation (home)
The answer to "cycle through my priorities."

- Shows **one focus question at a time**, full screen, as a card.
- `focus.yaml` holds **3 to 5** active questions. Hard cap enforced at write time. To add a sixth, you must retire one and write a one-line "where I got to," which is appended to that question's file.
- Keyboard: `j` / `k` cycle, `space` opens the next move, `d` marks it moved today, `r` retires it, `/` jumps to search.
- Each card shows: the question, the current provisional answer, confidence, the next move, days since last moved, and the 2 to 4 resources queued against it.
- Days-since is rendered plainly. At 30+ days the card asks one question: "Still active, or park it?"

### Map
Full-bleed graph of trunks and nodes.

- Node **color encodes status**, not category. The satisfying visual is watching color spread as understanding does.
- Node **size encodes passes written**, not resources collected. A node with 20 saved links and no passes renders small and pale, which is the truth about it.
- Cross-trunk `bridges` edges render as the only curved lines. Everything else is orthogonal.
- Click a node: its terms, its questions, its passes, its claims, its neighbors.

### Ledger
The belief list. Sortable by *most moved*, *least examined*, *most load-bearing*, *lowest confidence*.

Each row shows the proposition, current credence, and a sparkline of credence history. This is the single most important screen for the stated goal, because it is the only place where "I changed my mind" is visible as data.

### Passes
Reverse-chronological feed of deltas. Filterable by node, trunk, month. This is the thing to reread in a year.

### Inbox
Capture and drain.

- Paste a URL or text, it lands in `resources/inbox/`.
- **Cap: 40 items.** At 41, the inbox goes read-only until items are queued or dropped. The app says so plainly: "Inbox full. Queue 1 or drop 1 to add more."
- To leave the inbox, a resource must be `queued_against` at least one question or node. Filing without a target is the failure mode this cap exists to prevent.

### Tables
Disagreement grids. One per contested topic.

| holder | claim | mechanism | key assumption | falsifier | my credence |

Generated by `/disagree`, editable by hand. Directly serves the stated end goal: explain why Sutton, LeCun, Hassabis, Amodei, and Aschenbrenner disagree, and what would update you.

---

## 4. Agent

The agent is not a chat bubble. It is a set of commands in `.claude/commands/` that read and write the vault, plus an in-app version of two of them for capture.

Common rules for every command:

- **Propose, never auto-file.** Every write is shown as a diff and confirmed.
- **One question at a time** in interview modes. Never a wall of questions.
- **Never summarize a resource before the user has engaged with it.** Summaries that let you skip the source are the single most harmful feature this app could ship.
- Reject vague deltas. "Interesting, made me think" is sent back once with a specific follow-up.

### `/triage <url | paste>`
1. Fetch. Produce at most 5 bullets of what it argues, not what it covers.
2. Extract claims: holder, proposition, mechanism, assumptions it did not argue for, falsifier.
3. Propose node and question attachments from the existing map. If nothing fits, say so rather than inventing a node.
4. Name which existing beliefs it bears on and in which direction.
5. Write to `resources/inbox/` after confirmation.

### `/pass <resource>`
The ritual. Interview, one question per turn:

1. Before you started, what did you believe about this?
2. What is the strongest thing it said? In your words.
3. What did it assume without arguing for?
4. What changed? "Nothing" is allowed.
5. If nothing changed, why was the time worth spending?
6. What follows? One thing you would now do, predict, or say differently.

Then: write the pass file, propose credence updates on linked beliefs with reasons, set resource state to `passed`, commit.

### `/examine <belief>`
Socratic pressure on one belief. Rotate through:
- Where did this come from, and who did you get it from?
- Would you hold it if a less compelling person had said it?
- What observation in the next 12 months would move you 20 points?
- What else of yours breaks if this is wrong?
- Is this a belief, or a preference wearing a belief's clothes?

Updates `last_examined` regardless of whether credence moves.

### `/collide <node> <node>`
Not a comparison. Produce 3 genuine tensions where the two areas make incompatible demands, in the shape of the user's own worked example:

> Religion × Institutions: How does institutionalization change spiritual insight? Why do charismatic movements become bureaucracies? Can secular institutions reproduce ritual, belonging, and moral formation?

Offer to promote the best one to a Question. With no arguments, pick two nodes weighted toward *different trunks* and *high pass counts*, so collisions land between things you actually know something about.

### `/teachback <node>`
1. User explains the node from memory. No notes.
2. Agent grades **against the user's own prior passes and notes**, not against the internet. The question is "did you keep what you had," not "do you match Wikipedia."
3. Returns three lists: what held, what degraded, what was never there.
4. Proposes a status change. This is the only path to `can-teach`.
5. Schedules a re-test: 7 days, then 30, then 90.

### `/survey`
Weekly. Returns at most 6 proposed moves, no dashboard:
- trunks with no passes in 30 days
- nodes with more than 5 resources and zero passes (bookmark rot, named plainly)
- beliefs unexamined in 90 days
- focus questions unmoved in 21 days
- questions whose `current_answer` has not changed since creation
- three-in-a-row `nothing_changed` streaks

### `/disagree <topic>`
Pull every claim touching the topic. Build the assumption tree that generates the disagreement. Output the table plus a short prose account of the actual crux. Refuse to declare a winner unless asked directly, and when asked, give a credence rather than a verdict.

---

## 5. Stack

- Next.js App Router, TypeScript, Tailwind
- `gray-matter` for frontmatter, `yaml` for `edges.yaml` and `focus.yaml`
- SQLite via `better-sqlite3` as a **derived index only**, rebuilt from the vault at boot and on file change via `chokidar`. The index is disposable. The markdown is canonical. Never write app state that exists only in SQLite.
- `simple-git` for commits
- `d3-force` for the map
- `@anthropic-ai/sdk` server-side for in-app agent calls. Key in `.env.local`, never in the client.
- Runs locally with `pnpm dev`. Vault is a private git repo, optionally a submodule.

Deployment is not a v1 concern. This is a tool that runs on one machine.

---

## 6. Design direction

The subject is a working cartographer's notebook: ruled, annotated in the margins, corrections struck through rather than erased, a second pen color for revisions. Not a dashboard, not a knowledge-base template.

**Palette**

| token | hex | use |
|---|---|---|
| `paper` | `#E6E9E2` | background, engineering-pad pale green rather than cream |
| `ink` | `#1B2021` | body text |
| `rule` | `#C2C9BE` | hairlines, grid |
| `low` | `#9AA096` | low credence |
| `high` | `#2E4A45` | high credence, deep pine |
| `revision` | `#4A3B7A` | violet marginalia: anything that marks a change of mind |

Credence is the one place color carries meaning: confidence literally darkens along the `low` to `high` ramp. Revisions are violet everywhere, in every view, without exception.

**Type**

Newsreader for everything readable, including the questions set large in italic as the display moment. Public Sans only for numerals and dense table cells. No all-caps labels. No eyebrows above headings. No arrows appended to buttons.

**The one bold element**

The credence scale. A ruled line across the belief card with a draggable mark, and every previous mark left faintly visible behind it. Each belief visibly carries its own history of being wrong. Nothing else on the page competes with it.

**Restraint**

Left rail is a table of contents, not a nav bar. Motion only in response to an action, and only to show what changed: when a credence moves, the old mark fades to ghost rather than disappearing. No card grids, no shadows, no gradients.

---

## 7. Forbidden

Do not build these, even if they seem helpful.

- Streaks, or any daily-completion mechanic
- "Resources saved" as a headline number anywhere
- AI summaries presented before the user has read the source
- Auto-tagging or auto-filing without confirmation
- Node nesting beyond depth 3
- A generic chat panel that floats over every screen
- Sharing, publishing, or multiplayer in v1
- Any reading-list view

---

## 8. Build order

**Phase 0 — vault only, no app.**
Seed from `seed-map.json`. Write the `.claude/commands/` for `/triage`, `/pass`, `/examine`. Usable on day one through Claude Code alone. Live in it for a week before building any UI, and let that week change the spec.

**Phase 1 — read-only viewer.** Map, Ledger, Passes. No writes.

**Phase 2 — capture and rotation.** Inbox with the cap, Rotation with the focus cap, all writes going through git.

**Phase 3 — in-app agent.** Triage on paste, pass interview in the app.

**Phase 4 — collide, teachback, survey, disagreement tables.**

---

## 9. What good looks like in six months

Not 400 nodes. Not a full inbox.

- 8 to 12 beliefs with real credence histories and at least one large reversal among them
- 3 to 5 nodes at `can-teach`
- One disagreement table where the assumption tree is genuinely mapped
- A passes feed you would be glad to reread
