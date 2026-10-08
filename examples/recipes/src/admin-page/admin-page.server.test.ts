import { defineConfig } from "@monti-cms/core/server";
import { testServer } from "@monti-cms/core/testing";
import { mdx } from "@monti-cms/mdx";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema } from "../site";
import { postStats } from "./index";

const test = testServer();
const cms = defineConfig({
	schema,
	site: { url: "https://blog.example" },
	plugins: [mdx(), postStats()],
	...test.server,
});

beforeAll(async () => {
	await cms.migrate();
	const service = cms.contentService();
	for (const slug of ["a", "b", "c"]) {
		const draft = await service.createDraft({
			collection: "post",
			slug,
			metadata: { title: slug },
			body: "Body.",
			format: "mdx",
		});
		if (slug !== "c") await service.publish({ id: draft.id, expectedVersion: draft.version });
	}
});
afterAll(async () => {
	await cms.close();
	await test.drop();
});

describe("an admin page of a plugin (the API)", () => {
	it("is served under the CMS API path, for an admin", async () => {
		const response = await cms.handle(new Request("https://blog.example/api/cms/v1/post-stats/summary"));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ published: 2, draft: 1 });
	});

	it("is refused without a login, because the core wraps every plugin route with the check", async () => {
		const signedOut = defineConfig({
			schema,
			plugins: [postStats()],
			database: test.server.database,
			auth: {
				...test.server.auth,
				create: (context) => ({ ...test.server.auth.create(context), session: async () => null }),
			},
		});
		const response = await signedOut.handle(new Request("https://blog.example/api/cms/v1/post-stats/summary"));
		expect(response.status).toBe(401);
	});
});
