// @vitest-environment node

import { auth } from "@monti-cms/auth";
import { github } from "@monti-cms/auth/github";
import { defineCollection, fields } from "@monti-cms/core";
import { defineConfig, postgres } from "@monti-cms/core/server";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
	seedEntry,
} from "@monti-cms/core/testing";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { previewEntry } from "..";

/** The headers of the request Next is handling: a request from this machine, or one that is not. */
let requestHeaders: Headers | null = new Headers({ host: "localhost:3000", "x-forwarded-for": "::1" });
vi.mock("next/headers", () => ({
	headers: async () => {
		if (!requestHeaders) throw new Error("outside a request");
		return requestHeaders;
	},
}));

const post = defineCollection({
	label: "Post",
	kind: "document",
	path: "/posts/:slug",
	fields: { title: fields.text({ label: "Title" }), slug: fields.slug({ label: "Slug", from: "title" }) },
});
const site = { collections: { post }, locales: [{ code: "en", name: "English" }], defaultLocale: "en" } as const;

describe("previewEntry: the draft for the site's preview page", () => {
	let schemaName: string;
	let dropPool: () => Promise<void>;
	let draftSlug: string;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		schemaName = isolated.schemaName;
		dropPool = () => dropIsolatedTestPool(isolated.pool, schemaName);
		const seedSite = defineConfig({
			...site,
			database: postgres({ schema: schemaName }),
			auth: auth({ providers: [github()] }),
			secret: "s",
		}).site;
		await migrateContentStore(isolated.pool, { site: seedSite, schema: schemaName });
		const store = createContentStore(isolated.pool, { site: seedSite, schema: schemaName });
		draftSlug = "unpublished-draft";
		await seedEntry(store, {
			collection: "post",
			slug: draftSlug,
			metadata: { title: "Only a draft", slug: draftSlug },
			text: "Draft body",
		});
	});
	afterEach(() => vi.unstubAllEnvs());
	afterAll(async () => {
		await dropPool();
		await closeGlobalPool();
	});

	/** A fresh instance, as after a cold start: nothing has been served yet, so nothing has attached the host. */
	const freshInstance = () => {
		vi.stubEnv("DATABASE_URL", process.env.CMS_TEST_DATABASE_URL ?? "");
		vi.stubEnv("AUTH_GITHUB_ID", "id");
		vi.stubEnv("AUTH_GITHUB_SECRET", "secret");
		vi.stubEnv("MONTI_SECRET", "a-long-test-secret-for-the-preview-test");
		return defineConfig({ ...site, database: postgres({ schema: schemaName }), auth: auth({ providers: [github()] }) });
	};

	it("returns the draft as the very first call on a fresh instance, logged in by the dev bypass", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		requestHeaders = new Headers({ host: "localhost:3000", "x-forwarded-for": "::1" });
		const cms = freshInstance();
		try {
			const entry = await previewEntry(cms, { collection: "post", slug: draftSlug });
			expect(entry?.slug).toBe(draftSlug);
			expect(entry?.title).toBe("Only a draft");
		} finally {
			await cms.close();
		}
	});

	it("without the helper the same first call cannot see the session, which is what the helper is for", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const cms = freshInstance();
		try {
			expect(await cms.read.getPreview({ collection: "post", slug: draftSlug })).toBeNull();
		} finally {
			await cms.close();
		}
	});

	it("returns nothing for a visitor who is not the admin", async () => {
		vi.stubEnv("NODE_ENV", "production");
		requestHeaders = new Headers({ host: "example.com" });
		const cms = freshInstance();
		try {
			expect(await previewEntry(cms, { collection: "post", slug: draftSlug })).toBeNull();
		} finally {
			await cms.close();
		}
	});
});
