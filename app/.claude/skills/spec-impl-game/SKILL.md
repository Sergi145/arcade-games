---
name: spec-impl-game
description: Implements an approved spec for a new game exactly like /spec-impl (same four phases: validates "Approved" state, creates the git branch, implements step by step with pauses), then automatically chains the game-planner and game-jam agents, one after the other, to plan the next game for the catalog.
disable-model-invocation: true
argument-hint: <NN-spec-name>
allowed-tools: Read, Glob, Grep, Edit, Write, Agent, AskUserQuestion, Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git log:*), Bash(git diff:*), Bash(git stash:*), Bash(cat:*), Bash(ls:*)
---

# /spec-impl-game — Implementer of approved game specs + next-game planning

This command is `/spec-impl` (see `app/.claude/skills/spec-impl/SKILL.md`) with
one addition: once the implementation is finished, it automatically calls the
`game-planner` agent and then the `game-jam` agent, one after the other, to
plan what game comes next for the catalog. Phases 1–4 below are the same
phases as `/spec-impl`, followed **in the same order and with the same
rules** — nothing about the implementation flow itself changes. Use this
command specifically for specs that add a new game to the catalog (the kind
built with the `add-arcade-game` skill); for any other kind of spec, use
plain `/spec-impl` instead, since chaining game-planning agents afterwards
would not make sense.

## Session context

Current repository state:
!`git status --short`

Current branch:
!`git branch --show-current`

Specs available in this folder:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist"`

Branch-creation config:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, no config file)"`

---

## Instructions

Follow these five phases in strict order. **Do not advance to the next phase
if the previous one did not complete correctly.** Phases 1–4 are identical to
`/spec-impl` — do not skip or shortcut any of them just because a fifth phase
follows.

---

### Phase 1 — Identify the spec

The received argument is: `$ARGUMENTS`

If `$ARGUMENTS` is empty:

- List the files available in `specs/` (you already have them above).
- Ask the user to specify the exact name of the spec.
- Stop and wait for an answer. Do not continue.

If `$ARGUMENTS` has a value:

- Look for the file in `specs/`. The user may have written the full name
  (`04-motor-real-rocas`), only the number (`04`), or only the slug
  (`motor-real-rocas`). Try to find the correct file in any of those cases.
- If you do not find the file, show the available specs and ask the user to
  correct the name.
- If you do find it, continue to Phase 2.

---

### Phase 2 — Validate the spec's state

Read the spec file you located in Phase 1 using the Read tool or `cat`.

In the file's contents, look for the line that contains the spec's state. The
header label is typically `**Status:**` (English) or `**Estado:**`
(Spanish), but it may use any language. Match by position (status line near
the top of the spec) and by the surrounding state machine, not by the exact
label.

**Absolute rule:** You can only continue if the state **means "Approved"** —
regardless of the language used.

Treat any of the following (and their equivalents in other languages) as the
**Approved** state and continue:

- English: `Approved`
- Spanish: `Aprobado`
- Portuguese: `Aprovado`
- French: `Approuvé`
- German: `Genehmigt`
- Italian: `Approvato`
- …or any other language's word that clearly means "approved"

Anything else (Draft / Borrador, In review / En revisión, Implemented /
Implementado, Obsolete / Obsoleto, or any unrecognized value) means **stop**
and show the error message below.

| State category                            | Examples (any language)                           | Action                                                                     |
| ----------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------- |
| Approved                                  | `Approved`, `Aprobado`, `Aprovado`, `Approuvé`, … | Continue to Phase 3.                                                       |
| Draft                                     | `Draft`, `Borrador`, …                            | Stop. Show the error message below.                                        |
| In review                                 | `In review`, `En revisión`, …                     | Stop. Show the error message below.                                        |
| Implemented                               | `Implemented`, `Implementado`, …                  | Stop. Show the error message below.                                        |
| Obsolete                                  | `Obsolete`, `Obsoleto`, …                         | Stop. Show the error message below.                                        |
| State line not found / unrecognized value | —                                                 | Stop. The file does not follow the expected format. Tell this to the user. |

If you are unsure whether a value means "approved", **do not assume**. Stop
and ask the user to clarify or to update the spec to the canonical wording.

**Standard error message when the state does not mean Approved:**

```
❌ I cannot implement this spec.

Current state: [STATE FOUND]
I only work with specs whose state means "Approved" (e.g. `Approved`, `Aprobado`,
or the equivalent in another language).

To continue you have two options:
  1. If the spec is ready to be implemented, open it and change the state
     to "Approved" (or the equivalent term your team uses) manually.
     That change is made by the human, not the agent.
  2. If the spec still needs work, use /spec [name] to resume it.
```

