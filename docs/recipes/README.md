# Extension recipes

English | [한국어](README.ko.md)

Short pages on how to extend Monti. Each one says what you need to know and shows a small sketch built on the public APIs. The snippets are illustrations to adapt, not tested or shipped code.

The principle behind them: open what users touch, seal what core must guard behind interfaces. The write pipeline, storage and migrations are only reached through hooks, events and plugins, so every recipe below is a plugin or a hook, and none of them changes core.

| Recipe | You get | Surface it uses |
| --- | --- | --- |
| [Send a Slack message when a post is published](slack-on-publish.md) | one message per publish, retried when Slack is down | `afterCommit` (with `cms`), `event.once`, the event outbox, a plugin's lazy `server` hooks |
| [Add your own block](custom-block.md) | a `notice` block: definition, check, editor view, public component | `defineBlock` (`validate`), `blockViews`, `documentComponents` |
| [A custom admin field screen](reading-time-field.md) | "3 min read", computed from the body as it is typed | view field, `fieldViews`, `@monti-cms/admin` provider |
| [Enforce a slug rule before save](slug-rule.md) | lowercase ASCII slugs, refused or fixed, with a clear error | write hooks `validate` and `transform`, inline plugin `hooks` |
| [Write a custom format](custom-format.md) | Markdown in and out, and a one-way text export | `defineFormat`, `formats` of a plugin |
| [Read posts on the public site, typed](read-posts.md) | list, single post, tags, redirects; types from the config | `cms.read`, `Cms<typeof config>` |
| [Add an admin page to a plugin](admin-page.md) | a "Post stats" screen with its own API route | `nav`, `server.routes`, `defineAdminPlugin({ pages })` |
| [Strict 404 and 308 under Cache Components](strict-status.md) | a real 404 and 308 from a small `proxy.ts`, when you need them | `cms.read.getEntry`, Next `proxy.ts` |
