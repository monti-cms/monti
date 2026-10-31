import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CmsError } from "../../core/store/errors";
import type { PluginStorage } from "../storage";

/**
 * The contract of plugin storage (`PluginStorage`), run against every implementation: the Postgres adapter's and the in-memory one's.
 * An implementation gives the contract a way to make storages, and to set up what only it can (a table left by an earlier plugin version,
 * a step recorded by an earlier plugin version).
 */
export interface PluginStorageFactory {
	readonly name: string;
	/** An empty, isolated host (a schema, a memory object) and its way to tidy up. */
	create(): Promise<PluginStorageSession>;
	dispose?(): Promise<void>;
}

export interface PluginStorageSession {
	storage(plugin: string): PluginStorage;
	close(): Promise<void>;
}

const failure = async (run: () => Promise<unknown>) => {
	try {
		await run();
	} catch (error) {
		return error instanceof CmsError ? { code: error.code, serverVersion: error.serverVersion } : error;
	}
	return null;
};

export function runPluginStorageContract(factory: PluginStorageFactory): void {
	describe(`${factory.name} plugin storage contract`, () => {
		let session: PluginStorageSession;
		let storage: PluginStorage;

		beforeAll(async () => {
			session = await factory.create();
			storage = session.storage("contract");
		});

		afterAll(async () => {
			await session?.close();
			await factory.dispose?.();
		});

		describe("documents", () => {

			it("PLUG-D1 creates an item at version 1 and reads back the same JSON value", async () => {
				const settings = storage.collection<{ endpoint: string; tags: string[]; nested: { on: boolean; none: null } }>(
					"settings",
				);
				const value = { endpoint: "https://example.test/한글", tags: ["a", "b"], nested: { on: true, none: null } };
				const created = await settings.set("create", value, { expectedVersion: 0 });
				expect(created).toMatchObject({ key: "create", value, version: 1 });
				expect(created.createdAt).toBeInstanceOf(Date);
				expect(created.updatedAt).toBeInstanceOf(Date);
				expect(await settings.get("create")).toEqual(created);
			});

			it("PLUG-D1 keeps JSON semantics: scalars and arrays are values too, and a Date comes back as its JSON text", async () => {
				const values = storage.collection("values");
				await values.set("string", "text", { expectedVersion: 0 });
				await values.set("number", 4.5, { expectedVersion: 0 });
				await values.set("null", null, { expectedVersion: 0 });
				await values.set("array", [1, "x", { y: [] }], { expectedVersion: 0 });
				await values.set("date", { at: new Date("2026-01-02T03:04:05.000Z") }, { expectedVersion: 0 });
				expect((await values.get("string"))?.value).toBe("text");
				expect((await values.get("number"))?.value).toBe(4.5);
				expect((await values.get("null"))?.value).toBeNull();
				expect((await values.get("array"))?.value).toEqual([1, "x", { y: [] }]);
				expect((await values.get("date"))?.value).toEqual({ at: "2026-01-02T03:04:05.000Z" });
			});

			it("PLUG-D2 replaces an item at the version it expects: the version grows, the creation date stays", async () => {
				const items = storage.collection<{ n: number }>("replace");
				const first = await items.set("k", { n: 1 }, { expectedVersion: 0 });
				const second = await items.set("k", { n: 2 }, { expectedVersion: 1 });
				const third = await items.set("k", { n: 3 }, { expectedVersion: 2 });
				expect([second.version, third.version]).toEqual([2, 3]);
				expect(third.value).toEqual({ n: 3 });
				expect(third.createdAt).toEqual(first.createdAt);
				expect(third.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());
				expect((await items.get("k"))?.version).toBe(3);
			});

			it("PLUG-D2 fails with a conflict that carries the stored version when the expected one is wrong, and changes nothing", async () => {
				const items = storage.collection<{ n: number }>("conflicts");
				await items.set("k", { n: 1 }, { expectedVersion: 0 });
				await items.set("k", { n: 2 }, { expectedVersion: 1 });
				expect(await failure(() => items.set("k", { n: 9 }, { expectedVersion: 1 }))).toEqual({
					code: "conflict",
					serverVersion: 2,
				});
				expect(await failure(() => items.set("k", { n: 9 }, { expectedVersion: 0 }))).toEqual({
					code: "conflict",
					serverVersion: 2,
				});
				expect(await failure(() => items.set("k", { n: 9 }, { expectedVersion: 3 }))).toEqual({
					code: "conflict",
					serverVersion: 2,
				});
				expect(await failure(() => items.set("never-created", { n: 9 }, { expectedVersion: 4 }))).toEqual({
					code: "conflict",
					serverVersion: 0,
				});
				expect((await items.get("k"))?.value).toEqual({ n: 2 });
				expect(await items.get("never-created")).toBeNull();
			});

			it("PLUG-D2 of two writers that expect the same version, exactly one wins, whether they create or replace", async () => {
				const items = storage.collection<{ by: string }>("races");
				const created = await Promise.all(
					["a", "b", "c"].map((by) => failure(() => items.set("created", { by }, { expectedVersion: 0 }))),
				);
				expect(created.filter((result) => result === null)).toHaveLength(1);
				expect(created.filter((result) => result !== null)).toEqual([
					{ code: "conflict", serverVersion: 1 },
					{ code: "conflict", serverVersion: 1 },
				]);

				const replaced = await Promise.all(
					["a", "b", "c"].map((by) => failure(() => items.set("created", { by }, { expectedVersion: 1 }))),
				);
				expect(replaced.filter((result) => result === null)).toHaveLength(1);
				expect((await items.get("created"))?.version).toBe(2);
			});

			it("PLUG-D2 deletes at the expected version, so the item can be created again from version 0", async () => {
				const items = storage.collection<{ n: number }>("deletes");
				await items.set("k", { n: 1 }, { expectedVersion: 0 });
				expect(await failure(() => items.delete("k", { expectedVersion: 5 }))).toEqual({
					code: "conflict",
					serverVersion: 1,
				});
				expect(await items.get("k")).not.toBeNull();
				await items.delete("k", { expectedVersion: 1 });
				expect(await items.get("k")).toBeNull();
				expect(await failure(() => items.delete("k", { expectedVersion: 1 }))).toMatchObject({ code: "not_found" });
				expect((await items.set("k", { n: 2 }, { expectedVersion: 0 })).version).toBe(1);
			});

			it("PLUG-D3 lists items in key order, optionally only the ones whose key starts with a prefix", async () => {
				const items = storage.collection<number>("listing");
				for (const [index, key] of ["b/2", "a/1", "b/1", "c"].entries()) {
					await items.set(key, index, { expectedVersion: 0 });
				}
				expect((await items.list()).map((item) => item.key)).toEqual(["a/1", "b/1", "b/2", "c"]);
				expect((await items.list({ prefix: "b/" })).map((item) => item.key)).toEqual(["b/1", "b/2"]);
				expect(await items.list({ prefix: "none" })).toEqual([]);
				// Percent and underscore are ordinary characters in a prefix.
				await items.set("100%_done", 9, { expectedVersion: 0 });
				expect((await items.list({ prefix: "100%_" })).map((item) => item.key)).toEqual(["100%_done"]);
				expect(await items.list({ prefix: "1%" })).toEqual([]);
			});

			it("PLUG-D3 keeps collections apart, and plugins apart", async () => {
				await storage.collection("one").set("same", "in one", { expectedVersion: 0 });
				await storage.collection("two").set("same", "in two", { expectedVersion: 0 });
				const other = session.storage("another-plugin").collection("one");
				expect(await other.get("same")).toBeNull();
				await other.set("same", "in another plugin", { expectedVersion: 0 });
				expect((await storage.collection("one").get("same"))?.value).toBe("in one");
				expect((await storage.collection("two").get("same"))?.value).toBe("in two");
				expect((await other.get("same"))?.value).toBe("in another plugin");
				expect((await other.list()).map((item) => item.key)).toEqual(["same"]);
			});
		});

		describe("what is rejected", () => {
			it("PLUG-D1 refuses values that are not JSON", async () => {
				const items = storage.collection("invalid-values");
				const circular: Record<string, unknown> = {};
				circular.self = circular;
				for (const value of [undefined, () => 1, circular]) {
					expect(await failure(() => items.set("k", value, { expectedVersion: 0 }))).toMatchObject({
						code: "invalid_input",
					});
				}
				expect(await items.get("k")).toBeNull();
			});

		});

		describe("the migration hook", () => {
			it("PLUG-S8 runs a step once even when called concurrently, and says whether it ran", async () => {
				const owner = session.storage("once-owner");
				let runs = 0;
				const results = await Promise.all(
					[1, 2, 3].map(() =>
						owner.once("count-runs", async () => {
							runs += 1;
						}),
					),
				);
				expect(runs).toBe(1);
				expect(results.filter(Boolean)).toHaveLength(1);
				expect(
					await owner.once("count-runs", async () => {
						runs += 1;
					}),
				).toBe(false);
				expect(runs).toBe(1);
			});

			it("PLUG-S8 keeps the writes of a step that finished, and none of a step that failed, which then runs again", async () => {
				const owner = session.storage("step-writes");
				await expect(
					owner.once("failing", async (migration) => {
						await migration.collection("steps").set("partial", "half done", { expectedVersion: 0 });
						throw new Error("boom");
					}),
				).rejects.toThrow("boom");
				expect(await owner.collection("steps").get("partial")).toBeNull();

				expect(
					await owner.once("failing", async (migration) => {
						await migration.collection("steps").set("done", "all done", { expectedVersion: 0 });
					}),
				).toBe(true);
				expect((await owner.collection("steps").get("done"))?.value).toBe("all done");
			});

			it("PLUG-S8 counts steps per plugin: the same name in two plugins is two steps", async () => {
				expect(await session.storage("first-plugin").once("shared-name", async () => {})).toBe(true);
				expect(await session.storage("second-plugin").once("shared-name", async () => {})).toBe(true);
				expect(await session.storage("first-plugin").once("shared-name", async () => {})).toBe(false);
			});
		});
	});
}
