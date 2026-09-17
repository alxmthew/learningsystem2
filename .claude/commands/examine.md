---
description: Socratic pressure on one belief. Always updates last_examined.
argument-hint: <belief-id>
---

Examine this belief: $ARGUMENTS

Read `SPEC.md` section 4 and `CLAUDE.md` if they are not already in context.

## Before you start

`cat vault/beliefs/<id>.md`. Read the whole history, not just the current
credence. The history is the belief.

No argument: list beliefs by `last_examined`, oldest first, and ask which. The
oldest one is usually the right one and usually the one they least want to open.

Read the beliefs it is `load_bearing_for` and the nodes it sits on, so you can
ask question 4 with something concrete in hand.

## The questions

**One per turn.** Pick two or three, not all five. Choose the ones this
particular belief is most exposed to, and say why you chose them if asked.

1. Where did this come from, and who did you get it from?
2. Would you hold it if a less compelling person had said it?
3. What observation in the next 12 months would move you 20 points?
4. What else of yours breaks if this is wrong?
5. Is this a belief, or a preference wearing a belief's clothes?

Question 3 is the one that does the most work. If the answer is "nothing I can
think of", that is the finding. Say it plainly: a belief with no observable
consequence in the next year is not a belief about the world, whatever it feels
like. Ask whether the `falsifier` in the file is real or decorative.

Question 5 is not a trap and should not be asked like one. Preferences are fine.
The problem is only a preference filed under the wrong heading, because it then
gets defended with arguments instead of owned as a taste.

## Disagree where you disagree

If the reasoning has a hole, name the hole. If the credence looks
miscalibrated against the stated evidence, say the number you would expect and
why. If the falsifier is one that could never occur, say that.

Do this once per point, directly, without softening it into a question. They are
using this to find out where they are wrong, and agreement they did not earn is
the thing that makes this system worthless.

Then write what they decide.

## Writing it

Show the diff and confirm. Nothing lands without a yes.

**Always**, whether or not the credence moves:

```yaml
last_examined: <today>
```

**If the credence moves**, append a history entry with their reason in their
words, and update the top-level `credence` to match:

```yaml
  - date: 2026-09-17
    credence: 70
    why: <their reason>
```

A credence change with no stated reason does not get written. If they want to
move the number but cannot say why, leave it and note the attempt in the body.
The wanting-to-move is worth recording on its own.

**If the falsifier changed**, that is often the real delta of the session, more
than the credence. Update it and say so.

**Body prose.** Under `## Why I hold it`, append what they said in their own
words, dated. Corrections struck through rather than erased: keep the old text,
mark it, and write the new underneath. The file should show its own revisions.

If the examination revealed the belief is really two beliefs, propose splitting
it into two files rather than widening the proposition until it is unfalsifiable.

## Check, then commit

```
node scripts/check-vault.mjs
```

Then:

```
belief(meaning-need-not-be-cosmic): 55 → 70
belief(offloading-is-not-atrophy): examined, held at 55
belief(offloading-is-not-atrophy): falsifier was decorative, rewritten
```
