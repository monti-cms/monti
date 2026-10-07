import { describe, expect, it, vi } from "vitest";
import { testSite } from "../../../../test/site";

// Loading the store module (SQL, MDX parsing, the rules that read the site) fails. `postgres()` and creating the store alone must not load it.
vi.mock("../content-store", () => {
	throw new Error("store module was loaded");
});

describe("postgres() lazy loading", () => {
	it("does not load the store module when creating the adapter and getting the store", async () => {
		const { postgres } = await import("../adapter");
		const adapter = postgres({ connectionString: "postgres://localhost/none" });
		const store = adapter.createStore({ site: testSite });
		expect(typeof store.getEntry).toBe("function");
		// The store module loads the moment a function is called (here it is blocked, so it fails).
		await expect(store.getEntry("x")).rejects.toThrow(/store module was loaded|error when mocking/);
		await adapter.close?.();
	});

	it("does not load the store module for the file storage adapter used by the server config either", async () => {
		const { r2Storage } = await import("../../../storage/s3");
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
