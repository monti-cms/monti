import { createSite, type Site } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import blog from "../../test/cms.config";
import otherSite from "../../test/other-site.config";
import { resolveAction } from "../action";
import { aiRegistryOf, aiSiteViewOf } from "../registry";
import { resolveAiActions } from "../resolve";

/** The site the browser builds: from the snapshot the server renders into the page (plugin options reach it as JSON, so their functions are absent). */
const browserSiteOf = (site: Site): Site => createSite(JSON.parse(JSON.stringify(site.snapshot())));

describe("AI registry of a site", () => {
	it("is built once per site, and two sites of different configs hold their own actions", () => {
		const first = createSite(blog);
		const second = createSite(otherSite);
		expect(aiRegistryOf(first)).toBe(aiRegistryOf(first));
		expect(aiRegistryOf(first)).not.toBe(aiRegistryOf(createSite(blog)));
		// The other site turns the media caption action off, so its action list differs from the blog's.
		expect(Object.keys(aiRegistryOf(second).actions)).not.toEqual(Object.keys(aiRegistryOf(first).actions));
		expect(aiRegistryOf(second).actionDefinition("imageCaption")).toBeUndefined();
		expect(aiRegistryOf(first).actionDefinition("imageCaption")).toBeDefined();
	});

	it("resolves the actions, the shared texts and the site description from the AI plugin options of that site", () => {
		const site = createSite(blog);
		const registry = aiRegistryOf(site);
		expect(registry.siteDescription).toBe("개인 기술 블로그");
		expect(registry.sharedKeys).toEqual(["styleGuide"]);
		expect(registry.shared.styleGuide?.label).toBe("문체 가이드");
		expect(registry.actionDefinition("slug")).toBe(registry.actions.slug);
		expect(registry.actionDefinition("toString")).toBeUndefined();
		expect(Object.keys(registry.actions)).toEqual(
			Object.keys(resolveAiActions({ shared: registry.shared }, aiSiteViewOf(site), site.plugins)),
		);
	});

	it("a site without the AI plugin has no actions and the default description", () => {
		const site = createSite({ ...blog, plugins: [] });
		const registry = aiRegistryOf(site);
		expect(registry.actions).toEqual({});
		expect(registry.sharedKeys).toEqual([]);
		expect(registry.siteDescription).toBe("website");
	});
});

describe("AI registry in the browser (site made from the JSON snapshot)", () => {
	it("keeps the data of the actions (names, attach points, inputs), and every action still resolves without the functions the snapshot drops", () => {
		const server = aiRegistryOf(createSite(blog));
		const browser = aiRegistryOf(browserSiteOf(createSite(blog)));
		// Plugins add their actions as functions (`contributes.ai.actions`), which the JSON snapshot does not carry: the browser has the default actions only.
		const contributed = ["seoTitle", "seoDescription", "diagramDraft", "diagramEdit", "chartDraft", "chartEdit"];
		expect(Object.keys(server.actions)).toEqual(expect.arrayContaining(contributed));
		for (const key of contributed) expect(browser.actionDefinition(key), key).toBeUndefined();
		expect(Object.keys(browser.actions)).toEqual(
			Object.keys(server.actions).filter((key) => !contributed.includes(key)),
		);
		for (const [key, mine] of Object.entries(browser.actions)) {
			const definition = server.actions[key];
			expect(mine.attach, key).toEqual(definition?.attach);
			expect(Object.keys(mine.input), key).toEqual(Object.keys(definition?.input ?? {}));
			expect(() => resolveAction(key, mine), key).not.toThrow();
		}
		expect(browser.sharedKeys).toEqual(server.sharedKeys);
		expect(browser.siteDescription).toBe(server.siteDescription);
	});

	it("an action the config turns off stays off, and an action a config function defines falls back to the preset the browser knows", () => {
		const server = aiRegistryOf(createSite(otherSite));
		const browser = aiRegistryOf(browserSiteOf(createSite(otherSite)));
		expect(browser.actionDefinition("imageCaption")).toBeUndefined();
		// `aiPresets.summary({ maxLength: 200 })` is a function: the server limits the length to 200, the browser has the default preset (its attach points are the same).
		expect(server.actions.summary?.checks).toEqual([{ kind: "maxLength", max: 200 }]);
		expect(browser.actions.summary?.attach).toEqual(server.actions.summary?.attach);
	});
});
