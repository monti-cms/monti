import { describe, expect, it } from "vitest";
import { testConfig } from "../../../test/site";
import { type Cms, fakeCms } from "../../cms";
import type { ApiKeyList, ApiKeyView } from "../../core/api-keys";
import { PATCH as patchKeyHandler, DELETE as removeKeyHandler } from "../../http/v1/api-keys/[id]/route";
import { GET as listKeysHandler, POST as postKeyHandler } from "../../http/v1/api-keys/route";
import { PUT as assignHandler } from "../../http/v1/api-keys/slots/route";
import { defineMessages } from "../../i18n/define";
import { definePlugin } from "../../plugin/define";
import { routeCaller } from "../../testing";

const patchKey = routeCaller(patchKeyHandler);
const removeKey = routeCaller(removeKeyHandler);
const listKeys = routeCaller(listKeysHandler);
const postKey = routeCaller(postKeyHandler);

const cmsWithSecret = () => fakeCms({ server: { secret: "a-long-enough-test-secret" } });
const VALUE = "sk-ant-api03-abcdefghij3f9a";

const request = (method: string, path: string, body?: unknown) =>
	new Request(`http://localhost/api/monti/v1/${path}`, {
		method,
		headers: { origin: "http://localhost", "content-type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});

describe("api key store", () => {
	it("KEY-A1 keeps the value encrypted in storage and never returns it", async () => {
		const cms = cmsWithSecret();
		const view = await cms.apiKeys.add({ name: "Anthropic", value: VALUE });
		expect(JSON.stringify(view)).not.toContain(VALUE);
		expect(view.tail).toBe("3f9a");

		const stored = await cms.plugin("core-keys").storage.collection<{ secret: string }>("keys").get(view.id);
		expect(stored?.value.secret).not.toContain(VALUE);
		expect(JSON.stringify(await cms.apiKeys.list())).not.toContain(VALUE);
		expect(await cms.apiKeys.read(view.id)).toBe(VALUE);
	});

	it("KEY-A1 shows no tail for a value too short to show any of it", async () => {
		const cms = cmsWithSecret();
		expect((await cms.apiKeys.add({ name: "Short", value: "abcd1234" })).tail).toBe("");
	});

	it("KEY-A3 refuses to save without a server secret and says how to fix it", async () => {
		const cms = fakeCms();
		expect(cms.apiKeys.available).toBe(false);
		const error = await cms.apiKeys.add({ name: "X", value: VALUE }).catch((caught: Error) => caught);
		expect(error).toMatchObject({ code: "secret_not_configured" });
		// What is missing, where it is set, and how to make one.
		expect((error as Error).message).toContain("MONTI_SECRET");
		expect((error as Error).message).toMatch(/Where:.*secret/);
		expect((error as Error).message).toMatch(/Fix:.*openssl rand/);
	});

	it("KEY-N1 rejects a taken name, and picks a free one when the place chooses the name", async () => {
		const cms = cmsWithSecret();
		await cms.apiKeys.add({ name: "Anthropic", value: VALUE });
		await expect(cms.apiKeys.add({ name: "anthropic", value: VALUE })).rejects.toMatchObject({
			code: "key_name_taken",
		});
		const second = await cms.apiKeys.addNamed({ baseName: "Anthropic", value: `${VALUE}2` });
		const third = await cms.apiKeys.addNamed({ baseName: "Anthropic", value: `${VALUE}3` });
		expect([second.name, third.name]).toEqual(["Anthropic 2", "Anthropic 3"]);
	});

	it("KEY-N1 keeps names unique without regard to case, also when two keys are saved at the same moment", async () => {
		const cms = cmsWithSecret();
		const saved = await Promise.allSettled([
			cms.apiKeys.add({ name: "Anthropic", value: VALUE }),
			cms.apiKeys.add({ name: "ANTHROPIC", value: `${VALUE}2` }),
		]);
		expect(saved.filter((result) => result.status === "fulfilled")).toHaveLength(1);
		expect(saved.find((result) => result.status === "rejected")).toMatchObject({
			reason: { code: "key_name_taken" },
		});
		expect(await cms.apiKeys.list()).toHaveLength(1);
	});

	it("KEY-N1 frees a name when its key is renamed or deleted", async () => {
		const cms = cmsWithSecret();
		const key = await cms.apiKeys.add({ name: "Old", value: VALUE });
		const renamed = await cms.apiKeys.update(key.id, { expectedVersion: key.version, name: "New" });
		await cms.apiKeys.add({ name: "old", value: `${VALUE}2` });
		await expect(cms.apiKeys.update(key.id, { expectedVersion: renamed.version, name: "OLD" })).rejects.toMatchObject({
			code: "key_name_taken",
		});
		await cms.apiKeys.remove(key.id, { expectedVersion: renamed.version });
		await cms.apiKeys.add({ name: "new", value: `${VALUE}3` });
	});

	it("KEY-A4 refuses to delete a key that is used unless forced, and deletes the key with its uses together", async () => {
		const cms = cmsWithSecret();
		const key = await cms.apiKeys.add({ name: "Anthropic", value: VALUE });
		await cms.apiKeys.setUses("ai", [{ ref: "connection:a", keyId: key.id }]);
		await expect(cms.apiKeys.remove(key.id, { expectedVersion: key.version })).rejects.toMatchObject({
			code: "key_in_use",
			serverVersion: key.version,
			notice: { key: "key.in_use", vars: { count: 1 } },
			details: { uses: [{ plugin: "ai", ref: "connection:a", label: "ai" }] },
		});
		expect(await cms.apiKeys.get(key.id)).not.toBeNull();
		await cms.apiKeys.remove(key.id, { expectedVersion: key.version, force: true });
		expect(await cms.apiKeys.get(key.id)).toBeNull();
	});

	it("KEY-A2 renames and replaces the value under the same id, keeping the places that use it", async () => {
		const cms = cmsWithSecret();
		const key = await cms.apiKeys.add({ name: "Speller", value: VALUE });
		await cms.apiKeys.setUses("text-check-speller", [{ ref: "key", keyId: key.id }]);

		const renamed = await cms.apiKeys.update(key.id, { expectedVersion: key.version, name: "Speller main" });
		const replaced = await cms.apiKeys.update(key.id, {
			expectedVersion: renamed.version,
			value: "brn-0000000000007777",
		});
		expect(replaced.id).toBe(key.id);
		expect(replaced.name).toBe("Speller main");
		expect(replaced.tail).toBe("7777");
		expect(replaced.uses).toEqual([{ plugin: "text-check-speller", ref: "key", label: "text-check-speller" }]);
		expect(await cms.apiKeys.read(key.id)).toBe("brn-0000000000007777");
		await expect(cms.apiKeys.update(key.id, { expectedVersion: key.version, name: "stale" })).rejects.toMatchObject({
			code: "conflict",
		});
	});

	it("KEY-A4 tells which places use a key, replaces a plugin's places as a whole, and ignores a place that names no key", async () => {
		const cms = cmsWithSecret();
		const key = await cms.apiKeys.add({ name: "Anthropic", value: VALUE });
		await cms.apiKeys.setUses("ai", [
			{ ref: "connection:a", keyId: key.id },
			{ ref: "connection:b", keyId: key.id },
			{ ref: "connection:c", keyId: "no-such-key" },
		]);
		await cms.apiKeys.setUses("mailer", [{ ref: "token", keyId: key.id }]);
		expect((await cms.apiKeys.get(key.id))?.uses.map((use) => `${use.plugin}:${use.ref}`).sort()).toEqual([
			"ai:connection:a",
			"ai:connection:b",
			"mailer:token",
		]);

		await cms.apiKeys.setUses("ai", [{ ref: "connection:a", keyId: key.id }]);
		expect((await cms.apiKeys.get(key.id))?.uses.map((use) => use.plugin).sort()).toEqual(["ai", "mailer"]);
	});

	it("KEY-A4 deleting a key forgets where it was used, and the value is gone", async () => {
		const cms = cmsWithSecret();
		const key = await cms.apiKeys.add({ name: "Anthropic", value: VALUE });
		await cms.apiKeys.setUses("ai", [{ ref: "connection:a", keyId: key.id }]);
		await cms.apiKeys.remove(key.id, { expectedVersion: key.version, force: true });
		expect(await cms.apiKeys.read(key.id)).toBeNull();
		expect(await cms.plugin("core-keys").storage.collection("assignments").list()).toEqual([]);
	});

	it("KEY-S2 reports a value that cannot be decrypted any more as unreadable", async () => {
		const shared = fakeCms();
		const storage = (plugin: string) => shared.plugin(plugin).storage;
		const first = fakeCms({ server: { secret: "first-secret-first-secret" }, storage });
		const key = await first.apiKeys.add({ name: "Anthropic", value: VALUE });
		const rotated = fakeCms({ server: { secret: "other-secret-other-secret" }, storage });
		expect((await rotated.apiKeys.get(key.id))?.readable).toBe(false);
		expect(await rotated.apiKeys.read(key.id)).toBeNull();
		const kept = fakeCms({
			server: { secret: "other-secret-other-secret", previousSecrets: ["first-secret-first-secret"] },
			storage,
		});
		expect(await kept.apiKeys.read(key.id)).toBe(VALUE);
	});
});

describe("/v1/api-keys", () => {
	it("KEY-A1 creates, lists and renames keys without ever returning the value", async () => {
		const cms = cmsWithSecret();
		const created = await postKey(request("POST", "api-keys", { name: "Anthropic", value: VALUE }), { cms });
		expect(created.status).toBe(201);
		const key = (await created.json()) as ApiKeyView;

		const listed = await listKeys(request("GET", "api-keys"), { cms });
		const text = await listed.text();
		expect(text).not.toContain(VALUE);
		expect((JSON.parse(text) as ApiKeyList).items.map((item) => item.name)).toEqual(["Anthropic"]);

		const patched = await patchKey(
			request("PATCH", `api-keys/${key.id}`, { expectedVersion: key.version, name: "Claude" }),
			{
				cms,
				params: Promise.resolve({ id: key.id }),
			},
		);
		expect(((await patched.json()) as ApiKeyView).name).toBe("Claude");
	});

	it("KEY-A4 answers 409 key_in_use with the places that would stop working, and deletes only when forced", async () => {
		const cms = cmsWithSecret();
		const key = await cms.apiKeys.add({ name: "Anthropic", value: VALUE });
		await cms.apiKeys.setUses("ai", [{ ref: "connection:a", keyId: key.id }]);
		const params = Promise.resolve({ id: key.id });
		const url = `api-keys/${key.id}?expectedVersion=${key.version}`;

		const refused = await removeKey(request("DELETE", url), { cms, params });
		expect(refused.status).toBe(409);
		const body = await refused.json();
		expect(body.error.code).toBe("key_in_use");
		expect(body.error.details.uses).toEqual([{ plugin: "ai", ref: "connection:a", label: "ai" }]);
		expect(await cms.apiKeys.get(key.id)).not.toBeNull();

		const forced = await removeKey(request("DELETE", `${url}&force=true`), { cms, params });
		expect(forced.status).toBe(204);
		expect(await cms.apiKeys.get(key.id)).toBeNull();
	});
});

describe("key slots of plugins", () => {
	const assign = routeCaller(assignHandler);

	const VALUE = "sk-ant-api03-abcdefghij3f9a";
	const SECRET = "a-long-enough-test-secret";

	/** A plugin that asks for one key. Its label is a getter, so it follows the language when it is read. */
	const speller = (language: { current: string }) =>
		definePlugin({
			name: "speller",
			keySlots: [
				{
					id: "key",
					service: "Speller",
					get label() {
						return language.current === "ko" ? "맞춤법 검사" : "Spell check";
					},
				},
			],
		});

	const CONFIG = (plugins: ReturnType<typeof speller>[]) => ({ ...testConfig, plugins });

	const cmsWith = (plugins: ReturnType<typeof speller>[], extra: Record<string, unknown> = {}) =>
		fakeCms({ config: CONFIG(plugins) as never, server: { secret: SECRET }, ...extra }) as unknown as Cms;

	const request = (body: unknown) =>
		new Request("http://localhost/api/monti/v1/api-keys/slots", {
			method: "PUT",
			headers: { origin: "http://localhost", "content-type": "application/json" },
			body: JSON.stringify(body),
		});

	describe("key slots", () => {
		it("KEY-P1 lists a plugin's declared slot as empty until a key is assigned", async () => {
			const cms = cmsWith([speller({ current: "en" })]);
			expect(await cms.apiKeys.slots()).toEqual([
				{ plugin: "speller", slot: "key", label: "Spell check", service: "Speller", key: null },
			]);
			expect(await cms.apiKeys.slot("speller", "key").read()).toBeNull();
		});

		it("KEY-P1 assigns a saved key, shows the slot among the key's uses, and the plugin reads the value through it", async () => {
			const cms = cmsWith([speller({ current: "en" })]);
			const key = await cms.apiKeys.add({ name: "Speller", value: VALUE });
			await cms.apiKeys.slot("speller", "key").set(key.id);
			const [slot] = await cms.apiKeys.slots();
			expect(slot?.key).toMatchObject({ id: key.id, name: "Speller", tail: "3f9a" });
			const view = await cms.apiKeys.get(key.id);
			expect(view?.uses).toEqual([{ plugin: "speller", ref: "key", label: "Spell check" }]);
			expect(view?.slots).toHaveLength(1);
			expect(await cms.apiKeys.slot("speller", "key").read()).toBe(VALUE);
		});

		it("KEY-P1 saves a typed key together with the assignment, named after the slot", async () => {
			const cms = cmsWith([speller({ current: "en" })]);
			await cms.apiKeys.slot("speller", "key").assign({ use: "new", value: VALUE });
			await cms.apiKeys.slot("speller", "key").assign({ use: "new", value: `${VALUE}2` });
			expect((await cms.apiKeys.list()).map((key) => key.name)).toEqual(["Speller", "Speller 2"]);
			expect(await cms.apiKeys.slot("speller", "key").read()).toBe(`${VALUE}2`);
		});

		it("KEY-P1 names a key entered for a slot after the service, not the localized label, so every language and the migrations agree", async () => {
			const language = { current: "ko" };
			const cms = cmsWith([speller(language)]);
			await assign(request({ plugin: "speller", slot: "key", key: { use: "new", value: VALUE } }), { cms });
			await assign(request({ plugin: "speller", slot: "key", key: { use: "new", value: `${VALUE}2` } }), { cms });
			expect((await cms.apiKeys.list()).map((key) => key.name)).toEqual(["Speller", "Speller 2"]);
			expect((await cms.apiKeys.slots())[0]?.label).toBe("맞춤법 검사");
		});

		it("KEY-P1 keeps no orphan key when the assignment cannot be written", async () => {
			const cms = cmsWith([speller({ current: "en" })]);
			await expect(cms.apiKeys.slot("speller", "nope").assign({ use: "new", value: VALUE })).rejects.toMatchObject({
				code: "not_found",
			});
			expect(await cms.apiKeys.list()).toEqual([]);
		});

		it("KEY-P1 clears a slot, which leaves the key itself", async () => {
			const cms = cmsWith([speller({ current: "en" })]);
			await cms.apiKeys.slot("speller", "key").assign({ use: "new", value: VALUE });
			await cms.apiKeys.slot("speller", "key").assign({ use: "none" });
			expect((await cms.apiKeys.slots())[0]?.key).toBeNull();
			expect(await cms.apiKeys.slot("speller", "key").read()).toBeNull();
			const [key] = await cms.apiKeys.list();
			expect(key?.uses).toEqual([]);
		});

		it("KEY-A4 deleting the assigned key empties the slot", async () => {
			const cms = cmsWith([speller({ current: "en" })]);
			const key = await cms.apiKeys.add({ name: "Speller", value: VALUE });
			await cms.apiKeys.slot("speller", "key").set(key.id);
			await expect(cms.apiKeys.remove(key.id, { expectedVersion: key.version })).rejects.toMatchObject({
				code: "key_in_use",
			});
			await cms.apiKeys.remove(key.id, { expectedVersion: key.version, force: true });
			expect((await cms.apiKeys.slots())[0]?.key).toBeNull();
		});

		it("KEY-P1 works out a slot label from the site, in the admin language of the instance", async () => {
			const messages = defineMessages("test.slot", { en: { key: "Spell check" }, ko: { key: "맞춤법 검사" } });
			const plugin = definePlugin({
				name: "speller",
				keySlots: [{ id: "key", service: "Speller", label: (site) => site.createTranslator(messages)("key") }],
			});
			const english = fakeCms({
				config: { ...CONFIG([plugin as never]), admin: { locale: "en" } } as never,
				server: { secret: SECRET },
			});
			expect((await english.apiKeys.slots())[0]?.label).toBe("Spell check");
			const korean = fakeCms({
				config: { ...CONFIG([plugin as never]), admin: { locale: "ko" } } as never,
				server: { secret: SECRET },
			});
			expect((await korean.apiKeys.slots())[0]?.label).toBe("맞춤법 검사");
		});

		it("KEY-P1 lists slots and assigns through the routes", async () => {
			const cms = cmsWith([speller({ current: "en" })]);
			const response = await assign(request({ plugin: "speller", slot: "key", key: { use: "new", value: VALUE } }), {
				cms,
			});
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).not.toContain(VALUE);
			const body = JSON.parse(text) as ApiKeyList;
			expect(body.slots[0]?.key?.name).toBe("Speller");
			expect(body.items[0]?.uses[0]?.label).toBe("Spell check");
		});
	});

	describe("uses are stored as references", () => {
		it("KEY-A4 resolves each label when the keys are read, from the plugin, and does not show an item that is gone", async () => {
			const names = new Map([["connection:a", "Claude"]]);
			const ai = definePlugin({
				name: "ai",
				server: async () => ({
					default: {
						keyUses: async (refs) =>
							Object.fromEntries(refs.map((ref) => [ref, names.has(ref) ? `AI: ${names.get(ref)}` : null])),
					},
				}),
			});
			const cms = fakeCms({ config: CONFIG([ai as never]) as never, server: { secret: SECRET } });
			const key = await cms.apiKeys.add({ name: "Anthropic", value: VALUE });
			await cms.apiKeys.setUses("ai", [
				{ ref: "connection:a", keyId: key.id },
				{ ref: "connection:b", keyId: key.id },
			]);
			// The stored row has no text, and a rename shows at the next read.
			expect(JSON.stringify(await cms.plugin("core-keys").storage.collection("assignments").list())).not.toContain(
				"AI:",
			);
			expect((await cms.apiKeys.get(key.id))?.uses.map((use) => use.label)).toEqual(["AI: Claude"]);
			names.set("connection:a", "Claude renamed");
			expect((await cms.apiKeys.get(key.id))?.uses.map((use) => use.label)).toEqual(["AI: Claude renamed"]);
			// Reading changes nothing: the use of the item that does not exist is dropped when the plugin reports its items again.
			expect((await cms.plugin("core-keys").storage.collection("assignments").list()).map((item) => item.key)).toEqual([
				"ai:connection:a",
				"ai:connection:b",
			]);
			await cms.apiKeys.setUses("ai", [{ ref: "connection:a", keyId: key.id }]);
			expect((await cms.plugin("core-keys").storage.collection("assignments").list()).map((item) => item.key)).toEqual([
				"ai:connection:a",
			]);
		});
	});

	describe("cms.transaction", () => {
		it("KEY-A2 keeps a new key and the item that uses it together, or neither", async () => {
			const cms = fakeCms({ server: { secret: SECRET } });
			const settings = () => cms.plugin("my-plugin").storage.collection<{ keyId: string | null }>("settings");
			await expect(
				cms.transaction(async (tx) => {
					const keyId = await tx.apiKeys.choose({ use: "new", value: VALUE }, { baseName: "Mine" });
					await tx.storage("my-plugin").collection("settings").set("default", { keyId }, { expectedVersion: 0 });
					throw new Error("the save failed");
				}),
			).rejects.toThrow("the save failed");
			expect(await cms.apiKeys.list()).toEqual([]);
			expect(await settings().get("default")).toBeNull();

			await cms.transaction(async (tx) => {
				const keyId = await tx.apiKeys.choose({ use: "new", value: VALUE }, { baseName: "Mine" });
				await tx.storage("my-plugin").collection("settings").set("default", { keyId }, { expectedVersion: 0 });
			});
			const [key] = await cms.apiKeys.list();
			expect((await settings().get("default"))?.value.keyId).toBe(key?.id);
		});
	});
});
