---
name: screen-build
description: The order of work for building or changing a Monti admin screen, from the feature doc to the merge. Load when starting a feature doc that has screens, or a change to a built screen that adds a state or a control. The look's rules are in the admin-ui skill; this one says what happens when, and what the owner sees before code.
---

# Building a Monti admin screen

The owner decides by seeing. A doc approved as text still has gaps, and a gap found on a built screen costs five times the code that built it (doc 09: 2.2 hours of first code, 10.4 hours of rework). So the screen is settled on pictures first, the ways to use it are written as tests before the code, and the reviews come once, at the end.

## 1. Screen approval, before any screen code

1. Read the feature doc, its flow (`docs/design/admin/flows`), the screen's part map (`docs/design/admin/screens`) and its reference story.
2. List the gaps along six questions:
   - Is there a picture for every state (empty, loading, refused, read-only, many, narrow)?
   - Which existing screen or part already does the same job? Use it; do not draw a second one.
   - For every control: its unit, and what the person sees after it is pressed.
   - What shape does the site receive (the value a template reads)?
   - Every string on the screen, short (one reason in a few words).
   - What is in and what is out. Nothing is "later" without a tracker row.
3. Show one recommended mockup for each gap in the thread (`html_preview`, the admin's tokens), all in one sitting. Name things by what is seen on the screen, not by part names. The owner approves or changes each.
4. Write the decisions into the doc under "화면 승인 (date)" and into the part map. A decision that changes a rule of `docs/design/admin` changes that page in the same PR.

Core work that does not depend on the screen (operations, tables, their tests) can go ahead meanwhile.

## 2. Scenes first

1. For each part the screen will use, find its kind in `testing/scenes.ts` and take the kind's `admin` scenes. Add the flow's own steps and each done criterion of the doc that is met on the screen.
2. Write them as `it.todo("[scene] what the person does and what must hold")` in the screen's `*.screen.test.tsx`, and show the list to the owner: it is the list of what will be tried. `pnpm check:scenes` refuses a push while a `.todo` is left, so the list cannot be forgotten.
3. A defect that got past a merged PR becomes a scene in `testing/scenes.ts` (with the PR it was found in); the owner approves a change to that file.

## 3. Build

Load the `admin-ui` skill and follow its order: parts first in `@monti-cms/ui` with stories, then the screen. A new story's `play` brings the screen to a state and only waits until it is there; what must hold after an action is a test. Older stories still check results in their `play`: move those checks to a test when you touch the story.

Fill each `it.todo` as its piece is built:
- Real input (`userEvent` of `vitest/browser`, and `testing/input.ts`: `pointerPath`, `dragPath` with `hold`, `typeKorean`, `pickWords`, `caretAfter`), not dispatched events.
- A state no story draws: `scene({ loaders: … }, stories.default)` of `packages/admin/test/scene.ts`, which also hands the test the site (`loaded().site.monti`) to read what the operations say.
- Run each new test once against the code without the change it guards: it must fail. A check that something is absent stands next to one that something is there.

## 4. Before handing over

1. `pnpm lint && pnpm typecheck && pnpm check:design && pnpm check:scenes && pnpm test:browser`.
2. Look at every changed state yourself in Storybook at 1440×900, the parts' own stories too (a screen's padding can hide a part's defect), and do the checks of `admin-ui` step 7 (row heights, in-between states, Tab through).
3. Hand over with the list of states to look at, in the words of the screen.

## 5. Reviews, once each, in this order

1. The owner looks. Fix what they say; a reversal of a reviewer's reading is the owner's call (ask with the concrete loss in one line).
2. Code review: one for a small fix, two for a feature doc's PR.
3. The `design-review` agent reads the whole PR once, last; then only delta reads of what was fixed. `pnpm check:review` and the merge hook hold the PR until its admin UI is the one on record.
4. The `screen-check` agent tries the changed screens in a browser, once.
5. Merge with `gh pr merge <number> --squash --match-head-commit <sha>`.

## What the gates hold, and what they do not

| Gate | Holds | Does not hold |
|---|---|---|
| `check:scenes` (pre-push, CI, the hook before `git push` and `gh pr create`) | a scene for every kind of part a folder uses; no `.todo`, `.only`, or skip without its tracker item | that the test does what its scene says: the review reads it |
| `check:design` | tokens, raw lengths, imports | heights made of padding, a ring cut by a scroll box: measure |
| `check:review` and the merge hook | nothing merged unread | that the reading was right: the owner's look comes first |
| `check:operations` | a doc is not done with open tracker rows | that a put-off row was written at all: write it when you put something off |
