import { describe, expect, it } from "vitest";
import { testConfig } from "../../../test/site";
import { type Cms, fakeCms } from "../../cms";
import type { ApiKeyList } from "../../core/api-keys";
import { PUT as assignHandler } from "../../http/v1/api-keys/slots/route";
import { defineMessages } from "../../i18n/define";
import { definePlugin } from "../../plugin/define";
import { routeCaller } from "../../testing";

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

	it("names a key entered for a slot after the service, not the localized label, so every language and the migrations agree", async () => {
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

	it("shows the slot in the admin language it is read in", async () => {
		const language = { current: "en" };
		const cms = cmsWith([speller(language)]);
		const key = await cms.apiKeys.add({ name: "Speller", value: VALUE });
		await cms.apiKeys.slot("speller", "key").set(key.id);
		expect((await cms.apiKeys.slots())[0]?.label).toBe("Spell check");
		language.current = "ko";
		expect((await cms.apiKeys.slots())[0]?.label).toBe("맞춤법 검사");
		expect((await cms.apiKeys.get(key.id))?.uses[0]?.label).toBe("맞춤법 검사");
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

	it("has no slot, and no use, when the plugin is not installed", async () => {
		const shared = fakeCms();
		const storage = (plugin: string) => shared.plugin(plugin).storage;
		const installed = cmsWith([speller({ current: "en" })], { storage });
		const key = await installed.apiKeys.add({ name: "Speller", value: VALUE });
		await installed.apiKeys.slot("speller", "key").set(key.id);

		const without = cmsWith([], { storage });
		expect(await without.apiKeys.slots()).toEqual([]);
		expect((await without.apiKeys.get(key.id))?.uses).toEqual([]);
		await expect(without.apiKeys.slot("speller", "key").set(key.id)).rejects.toMatchObject({ code: "not_found" });
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
		expect(JSON.stringify(await cms.plugin("core-keys").storage.collection("assignments").list())).not.toContain("AI:");
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
