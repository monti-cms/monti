# Testing

Status: draft, for review. The suite is moved to these rules one package at a time, core first; until a package is moved, its tests may still break
them. The numbers the overhaul starts from are in [`testing/baseline-2026-10.md`](testing/baseline-2026-10.md).

Goal: tests that catch defects, and cost little to run and to keep. Fewer tests is not the goal. A test earns its place by failing when the code is
wrong, and by staying green when the code changes without changing what it does.

## Two kinds of test

- **Behavior**: what the code does. Layers L1 to L4 below. This page is about these.
- **Looks**: what the admin looks like. Storybook stories, the visual comparison and the audit (`packages/ui/visual`, see the `packages/ui` README).
  A behavior test never checks looks: no class names, no order of elements on the page, no widths.

## Layers

A layer is named by what has to be running for the test to check its behavior, not by back end or front end. Front-end code lands in several layers.

| Layer | What runs | File | Runner | For example |
|---|---|---|---|---|
| L1 logic | Nothing but the code | `foo.test.ts` | Vitest, node | `membersToRestore`, `canTransition`, slug rules, schema diff |
| L2 integration | Postgres, the file system, a child process | `foo.db.test.ts` | Vitest, node, the test database | The store restoring a trashed group, a migration, `monti init` |
| L3 component | A component, rendered with the providers the admin uses | `foo.test.tsx`; `foo.browser.test.tsx` when it needs layout, focus or the editor | Vitest with jsdom; Vitest browser mode | A row menu's keyboard and callbacks; a popover placed by the caret |
| L4 flow | The example app, its database and a browser | `examples/blog/e2e/<flow>.spec.ts` | Playwright | Write a post, publish it, see it on the site |

**One behavior, one layer.** A behavior is tested once, in the lowest layer that can catch its defects. A rule that is a function is tested in L1, not
again through the database, the HTTP route and the screen. A higher layer checks that the layers join (the route calls the service, the screen sends the
request), not every case again. L4 has one test per flow of the admin's design (`docs/design/admin`), and nothing else.

**jsdom or a real browser.** jsdom draws nothing: every box is 0 by 0, the caret has no position, and focus and timers do not behave as in a browser.
It is fine for a component whose behavior does not depend on any of that (a menu's items, a form's validation). A test that needs a position, a size,
focus moving, or the editor goes to `*.browser.test.tsx`. A test that makes up sizes or stubs a browser API to get past jsdom belongs there instead.

## Front end

- **Extract judgments, not hooks.** When a component decides something with many cases (which bulk actions a selection allows, what the slash menu shows),
  the decision becomes a plain function of its inputs and is tested in L1. Extract only when there are many cases, the decision is used in more than one
  place, or it is an asynchronous state machine (as `entry-editor-store`, a plain object that runs without React). Everything else stays in the
  component and is tested there, which also tests how the component uses it.
- **No hook tests.** A hook is not tested on its own: it is tested through the component that uses it, or its decision moves out into a function.
- **Storybook is for looks.** Stories are the catalog, the visual comparison and the accessibility check. Behavior tests do not run stories, and a
  story's `play` only sets up a state to look at (a menu opened).

## Writing a test

Every test answers three questions. If one has no answer, the test is not written.

1. **What does it promise?** A behavior someone relies on: a public function, an HTTP route, a CLI command, what the admin can do on a screen.
2. **Which layer?** The lowest one that can catch it.
3. **How would the code have to be wrong for it to fail?** Name the defect. A test that passes for any value (`toBeDefined`, `toBeTruthy`) answers
   nothing.

### The site config

Tests run against the reference blog config and again against a second site config (`vitest.othersite.config.ts`). A test that runs on the shared site
looks names up from the config (`packages/core/test/any-site.ts`: `contentCollection`, `titleFieldOf`, `secondLocale`, …) and never writes `"post"`,
`"ko"` or `"summary"` itself. A test that is about the blog alone is named `*.blog.test.ts`. A test that needs a config of its own builds it in the
test.

The other-site run repeats only the tests whose result can depend on the config, and it finds them by itself (`packages/core/test/config-sensitive.ts`).
No package keeps a hand-written list.

