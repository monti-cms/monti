import { describe, expect, it, vi } from "vitest";

// Reading the site config fails. `postgres()` and creating the store alone must not read it.
vi.mock("../../../config/resolved", () => {
	throw new Error("site config was loaded");
});

describe("postgres() lazy loading", () => {
	it("does not load the store module or site config when creating the adapter and getting the store", async () => {
		const { postgres } = await import("../adapter");
		const adapter = postgres({ connectionString: "postgres://localhost/none" });
		const store = adapter.createStore();
		expect(typeof store.getEntry).toBe("function");
		// The store module loads the moment a function is called (here config is blocked, so it fails).
		await expect(store.getEntry("x")).rejects.toThrow(/site config was loaded|error when mocking/);
		await adapter.close?.();
	});

	it("does not load the site config for the login and file storage adapters used by the server config either", async () => {
		const { githubAuth } = await import("../../auth/github");
		const { r2Storage } = await import("../../../storage/s3");
		const auth = githubAuth({ clientId: "id", clientSecret: "secret", adminIds: ["1"] }).create({
			loginPath: "/admin/login",
			trustHost: false,
		});
		expect(auth.providers?.[0]?.label).toBeTruthy();
		expect(() =>
			r2Storage({
				accessKeyId: "a",
				secretAccessKey: "b",
				bucket: "c",
				endpoint: "https://example.com",
				publicBaseUrl: "https://cdn.example.com",
			}),
		).not.toThrow();
	});
});
