# Add a `monti doctor` check from a plugin

Goal: `monti doctor` reports whether every published post has a summary, and whether the site URL is set, under the plugin's name, with where the problem is and how to fix it.

Code: [`examples/recipes/src/doctor-check`](../../examples/recipes/src/doctor-check). Test: `doctor-check.test.ts` (the checks in process, and the real `monti doctor` command against a project folder).

## What you need to know

1. **A check** is `{ id, title, online?, run(context) }`. `run` returns `ok(message)`, `warn(message, { where, fix })`, `fail(message, { where, fix })` or `skip(message)` (`@monti-cms/core`) ("Checks for `monti doctor`" in the [core README](../../packages/core/README.md)).
2. **The context** has the instance (`cms`: the plugin's storage, secrets, the site and the content), the folder (`cwd`), the environment (`env`, the shell's plus the env files `doctor` read) and `online`.
3. **Checks that call out over the network** set `online: true` and run only with `monti doctor --online`.
4. **They are listed as `<plugin name>/<id>`** and `--only content-health` runs just them. A check that throws is a failure with the error's message; one that runs longer than 30 seconds is too.
5. **Write `where` and `fix` as you would tell a person**: the file, variable or screen, and the exact next step.

## The code

<!-- source: examples/recipes/src/doctor-check/checks.ts -->
```ts
import { type DoctorCheck, ok, warn } from "@monti-cms/core";

/**
 * Checks for `monti doctor`, listed under the plugin's name (`content-health/summaries`). A check says what it found, and for a warning where it is and how
 * to fix it, in words a person can follow: the file, variable or screen, and the exact next step.
 */
export const contentHealthChecks: readonly DoctorCheck[] = [
	{
		id: "summaries",
		title: "Published posts have a summary",
		// The context holds the app's instance (`cms`), the folder (`cwd`), the environment (`env`) and `online`.
		run: async ({ cms }) => {
			const { items, total } = await cms.read.listEntries({ collection: "post", pageSize: 100 });
			const without = items.filter((post) => !String(post.metadata.summary ?? "").trim());
			if (without.length === 0) return ok(`all ${total} published posts have a summary`);
			return warn(
				`${without.length} of ${total} published posts have no summary: ${without.map((post) => post.slug).join(", ")}`,
				{
					where: `the Summary field of each post (${cms.site.adminHref("/")}?collection=post)`,
					fix: "write a summary, or set `fillFromBody: true` on the summary field in monti.schema.json so publishing fills it from the body",
				},
			);
		},
	},
	{
		id: "site-url",
		title: "The site URL is set",
		run: ({ cms, env }) =>
			cms.site.config.site?.url || env.SITE_URL
				? ok("the site URL is set")
				: warn("the site URL is not set, so links in feeds and notifications are relative", {
						where: "SITE_URL in .env.local, or `site.url` in monti.schema.json",
						fix: "set SITE_URL=https://your-site.example",
					}),
	},
];
```

<!-- source: examples/recipes/src/doctor-check/server.ts -->
```ts
import type { CmsServerPlugin } from "@monti-cms/core";
import { contentHealthChecks } from "./checks";

/** The server side of the plugin: what `monti doctor` runs for it. It could hold `routes`, `hooks`, `commands` and `migrate` as well. */
const server: CmsServerPlugin = { checks: contentHealthChecks };

export default server;
```

<!-- source: examples/recipes/src/doctor-check/index.ts -->
```ts
import { definePlugin } from "@monti-cms/core";

/** `plugins: [contentHealth()]`: `monti doctor` then lists `content-health/summaries` and `content-health/site-url` after the checks of core. */
export const contentHealth = () =>
	definePlugin({ name: "content-health", options: {}, server: () => import("./server") });
```

In `monti.config.ts`: `plugins: [contentHealth()]`. Then:

```text
$ pnpm exec monti doctor --only content-health
  warn  content-health/summaries  1 of 2 published posts have no summary: no-summary
                                  where: the Summary field of each post (/studio?collection=post)
                                  fix:   write a summary, or set `fillFromBody: true` ...
  warn  content-health/site-url   the site URL is not set, so links in feeds and notifications are relative
                                  where: SITE_URL in .env.local, or `site.url` in monti.schema.json
                                  fix:   set SITE_URL=https://your-site.example
```

## Testing it

Unit: call `run` with a real instance (`testServer()`), as the first two tests do. End to end: the third test writes a `monti.config.ts` next to the recipe and runs `runDoctorCommand` of `@monti-cms/core/cli` on it, which is exactly what `monti doctor --json` does. Warnings do not change the exit code; a `fail` does (the test checks `0`).

## Found while writing it

- This was the best documented of the eight: the README section was enough. The only source read was for `runDoctorCommand`, to run the real command in a test. It is named in the entry points table now.
