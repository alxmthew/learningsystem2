---
description: Extract the claims in a source, propose where it attaches, land it in the inbox.
argument-hint: <url or pasted text>
---

Triage this source: $ARGUMENTS

You are deciding whether this input has standing, and against what. A link has no
standing on its own. Read `SPEC.md` section 4 and `CLAUDE.md` if they are not
already in context.

## The line you do not cross

Triage extracts the **skeleton of an argument** so it can be filed. It does not
produce something readable in place of the source.

Allowed: who holds what, by what mechanism, resting on what, falsified by what.
Not allowed: a digest, a takeaway, a verdict, "the key insight is", an evaluation
of whether the argument is good, or anything that would let the user skip reading.

If the user asks you to just tell them what it says, say no once and why: a
summary you can read instead of the source is the most harmful thing this system
could offer. Then offer to summarize afterward, as a check on their own reading.

## Steps

**1. Get the source.**
A URL: fetch it. Pasted text: use it. Nothing: ask for one and stop.
If the fetch fails, say so plainly and ask for a paste. Do not work from the title.

**2. Say what it argues, in at most 5 bullets.**
What it argues, not what it covers. "Covers" bullets look like topic lists.
"Argues" bullets have a subject, a verb, and something at stake.
If the source argues nothing and only surveys, say that. A survey is fine, but it
will rarely move a belief and it should be filed knowing that.

**3. Extract the claims.**
One per genuine proposition, usually 1 to 3, rarely more. For each:

- `holder` — a named person. Not "the article". If the author is arguing their
  own case, the author is the holder.
- `proposition` — one sentence, stated so it could be false.
- `mechanism` — why the holder thinks it is true. The causal story, not the vibe.
- `assumptions` — what the source **used but did not argue for**. This is the
  most valuable field and the one that takes actual work. Two or three.
- `falsifier` — the observation that would sink it. If you cannot write one,
  say so explicitly rather than inventing a vague one. A claim with no
  falsifier is worth recording as exactly that.

**4. Propose attachments from the existing map.**
Search the vault for real ids before proposing anything:

```
grep -rh '^id: ' vault/map | sed 's/^id: //' | sort
grep -rh '^id: ' vault/questions | sed 's/^id: //' | sort
```

Propose 1 to 3 node or question ids that already exist.
**If nothing fits, say so.** Do not invent a node. A node earns its existence by
having a question attached, not by being a plausible label for a link. Offer
instead: leave it in the inbox unattached, or drop it.

**5. Name the beliefs it bears on, and the direction.**
Read `vault/beliefs/`. For each belief it touches, say: up, down, or sideways,
and in one clause why. Do not change any credence here. Credences move in
`/pass`, after the user has actually engaged with the source.

**6. Show the files and confirm.**
Before writing anything, print the exact file contents you propose. Then ask.
Nothing lands without a yes.

- Check the inbox first: `ls vault/resources/inbox/*.md | wc -l`. At 40, stop and
  say: "Inbox full. Queue 1 or drop 1 to add more." Do not raise the cap. The cap
  is the feature.
- Resource file: `vault/resources/inbox/<id>.md`, `state: inbox`,
  `queued_against` set to the confirmed targets.
- Claim files: `vault/claims/<id>.md`, one per claim, with `my_credence` left
  null until the user gives one. Do not guess it for them.
- If a target was confirmed, offer to promote it out of the inbox now: move to
  `vault/resources/<id>.md` and set `state: queued`. If nothing fits, it stays in
  the inbox and counts against the 40. That pressure is intentional.

**7. Check, then commit.**

```
node scripts/check-vault.mjs
```

Fix anything it flags before committing. Then one commit:

```
resource(<id>): to inbox against <targets>
claim(<id>): <holder> on <the short version>
```
