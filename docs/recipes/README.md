# Extension recipes

English | [한국어](README.ko.md)

Short pages on how to extend Monti. Each one says what you need to know and shows the code, built on the public APIs. The code on each page is a file under [`src/`](src/) (the private `@monti-cms/recipes` package): CI type checks it against the current packages, and `pnpm check:recipes` fails when a page differs from its file (`pnpm check:recipes --write` copies the files into the pages).

The principle behind them: open what users touch, seal what core must guard behind interfaces. The write pipeline, storage and migrations are only reached through events (`on`) and plugins, so every recipe below is a plugin or a hook, and none of them changes core.

| Recipe | You get | Surface it uses |
| --- | --- | --- |
| [Send a Slack message when a post is published](slack-on-publish.md) | one message per publish, retried when Slack is down | `entry.published` (with `cms`), `event.once`, the event outbox, a plugin's server module, typed options |
| [Add your own block](custom-block.md) | a `notice` block: definition, check, editor view, public component | `defineBlock` (`validate`), `blockViews`, `defineRender` |
| [A custom admin field screen](reading-time-field.md) | "3 min read", computed from the body as it is typed | view field, `fieldViews` of `defineAdminPlugin` |
| [Enforce a slug rule before save](slug-rule.md) | lowercase ASCII slugs, refused or fixed, with a clear error | `entry.beforeValidate` and `entry.beforeSave`, a plugin's server module |
| [Write a custom format](custom-format.md) | Markdown in and out, and a one-way text export | `defineFormat`, `formats` of a plugin |
| [Read posts on the public site, typed](read-posts.md) | list, single post, tags, redirects; types from the config | `cms.read`, `Cms<typeof config>` |
| [Add an admin page to a plugin](admin-page.md) | a "Post stats" Tools page with its own API route | `nav`, `server.routes`, `defineAdminPlugin({ pages })` |
| [Strict 404 and 308 under Cache Components](strict-status.md) | a real 404 and 308 from a small `proxy.ts`, when you need them | `cms.read.getEntry`, Next `proxy.ts` |
| [Fill in alt text when an image goes in](image-alt.md) | an image's alt text from its file name, as it is inserted, never over what you typed | `on.editor.imageInserted`, `fill`, `defineAdminPlugin({ on })` |
