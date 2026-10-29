# Test suite baseline, October 2026

The numbers the test suite overhaul starts from. After the overhaul the same scripts measure the suite again, and the result is compared with
this page. The code measured is `overhaul` at 9053b8c2 with the trash restore fix (b31777ab), because the old trash behavior failed the
one-worker run below. Core is listed apart because the overhaul starts with it.

## Summary

| Metric | What it shows | All packages | Core | Better is |
|---|---|---|---|---|
| Tests and time | How long one run takes | 6,996 tests, 155 s | 3,515 tests, 89 s | Less time. The number of tests is not a goal |
| Coverage (lines / branches / functions) | Code a test ran at least once | 88.5 / 76.3 / 84.4% | 94.7 / 84.0 / 94.0% | Not lower |
| Mutation score | Share of small code changes a test fails on | Measured per package, when its turn comes | 68.8% (23,920 / 34,747) | Higher |
| Surviving mutants | Changes in code a test ran, that no test noticed | — | 7,452 | Fewer |
| Weak patterns (14 kinds) | `toBeTruthy`, CSS selectors, copy written in the test, … | 1,785 | 169 | Close to 0 |
| Reference blog names in shared-site tests | A blog-only collection, field, block or locale written as a string | 847 uses | 103 uses in 37 files | 0 |
| Files whose tests depend on order | A test reads what an earlier test in the file left | 20 | 18 | 0 |
| Flaky tests | A different result on the same code over 21 runs | 0 | 0 | 0, over more runs |
| Refactor commits that changed tests | Commits that say they keep behavior, yet changed a test | 61% (51 of 84) | 51% (20 of 39) | Lower, measured on the commits after the overhaul |

Zero flaky tests over 21 runs means the chance of a failure per run is at most 13% (95% one-sided: 1 − 0.05^(1/21)). CI saw an editor timer error
outside any test once in 50 runs; it did not show up locally.

## How each number is measured

All scripts are in `scripts/test-metrics/`; each one explains its options at the top.

- **Tests and time**: one full run with the Vitest JSON reporter, files sorted by kind (render, database, CLI, plain logic).
- **Coverage**: `@vitest/coverage-v8` over `packages/*/src`, without tests, stories and test helpers.
- **Mutation score**: `core-mutation-score.mjs`, which runs `packages/core/stryker.score.config.mjs` one `src` folder at a time. The run took 2 h
  15 min on an M-series MacBook. This config stops each mutant at the first test that fails and leaves out mutants of module-level code (2,492),
  so it scores lower than the full config (`plugin-storage.ts`: 73% here, 83% with `stryker.config.mjs`). Compare its scores only with scores of
  the same config.
- **Weak patterns**: `weak-patterns.mjs`.
- **Reference blog names**: `site-names.mjs`.
- **Flaky tests and order**: `repeat-runs.mjs`: 10 runs as CI runs them, 10 with `--shuffle`, 1 with `--one-worker`. Shuffling the files only
  passed 3 of 3; shuffling the tests inside each file failed 3 of 3.
- **Refactor commits**: `test-churn.mjs --pr-commits`, which counts the commits inside each pull request, not the squashed ones.

## Core in detail

### Weak patterns

| Pattern | Count |
|---|---|
| `toBeDefined` | 64 |
| Korean copy written in the test | 25 |
| Mock call arguments read by position | 20 |
| Source file read as text | 20 |
| `toBeTruthy` | 11 |
| Fixed sleep | 8 |
| CSS class check | 8 |
| Early return that reports a pass | 3 |
| Wait of a second or more | 3 |
| Data attribute | 3 |
| Mock of the package's own module | 3 |
| Regex that accepts Korean or English | 1 |

### Mutation score per folder

Caught = killed or timed out. Survived = a test ran the code and none failed. No coverage = no test ran the code.

| Folder | Score | Caught / valid | Survived | No coverage |
|---|---|---|---|---|
| schema-change | 84.4% | 1,211 / 1,435 | 65 | 159 |
| secrets | 82.6% | 76 / 92 | 15 | 1 |
| adapters | 81.0% | 5,188 / 6,405 | 893 | 324 |
| api-keys | 80.8% | 261 / 323 | 46 | 16 |
| plugin | 80.0% | 244 / 305 | 43 | 18 |
| schema-file | 76.6% | 741 / 967 | 116 | 110 |
| cms | 74.9% | 278 / 371 | 66 | 27 |
| i18n | 74.6% | 53 / 71 | 15 | 3 |
| server | 73.7% | 42 / 57 | 12 | 3 |
| schema | 72.6% | 748 / 1,030 | 234 | 48 |
| config | 70.6% | 616 / 872 | 195 | 61 |
| core | 68.3% | 3,416 / 5,000 | 1,314 | 270 |
| services | 67.7% | 2,181 / 3,221 | 733 | 307 |
| operations | 66.3% | 108 / 163 | 29 | 26 |
| schema-edit | 64.4% | 421 / 654 | 99 | 134 |
| doc | 63.4% | 972 / 1,534 | 377 | 185 |
| cli | 62.8% | 3,531 / 5,623 | 1,534 | 558 |
| format | 62.7% | 106 / 169 | 62 | 1 |
| blocks | 62.5% | 215 / 344 | 93 | 36 |
| http | 61.6% | 1,400 / 2,272 | 599 | 273 |
| render | 60.7% | 686 / 1,131 | 265 | 180 |
| annotation | 59.0% | 912 / 1,545 | 251 | 382 |
| read | 58.7% | 203 / 346 | 94 | 49 |
| site | 55.0% | 33 / 60 | 18 | 9 |
| text-check | 47.2% | 128 / 271 | 64 | 79 |
| media | 31.9% | 129 / 405 | 190 | 86 |
| `src/*.ts` | 25.9% | 21 / 81 | 30 | 30 |
| **All of core** | **68.8%** | **23,920 / 34,747** | **7,452** | **3,375** |

## Not measured here

- The mutation score of the other packages: each is measured before its own overhaul.
- Visual regression: a later, separate phase.
- The raw reports: the mutant-by-mutant reports stay out of git (`**/reports/mutation`), and the raw runs behind the other numbers were lost to
  a restart. The numbers on this page are what is kept.
