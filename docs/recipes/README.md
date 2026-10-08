# Extension recipes

English | [한국어](README.ko.md)

Small, working examples of how to extend Monti. Each recipe was written from the public docs alone, the way a developer new to the codebase would, then kept as tested code in [`examples/recipes`](../../examples/recipes). The page of a recipe lists what you need to know, shows the code (always the code of the tested file: `pnpm recipes:check` fails when they differ) and says what was awkward while writing it.

The principle behind them: open what users touch, seal what core must guard behind interfaces. The write pipeline, storage and migrations are only reached through hooks, events and plugins, so every recipe below is a plugin or a hook, and none of them changes core.

| Recipe | You get | Surface it uses |
| --- | --- | --- |
| [Send a Slack message when a post is published](slack-on-publish.md) | one message per publish, retried when Slack is down | `afterCommit` of a plugin, the event outbox, plugin storage |
| [Add your own block](custom-block.md) | a `notice` block: definition, check, editor view, public component | `defineBlock` (`validate`), `blockViews`, `documentComponents` |
| [A custom admin field screen](reading-time-field.md) | "3 min read", computed from the body as it is typed | view field, `fieldViews`, `@monti-cms/admin` provider |
| [Enforce a slug rule before save](slug-rule.md) | lowercase ASCII slugs, refused or fixed, with a clear error | write hooks `validate` and `transform` |
| [Write a custom format](custom-format.md) | Markdown in and out, and a one-way text export | `defineFormat`, `formats` of a plugin |
| [Read posts on the public site, typed](read-posts.md) | list, single post, tags, redirects; types from the config | `cms.read`, `Cms<typeof config>` |
| [Add an admin page to a plugin](admin-page.md) | a "Post stats" screen with its own API route | `nav`, `server.routes`, `defineAdminPlugin({ pages })` |
| [Add a `monti doctor` check from a plugin](doctor-check.md) | checks with where and how to fix, under the plugin's name | `server.checks` |

## How much each one takes

Counted on the first working version, from the docs only. A **concept** is a named idea or API the recipe needs that you did not know before (the "What you need to know" list on each page). **Source reads** are the places where the docs were not enough and the source (or another package's source) had to be read; the second number is what remains after the fixes of this change, with the README sections it added.

| Recipe | Concepts | Files | Code lines | Test lines | Source reads | After the fixes |
| --- | --- | --- | --- | --- | --- | --- |
| Slack message on publish | 5 | 1 | 34 | 67 | 3 | 0 |
| Your own block | 5 | 6 | 92 | 122 | 4 | 1 |
| Custom admin field screen | 4 | 5 | 30 | 57 | 4 | 0 |
| Slug rule | 5 | 1 | 20 | 57 | 4 | 0 |
| Custom format | 5 | 2 | 167 | 66 | 4 | 0 |
| Read posts, typed | 5 | 2 | 46 | 88 | 5 | 0 |
| Admin page of a plugin | 4 | 4 | 63 | 98 | 4 | 0 |
| `monti doctor` check | 5 | 3 | 37 | 90 | 1 | 0 |

Code lines are the lines of the recipe's own files that are not blank or comments (the tests are counted apart). Files are the recipe's source files (a block or a screen needs a definition, a plugin, an admin side and a view; a hook needs one). The one source read left is the editor-view test of the block, whose browser setup (the jsdom range shims and the editor extensions) is shown only in that recipe.

## Running them

```sh
pnpm --filter @monti-cms/example-recipes test:run   # needs CMS_TEST_DATABASE_URL, like the other tests
pnpm --filter @monti-cms/example-recipes typecheck  # also compiles the type tests
pnpm recipes:check                                  # the pages show the code of the files
```
