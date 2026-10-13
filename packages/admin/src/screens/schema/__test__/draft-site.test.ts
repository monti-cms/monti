import { afterEach, describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { cmsFetch } from "../../../api/client";
import { isSandboxSite } from "../../shared/preview-sandbox";
import { draftSiteOf } from "../draft-site";
import type { Obj } from "../schema-model";

const draft = (extraFields: Obj = {}): Obj => ({
	schemaVersion: 1,
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
	it("is a site made from the draft: its collections are the draft's, not the saved ones", () => {
		const site = draftSiteOf(testSite, draft({ intro: { kind: "text", label: "Intro" } }), []);
		expect(site?.isCollection("page")).toBe(true);
		expect(Object.keys(site?.schemaOf("page").fields ?? {})).toEqual(["title", "intro"]);
		expect(site?.isCollection("not-in-the-draft")).toBe(false);
	});

	it("is nothing while the draft is not a valid schema", () => {
		expect(draftSiteOf(testSite, draft({ bad: { kind: "nope" } }), [])).toBeNull();
	});

	it("refuses to write, but reads", async () => {
		const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [] }) }));
		vi.stubGlobal("fetch", fetchMock);
		const site = draftSiteOf(testSite, draft(), []);
		expect(site && isSandboxSite(site)).toBe(true);
		if (!site) return;
		await expect(cmsFetch(site, "/api/x", { method: "POST", json: {} })).rejects.toMatchObject({ code: "preview" });
		await expect(cmsFetch(site, "/api/x", { method: "PATCH", json: {} })).rejects.toMatchObject({ code: "preview" });
		expect(fetchMock).not.toHaveBeenCalled();
		await expect(cmsFetch(site, "/api/x")).resolves.toEqual({ items: [] });
		// The running site is not affected.
		await expect(cmsFetch(testSite, "/api/x", { method: "POST", json: {} })).resolves.toBeTruthy();
	});
});
