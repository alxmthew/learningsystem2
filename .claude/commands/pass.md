---
description: The six-question ritual. Turn one input into one written delta.
argument-hint: <resource-id>
---

Run a pass on: $ARGUMENTS

This is the ritual. A resource has two terminal states: **passed**, meaning it
produced a written delta, or **dropped**, meaning it did not earn one. There is
no third state and no "read" checkbox.

Read `SPEC.md` section 4 and `CLAUDE.md` if they are not already in context.

## Before you start

Find the resource: `find vault/resources -name '<id>.md'`.
No argument: list what is queued and ask which one. Do not pick for them.

Read the resource file and any claims that cite it. Do not print a summary of the
source. The user is about to tell you what they got from it, and your version in
front of them would contaminate that.

If it becomes clear they have not actually engaged with the source, say so and
stop. Offer `/triage` to file it, or drop it. A pass on something unread is a
lie in the git log, and the git log is the point.

## The interview

**One question per turn.** Ask, wait, read the answer, then ask the next. Never
two at once. Never a numbered list of all six.

1. Before you started, what did you believe about this?
2. What is the strongest thing it said? In your words.
3. What did it assume without arguing for?
4. What changed? "Nothing" is allowed.
5. Only if the answer to 4 was nothing: why was the time worth spending?
6. What follows? One thing you would now do, predict, or say differently.

Between questions, add nothing. No "good answer", no restating what they said
back to them, no congratulating them for processing a resource. The work is its
own thing. If a short acknowledgement is needed to move on, one clause.

## Rejecting a vague delta

On question 4, these are not deltas:

- "interesting", "made me think", "a lot to chew on"
- "I agree with a lot of it"
- a restatement of the source's thesis with no position of their own
- "it confirmed what I thought" with nothing about *why the confirmation counts*

Send it back **once**, with a specific follow-up, not a general nag. Good
follow-ups name the thing:

> Which sentence of yours from question 1 would you now write differently?
> You said X before and the source said Y. Which one are you keeping?
> Confirming evidence still moves a credence. How many points, and why that many?

If the second attempt is still vague, accept it and note it in the pass file.
Do not nag twice. Repeated vagueness on the same node is a signal about the
node, not about the user, and `/survey` will pick it up.

## Then disagree, if you do

If their reading of the source looks wrong to you, or the delta does not follow
from what they said, say so directly, once, before writing the file. They are
using this to find out where they are wrong. Sycophancy here is worse than
being useless. Then write what they decide, not what you think.

## Writing it

Show the exact file contents and the diffs, then ask. Nothing lands without a yes.

**The pass file**, `vault/passes/<YYYY-MM-DD>-<slug>.md`:

```yaml
id: 2026-09-17-amodei
type: pass
resource: dwarkesh-amodei
date: 2026-09-17
minutes_spent: 95
before: <their answer to 1>
encountered: <their answer to 2>
changed: <their answer to 4>
follows: <their answer to 6>
nothing_changed: false
```

Their answer to 3 goes in the body as prose, under `## What it assumed`. Never
put prose in frontmatter. Anything else worth keeping from the conversation goes
in the body too, in their words, not yours.

If nothing changed: `nothing_changed: true` and `worth_it: <their answer to 5>`.
This is a real result, not a failure, and the file should not apologize for it.

**Credence updates.** For each belief the resource bears on, propose a new
credence and ask for the reason in their words. Then append to `history`:

```yaml
  - date: 2026-09-17
    credence: 55
    why: <their reason, not yours>
```

and set the top-level `credence` to match. **A credence change with no stated
reason does not get written.** No exceptions. If they will not give a reason,
that is itself information: leave the credence alone and say why you did.

If a credence does not move, write nothing. An unchanged belief needs no entry.

**Everything else:**
- resource `state: passed`, `pass: passes/<file>.md`
- `last_touched: <today>` on every node the resource was queued against
- `last_moved: <today>` on every question it was queued against, and ask whether
  `current_answer`, `confidence`, or `next_move` should change. Often they should.
  A question whose `current_answer` never changes is one `/survey` will flag.

## Check, then commit

```
node scripts/check-vault.mjs
```

Fix anything it flags first. Then one commit per delta, so the log reads as a
history of changing your mind:

```
pass(amodei): data constraint weaker than assumed
belief(meaning-need-not-be-cosmic): 55 → 70
question(what-is-knowing): moved, confidence 25 → 35
```

Write messages they would want to read in a year. Not "update files".
