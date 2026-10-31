import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { adminFetch } from "../../../api/client";
import { fakeApi } from "../../../test/fake-api";
import { isSandboxSite } from "../../shared/preview-sandbox";
import { draftSiteOf } from "../draft-site";
import type { Obj } from "../schema-model";

const draft = (extraFields: Obj = {}): Obj => ({
	collections: {
		page: {
			label: "Page",
			kind: "document",
			fields: { title: { kind: "text", label: "Title", required: true }, ...extraFields },
		},
	},
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en",
});

afterEach(() => vi.unstubAllGlobals());

describe("draft site", () => {
	it("SCHEMA-F16 is a site made from the draft: its collections are the draft's, not the saved ones", () => {
		const site = draftSiteOf(testSite, draft({ intro: { kind: "text", label: "Intro" } }), []);
		expect(site?.isCollection("page")).toBe(true);
		expect(Object.keys(site?.schemaOf("page").fields ?? {})).toEqual(["title", "intro"]);
		expect(site?.isCollection("not-in-the-draft")).toBe(false);
	});

	it("SCHEMA-F9 is nothing while the draft is not a valid schema", () => {
		expect(draftSiteOf(testSite, draft({ bad: { kind: "nope" } }), [])).toBeNull();
	});

	it("SCHEMA-F16 refuses to write, but reads", async () => {
		const api = fakeApi()
			.on("GET /v1/entries", () => ({ items: [], total: 0 }))
			.on("POST /v1/references/unlink", () => ({ entries: 0 }))
			.on("PATCH /v1/media/:id", () => undefined)
			.install();
		const site = draftSiteOf(testSite, draft(), []);
		if (site === null) throw new Error("a valid draft makes a site");
		expect(isSandboxSite(site)).toBe(true);
		await expect(adminFetch(site, "/v1/references/unlink", { method: "POST", json: {} })).rejects.toMatchObject({
			code: "preview",
		});
		await expect(adminFetch(site, "/v1/media/m1", { method: "PATCH", json: {} })).rejects.toMatchObject({
			code: "preview",
		});
		expect(api.requests).toHaveLength(0);
		await expect(adminFetch(site, "/v1/entries?collection=page")).resolves.toEqual({ items: [], total: 0 });
		// The running site is not affected.
		await expect(adminFetch(testSite, "/v1/references/unlink", { method: "POST", json: {} })).resolves.toEqual({
			entries: 0,
		});
	});
});
