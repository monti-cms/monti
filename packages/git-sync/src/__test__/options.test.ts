import { createSite } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import config from "../../test/cms.config";
import { gitSync } from "../index";
import {
	type GitSyncOptions,
	type GitSyncTarget,
	resolveTarget,
	resolveTargets,
	validateGitSyncConfig,
} from "../options";

const target = (overrides: Partial<GitSyncTarget> = {}): GitSyncTarget => ({
	repo: "acme/site",
	collections: ["post"],
	...overrides,
});

const view = (collections = config.collections, locales = config.locales) =>
	({ collections, locales, defaultLocale: "en", blocks: [], blockDefinitions: [], plugins: [] }) as never;

describe("a target's defaults", () => {
	it("is a commit to main of the whole repo, in mdx, with a path that carries collection, slug and language", () => {
		expect(resolveTarget(target(), 0)).toEqual({
			id: "acme-site",
			repo: "acme/site",
			branch: "main",
			folder: "",
			format: "mdx",
			path: "{collection}/{slug}.{locale}.{ext}",
			collections: ["post"],
			mode: "commit",
			prBranch: "monti/publish",
		});
	});

	it("takes the folder, trimmed, into the default id so two folders of one repo are two targets", () => {
		const resolved = resolveTargets({ targets: [target({ folder: "/content/" }), target({ folder: "docs" })] });
		expect(resolved.map((item) => [item.id, item.folder])).toEqual([
			["acme-site-content", "content"],
			["acme-site-docs", "docs"],
		]);
	});

	it("keeps what the target says", () => {
		const resolved = resolveTarget(
			target({
				id: "main-site",
				branch: "live",
				format: "markdown",
				mode: "pr",
				prBranch: "bot/content",
				apiUrl: "https://git.example.com/api/v3",
			}),
			0,
		);
		expect(resolved).toMatchObject({
			id: "main-site",
			branch: "live",
			format: "markdown",
			mode: "pr",
			prBranch: "bot/content",
			apiUrl: "https://git.example.com/api/v3",
		});
	});
});

describe("gitSync() with no arguments", () => {
	it("registers the plugin with no targets: it is valid and syncs nothing until a repo is listed", () => {
		const plugin = gitSync();
		expect(plugin.name).toBe("git-sync");
		expect(resolveTargets(plugin.options)).toEqual([]);
		expect(() => validateGitSyncConfig(plugin.options, view())).not.toThrow();
		expect(plugin.admin).toBeTypeOf("function");
	});
});

describe("a target that cannot work is refused when the config is read", () => {
	it.each([
		[{ repo: "not-a-repo" }, /"owner\/name"/],
		[{ collections: [] }, /at least one collection/],
		[{ id: "Bad Id" }, /lowercase letters/],
		[{ folder: "../outside" }, /"\.\." segments/],
		[{ path: "/absolute/{slug}" }, /relative file path/],
		[{ path: "{collection}/{title}.mdx" }, /unknown placeholder \{title\}/],
		[{ path: "{collection}/fixed.mdx" }, /must contain \{slug\} or \{id\}/],
		[{ mode: "merge" as never }, /"commit" or "pr"/],
		[{ mode: "pr" as const, prBranch: "main" }, /must differ from `branch`/],
	] as const)("%j", (overrides, message) => {
		expect(() => resolveTarget(target(overrides as Partial<GitSyncTarget>), 0)).toThrow(message);
	});

	it("names the target in the message and refuses two with one id", () => {
		expect(() => resolveTarget(target({ repo: "bad" }), 2)).toThrow(/target #3 \(bad\)/);
		expect(() => resolveTargets({ targets: [target(), target()] })).toThrow(/share the id "acme-site"/);
		expect(() => resolveTargets({ targets: [target()], debounceMs: -1 })).toThrow(/debounceMs/);
	});
});

describe("checks against the site", () => {
	const check = (options: GitSyncOptions, collections = config.collections, locales = config.locales) =>
		validateGitSyncConfig(options, view(collections, locales));

	it("accepts a target over the site's collections", () => {
		expect(() => check({ targets: [target({ collections: ["post", "memo", "tag"] })] })).not.toThrow();
	});

	it("names a collection the site does not have", () => {
		expect(() => check({ targets: [target({ collections: ["nope"] })] })).toThrow(/there is no collection "nope"/);
	});

	it("needs {collection} for several collections and {locale} for several languages", () => {
		expect(() =>
			check({ targets: [target({ collections: ["post", "memo"], path: "{slug}.{locale}.{ext}" })] }),
		).toThrow(/needs \{collection\}/);
		expect(() => check({ targets: [target({ path: "{collection}/{slug}.{ext}" })] })).toThrow(/needs \{locale\}/);
		// One language needs no placeholder for it.
		expect(() =>
			check({ targets: [target({ path: "{collection}/{slug}.{ext}" })] }, config.collections, [
				config.locales[0] as never,
			]),
		).not.toThrow();
		// The entry id tells entries apart by itself.
		expect(() => check({ targets: [target({ collections: ["post", "memo"], path: "{id}.{ext}" })] })).not.toThrow();
	});

	it("refuses a field with the name of a front matter key git-sync writes itself", () => {
		const clash = {
			...config.collections,
			post: {
				...config.collections.post,
				fields: { ...config.collections.post.fields, date: { kind: "text", label: "Date" } },
			},
		};
		expect(() => check({ targets: [target()] }, clash as never)).toThrow(/field "date" of collection "post"/);
		// The slug field is the address, not a stored field, so its name is free.
		expect(() => check({ targets: [target()] })).not.toThrow();
	});

	it("checks nothing when switched off", () => {
		expect(() => check({ enabled: false, targets: [target({ collections: ["nope"] })] })).not.toThrow();
	});
});

describe("the plugin", () => {
	it("registers a screen, a sidebar item, server hooks and routes", () => {
		const plugin = gitSync({ targets: [target()] });
		expect(plugin.name).toBe("git-sync");
		expect(plugin.nav).toEqual([{ path: "git-sync", label: "Git sync", icon: "git-branch" }]);
		expect(plugin.server).toBeTypeOf("function");
		expect(plugin.admin).toBeTypeOf("function");
	});

	it("registers nothing when `enabled` is false", () => {
		const plugin = gitSync({ enabled: false, targets: [target()] });
		expect(plugin.nav).toBeUndefined();
		expect(plugin.server).toBeUndefined();
		expect(plugin.admin).toBeUndefined();
	});

	it("loads its server side, which has the webhook as a public route, the outbox subscriber and the commands", async () => {
		const server = (await gitSync({ targets: [target()] }).server?.())?.default;
		expect(server?.hooks?.afterCommit).toBeTypeOf("function");
		expect(Object.keys(server?.commands ?? {}).sort()).toEqual(["flush", "pull", "push"]);
		const routes = server?.routes ?? [];
		expect(routes.filter((route) => route.public).map((route) => route.pattern)).toEqual(["v1/git-sync/webhook"]);
		expect(routes.map((route) => route.pattern)).toContain("v1/git-sync/conflicts/resolve");
	});

	it("is read from the site config by name, without its client factory reaching the browser", () => {
		const site = createSite({
			...config,
			plugins: [gitSync({ targets: [target()], client: (() => undefined) as never })],
		});
		expect(site.getPluginOptions("git-sync")).toMatchObject({ targets: [{ repo: "acme/site" }] });
		const snapshot = site.snapshot().plugins?.find((plugin) => plugin.name === "git-sync");
		expect(JSON.stringify(snapshot)).not.toContain("client");
	});
});