### Language and copy

Screen tests render in one language, Korean. A test finds text by its message key through the translator (`testSite.createTranslator(messages)`), and
never types the copy: a test that writes the copy breaks when the copy changes, and one that accepts the Korean or the English copy passes in either
language.

### Each test stands alone

A test sets up the state it needs and leaves nothing for the next one. It passes when run alone (`-t`) and in any order (`--sequence.shuffle`). A
file that runs one scenario in steps (create, change, apply) is one test with steps, not several tests that read each other's state.

### Waiting

Wait for a condition (`findBy…`, `waitFor`, `expect.poll`) or move a fake clock (`vi.useFakeTimers`). Never wait a fixed time.

## Forbidden

| Pattern | Why | Instead |
|---|---|---|
| A regex that accepts Korean or English | Passes in either language, so a negative check passes always | The translator, in Korean |
| `toBeDefined()` on a result or an error | Passes for any value, any error | Check the value, or the error's code |
| `toBeTruthy()` on an element or a value | Passes for anything present | Check what it should be |
| A fixed sleep (`setTimeout`, `sleep(n)`) | Slow, and still flaky on a slow machine | Wait for a condition, or a fake clock |
| `return` inside a test to skip it | Reports a pass for a test that did not run | `it.skipIf(…)`, or set up what it needs |
| Class names, data attributes, DOM order in a behavior test | That is how the component is built and looks | Role and name; looks go to the visual tests |
| `querySelector`, test ids | Ties the test to the markup | Role and name (`getByRole`) |
| A mock of the package's own module | Tests the mock, and breaks on any internal move | Use the module; mock only the edge (network, clock, model) |
| Mock call arguments read by position (`mock.calls[0][1]`) | Breaks when an argument is added | `toHaveBeenCalledWith` with what matters |
| A blog name in a shared-site test | Breaks or checks nothing on another site | `any-site` lookups, or `*.blog.test.ts` |
| Reading source files as text to check them | Breaks on formatting, says nothing about behavior | Test what the code does; type checks belong to `tsc` |

`scripts/test-metrics/weak-patterns.mjs` and `site-names.mjs` count these.

## Files

- A test sits in a `__test__` folder beside what it tests, named after it (`lifecycle.ts` → `__test__/lifecycle.test.ts`), never after the task that
  added it (`m13-accessibility.test.ts`, `review-fixes.test.ts`).
- The suffix says the layer: `.test.ts` (L1), `.db.test.ts` (L2), `.test.tsx` and `.browser.test.tsx` (L3). Each layer is its own Vitest project, so
  one layer can run alone.
- Each package keeps its shared fixtures and render helpers in one `test` folder.

## Measuring and guarding

| What | How |
|---|---|
| Defects caught (mutation score) | StrykerJS: change the code a little at a time and count the changes a test fails on (`packages/core/stryker.score.config.mjs`) |
| What each test adds | StrykerJS with every test run per change (`stryker.config.mjs`): the changes only that test catches. Zero means another test already catches everything it does |
| Code no test runs | Vitest coverage, read as a map of gaps, not a score |
| Time | Vitest JSON reporter |
| Flaky and order-dependent tests | `scripts/test-metrics/repeat-runs.mjs`, plain and shuffled |
| Tests tied to how code is built | `scripts/test-metrics/test-churn.mjs`: refactor commits that had to change tests |
| Weak patterns | `scripts/test-metrics/weak-patterns.mjs`, `site-names.mjs` |

CI measures first and blocks later. Once a number is steady it becomes a gate, in this order: the forbidden patterns, then quarantine of flaky tests,
then a floor for the mutation score. "What each test adds" is used to find tests to delete, never as a gate.

## Not yet in place

- Vitest browser mode and `*.browser.test.tsx`.
- The L4 flows (`examples/blog/e2e`).
- One Vitest project per layer, and the `.db.test.ts` suffix.
- Automatic other-site selection outside core (admin, ai and seo keep lists).
- The CI gates.

Each is added when the package that needs it is moved to these rules.