Do not offer alternatives, do not suggest "I can still start if you want".
The block is intentional.

---

### Phase 3 — Create the git branch and switch to it

Once you have confirmed the state means `Approved`:

0. **Check the working tree first.** Look at the `git status --short` output
   in the session context above. If it is **not empty**, stop and show the
   pending changes, then ask:

   ```
   ⚠️ There are uncommitted changes in the working tree.
   Switching branches would carry them over. What do you want to do?
     1. Commit or stash them yourself, then re-run this command  (recommended)
     2. Continue anyway — the changes travel to the new branch
   ```

   Wait for the answer. **Do not stash or commit on the user's behalf**
   unless they explicitly ask for it. If the working tree is clean, skip
   straight to step 1 without mentioning it.

1. Derive the branch name from the spec file's full name, without the
   extension. Format: `spec-NN-slug`. Examples:

   - `04-motor-real-rocas.md` → branch `spec-04-motor-real-rocas`
   - `12-raya-veloz.md` → branch `spec-12-raya-veloz`

2. Read the `AutoCreateBranch` flag from the **Branch-creation config** shown
   in the session context above.

   - If the config file does not exist, the value is missing, or the value
     is unrecognized → treat it as `true` (the default).
   - Only an explicit `false` (in any capitalization) disables automatic
     branch creation.

   **If `AutoCreateBranch` is `true` (default):** proceed without asking.

   - If the branch **does not exist**: create it with
     `git checkout -b spec-NN-slug`.
   - If it **already exists**: this means previous work is being resumed.
     Switch to it, read `git log --oneline` on the branch, and tell the user
     which steps of the plan already look done and which step you propose to
     resume from. Wait for confirmation on the resume point before
     implementing anything.
   - In both cases: switch to the branch with `git checkout spec-NN-slug` and
     confirm the change was successful before continuing.

   **If `AutoCreateBranch` is `false`:** ask before touching git. Show:

   ```
   AutoCreateBranch is set to false.
   Create and switch to the branch spec-NN-slug? [y/N]
   ```

   - If the user answers **yes**: create/switch to the branch exactly as in
     the `true` case above.
   - If the user answers **no** or leaves it empty: **do not create any
     branch.** Tell the user you will implement on the current branch (the
     one shown in the session context above) and ask for explicit
     confirmation to continue there. Do not improvise — wait for the answer.

3. Visually confirm to the user the spec is ready and which branch is
   active:

   ```
   ✅ Ready to implement.

   Spec:   specs/NN-slug.md
   Branch: spec-NN-slug  (active)   (← or the current branch, if no new branch was created)
   State:  Approved   (← echo back the actual value found in the spec)
   ```

4. **Do not start implementing yet.** First show the spec summary to the
   user so they have it fresh. Extract and show:
   - The **objective** (the line after `**Objective:**` /
     `**Objetivo:**` / equivalent label).
   - The **scope** (the `## Scope` / `## Alcance` / equivalent section).
   - The **implementation plan** (the section with the numbered steps —
     `## Implementation plan` / `## Plan de implementación` / equivalent).
   - The **acceptance criteria** (the checklist —
     `## Acceptance criteria` / `## Criterios de aceptación` / equivalent).

Match section headings by meaning, not by exact wording — the spec may be
authored in any language.

---

### Phase 4 — Implement step by step

After showing the spec summary, tell the user:

```
I am going to implement the spec following the implementation plan exactly.
I will pause after each step so you can review the diff.

Shall we start with Step 1?
```

Wait for explicit confirmation ("yes", "go ahead", "go", or equivalent). Do
not start without it.

Once confirmed, follow these rules during the entire implementation:

**Never commit automatically.** Not per step, not at the end. You write the
code and show the diff; committing is the user's decision and the user's
command. Only commit if they explicitly ask you to.

**One rule above all:** implement what the spec says. If something in the
spec looks suboptimal to you, mention it as an observation but implement
what was agreed. Changes to the spec go into the spec, not into the code by
surprise.

**Work rhythm:**

- Implement one step of the plan.
- Show a summary of which files you touched and what you did.
- Say: `Step N completed. Could you review the diff and let me know if I continue with Step N+1?`
- Wait for confirmation before continuing.

**If during the implementation you find an ambiguity** the spec does not
resolve:

- Stop.
- Describe the ambiguity exactly.
- Present two or three concrete options.
- Wait for the user's decision.
- Do not improvise.

**If the user asks for something that is out of the spec's scope:**

- Remind them that it is out of this spec's scope.
- Suggest noting it down for the next spec.
- Do not implement it on this branch.

**When finishing the last step:**

```
✅ All steps of the plan are implemented.

Next step: verify the spec's acceptance criteria one by one.
If they all pass, update the spec's state to "Implemented" (or the equivalent
in your repo's language) and make the final commit before merging this branch.
```

Immediately after showing this message, continue to Phase 5 below — do not
wait for the user to verify the acceptance criteria or to commit first. That
verification and the eventual commit remain entirely the user's own next
steps; Phase 5 only reads the catalog and plans ahead, it never touches the
code you just wrote and never commits anything.

---

### Phase 5 — Plan the next game (game-planner → game-jam)

This is the phase that distinguishes `/spec-impl-game` from plain
`/spec-impl`. It runs automatically, without asking for confirmation, right
after the "✅ All steps of the plan are implemented" message. Call the two
agents **sequentially, never in parallel** — the second call must not start
until the first one's final report has come back.

1. **Invoke the `game-planner` agent** (`Agent` tool, `subagent_type:
game-planner`). Tell it, in the prompt, that the spec you just finished
   implementing (`$ARGUMENTS`, i.e. the game it added to the catalog) is
   done, and ask it to re-evaluate the catalog from scratch and produce its
   usual recommendation for the next game to add — main pick, alternatives
   considered, risks, and next step — updating
   `references/games-suggestions-todo.md` as it always does. Wait for it to
   finish. Show its final report to the user verbatim, do not summarize it
   away.

2. **Invoke the `game-jam` agent** (`Agent` tool, `subagent_type: game-jam`)
   — only after step 1 has fully finished. If game-planner's main
   recommendation names a clear, concrete theme or concept, pass that theme
   to game-jam in the prompt (e.g. "brainstorm 3 proposals around <theme>,
   following up on game-planner's latest recommendation") so it has a
   running start instead of asking again for something already decided. If
   game-planner's recommendation is not a clean single theme (e.g. it
   recommends porting an existing `started-games/` candidate as-is, with no
   open "what should the next game be about" question), invoke game-jam
   without forcing a theme and let it ask the user directly, exactly as it
   does when used standalone. Let game-jam run its complete flow (3 parallel
   proposals, then its own `AskUserQuestion` for the user to pick one) and
   show its final report to the user.

3. Close with a short summary for the user covering: which game this spec
   just added to the catalog, what game-planner recommends building next,
   and the outcome of the game-jam round (a spec freshly promoted to
   `specs/NN-slug.md` in `Draft` state, or a pending decision if the user
   chose to regenerate/tweak proposals instead of picking one).

Neither agent call in this phase writes application code, touches the
branch created in Phase 3, or commits anything — `game-planner` only writes
to `references/games-suggestions-todo.md`, and `game-jam` only writes inside
`specs/game-jam/**` and, if a proposal is promoted, a new `specs/NN-slug.md`.

---

## Summary of expected behavior

```
/spec-impl-game 12-raya-veloz

  Phase 1  →  Finds specs/12-raya-veloz.md
  Phase 2  →  Reads the state → "Approved" (or "Aprobado", etc.) → ✅ continues
  Phase 3  →  git checkout -b spec-12-raya-veloz → git checkout spec-12-raya-veloz
              Shows objective, scope, plan and criteria
  Phase 4  →  Implements step by step with pauses
              Ends by reminding to verify the acceptance criteria
  Phase 5  →  Calls game-planner (updates references/games-suggestions-todo.md,
              shows its recommendation for the next game)
              Then calls game-jam (3 parallel proposals, user picks one,
              winner promoted to a new Draft spec)

/spec-impl-game 13-controles-tactiles  (state: Draft / Borrador)

  Phase 1  →  Finds specs/13-controles-tactiles.md
  Phase 2  →  Reads the state → "Draft" → ❌ stops
              Shows the standard error message
              Does not create branch, does not touch code, never reaches Phase 5
```

**Branch creation is controlled by the `AutoCreateBranch` flag** in
`specs/.spec-config.yml`, exactly as in `/spec-impl`. It defaults to `true`
(create the branch automatically, as shown above). Set it to `false` to make
Phase 3 ask `[y/N]` before creating the branch.
