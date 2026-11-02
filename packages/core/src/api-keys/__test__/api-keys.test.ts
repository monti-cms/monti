import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../../test/site";
import { type Cms, fakeCms } from "../../cms";
import type { ApiKeyList, ApiKeyView } from "../../core/api-keys";
import { PATCH as patchKeyHandler, DELETE as removeKeyHandler } from "../../http/v1/api-keys/[id]/route";
import { GET as listKeysHandler, POST as postKeyHandler } from "../../http/v1/api-keys/route";
import { PUT as assignHandler } from "../../http/v1/api-keys/slots/route";
import { defineMessages } from "../../i18n/define";
import { definePlugin, type PluginKeyService } from "../../plugin/define";
import { routeCaller } from "../../testing";

const patchKey = routeCaller(patchKeyHandler);
const removeKey = routeCaller(removeKeyHandler);
const listKeys = routeCaller(listKeysHandler);
const postKey = routeCaller(postKeyHandler);

const SECRET = "a-long-enough-test-secret";
const VALUE = "sk-ant-api03-abcdefghij3f9a";
/** The value the test service refuses. */
const REFUSED = "sk-refused-0000000000";

/** What the test services were asked, to see that a check happens before a save. */
const asked: { service: string; url: string; value: string | null }[] = [];

const service = (id: string, extra: Partial<PluginKeyService> = {}): PluginKeyService => ({
	id,
	label: id[0]?.toUpperCase() + id.slice(1),
	group: "ai",
	check: async ({ url, value }) => {
		asked.push({ service: id, url, value });
		return value === REFUSED ? "rejected" : "ok";
	},
	...extra,
});

/** A plugin that offers keys for a few services: one plain, one at an address of the site's choosing that needs no key, one a slot reads. */
const services = definePlugin({
	name: "services",
	server: async () => ({
		default: {
			keyServices: () => [
				service("anthropic"),
				service("local", { url: { placeholder: "http://localhost:11434/v1" }, keyOptional: true, hint: "Ollama" }),
				service("speller", { group: "plugin" }),
			],
		},
	}),
});

const cmsWith = (plugins: unknown[] = [], extra: Record<string, unknown> = {}) =>
	fakeCms({
		config: { ...testConfig, plugins: [services, ...plugins] } as never,
		server: { secret: SECRET },
		...extra,
	}) as unknown as Cms;

const add = (cms: Cms, name: string, value = VALUE, serviceId = "anthropic") =>
	cms.apiKeys.add({ service: serviceId, name, value });

const request = (method: string, path: string, body?: unknown) =>
	new Request(`http://localhost/api/monti/v1/${path}`, {
		method,
		headers: { origin: "http://localhost", "content-type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});

describe("api key store", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("KEY-A1 keeps the value encrypted in storage and never returns it", async () => {
		const cms = cmsWith();
		const view = await add(cms, "Anthropic");
		expect(JSON.stringify(view)).not.toContain(VALUE);
		expect(view).toMatchObject({ tail: "3f9a", service: "anthropic", url: "" });

		const stored = await cms.plugin("core-keys").storage.collection<{ secret: string }>("keys").get(view.id);
		expect(stored?.value.secret).not.toContain(VALUE);
		expect(JSON.stringify(await cms.apiKeys.view())).not.toContain(VALUE);
		expect(await cms.apiKeys.access(view.id)).toMatchObject({ service: "anthropic", value: VALUE, readable: true });
	});

	it("KEY-A1 shows no tail for a value too short to show any of it", async () => {
		const cms = cmsWith();
		expect((await add(cms, "Short", "abcd1234")).tail).toBe("");
	});

	it("KEY-A3 refuses to save without a server secret and says how to fix it, before asking the service", async () => {
		asked.length = 0;
		const cms = fakeCms({ config: { ...testConfig, plugins: [services] } as never });
		expect(cms.apiKeys.available).toBe(false);
		const error = await add(cms as unknown as Cms, "X").catch((caught: Error) => caught);
		expect(error).toMatchObject({ code: "secret_not_configured" });
		// What is missing, where it is set, and how to make one.
		expect((error as Error).message).toContain("MONTI_SECRET");
		expect((error as Error).message).toMatch(/Where:.*secret/);
		expect((error as Error).message).toMatch(/Fix:.*openssl rand/);
		expect(asked).toEqual([]);
	});

	it("KEY-C1 asks the service before saving, and keeps nothing when it refuses the key", async () => {
		asked.length = 0;
		const cms = cmsWith();
		await expect(add(cms, "Anthropic", REFUSED)).rejects.toMatchObject({
			code: "key_rejected",
			notice: { key: "key.rejected" },
		});
		expect(await cms.apiKeys.list()).toEqual([]);
		// The name is still free.
		await add(cms, "Anthropic");
		expect(asked.map((entry) => entry.value)).toEqual([REFUSED, VALUE]);
	});

	it("KEY-C1 checks a replaced value with the key's own service and address, and keeps the old value when it is refused", async () => {
		const cms = cmsWith();
		const key = await cms.apiKeys.add({
			service: "local",
			url: "http://localhost:11434/v1/",
			name: "Local",
			value: VALUE,
		});
		asked.length = 0;
		await expect(cms.apiKeys.update(key.id, { expectedVersion: key.version, value: REFUSED })).rejects.toMatchObject({
			code: "key_rejected",
		});
		expect(asked).toEqual([{ service: "local", url: "http://localhost:11434/v1", value: REFUSED }]);
		expect((await cms.apiKeys.access(key.id))?.value).toBe(VALUE);
		// A rename alone asks nothing.
		await cms.apiKeys.update(key.id, { expectedVersion: key.version, name: "Ollama" });
		expect(asked).toHaveLength(1);
	});

	it("KEY-C2 takes an address only for a service that lives at one, needs it there, and lets that service go without a key", async () => {
		const cms = cmsWith();
		await expect(cms.apiKeys.add({ service: "local", name: "Local" })).rejects.toMatchObject({ code: "invalid_input" });
		const local = await cms.apiKeys.add({ service: "local", url: "http://localhost:11434/v1", name: "Local" });
		expect(local).toMatchObject({ url: "http://localhost:11434/v1", tail: "", readable: true });
		expect((await cms.apiKeys.access(local.id))?.value).toBeNull();
		await expect(cms.apiKeys.add({ service: "anthropic", name: "No value" })).rejects.toMatchObject({
			code: "invalid_input",
		});
		const plain = await cms.apiKeys.add({
			service: "anthropic",
			url: "https://elsewhere.example/v1",
			name: "A",
			value: VALUE,
		});
		expect(plain.url).toBe("");
		await expect(cms.apiKeys.add({ service: "nobody", name: "B", value: VALUE })).rejects.toMatchObject({
			code: "invalid_input",
		});
	});

	it("KEY-C2 lists the services keys can be added for, AI services first, without their checks", async () => {
		const cms = cmsWith();
		const listed = await cms.apiKeys.services();
		expect(listed.map((entry) => `${entry.group}:${entry.id}`)).toEqual(["ai:anthropic", "ai:local", "plugin:speller"]);
		expect(listed[1]).toEqual({
			id: "local",
			label: "Local",
			group: "ai",
			hint: "Ollama",
			url: { placeholder: "http://localhost:11434/v1" },
			keyOptional: true,
		});
	});

	it("KEY-N1 rejects a taken name without regard to case", async () => {
		const cms = cmsWith();
		await add(cms, "Anthropic");
		await expect(add(cms, "anthropic", `${VALUE}2`)).rejects.toMatchObject({ code: "key_name_taken" });
	});

	it("KEY-N1 keeps names unique without regard to case, also when two keys are saved at the same moment", async () => {
		const cms = cmsWith();
		const saved = await Promise.allSettled([add(cms, "Anthropic"), add(cms, "ANTHROPIC", `${VALUE}2`)]);
		expect(saved.filter((result) => result.status === "fulfilled")).toHaveLength(1);
		expect(saved.find((result) => result.status === "rejected")).toMatchObject({
			reason: { code: "key_name_taken" },
		});
		expect(await cms.apiKeys.list()).toHaveLength(1);
	});

	it("KEY-N1 frees a name when its key is renamed or deleted", async () => {
		const cms = cmsWith();
		const key = await add(cms, "Old");
		const renamed = await cms.apiKeys.update(key.id, { expectedVersion: key.version, name: "New" });
		await add(cms, "old", `${VALUE}2`);
		await expect(cms.apiKeys.update(key.id, { expectedVersion: renamed.version, name: "OLD" })).rejects.toMatchObject({
			code: "key_name_taken",
		});
		await cms.apiKeys.remove(key.id, { expectedVersion: renamed.version });
		await add(cms, "new", `${VALUE}3`);
	});

	it("KEY-A4 refuses to delete a key that is used unless forced, and deletes the key with its uses together", async () => {
		const cms = cmsWith();
		const key = await add(cms, "Anthropic");
		await cms.apiKeys.setUses("ai", [{ ref: "quick", keyId: key.id }]);
		await expect(cms.apiKeys.remove(key.id, { expectedVersion: key.version })).rejects.toMatchObject({
			code: "key_in_use",
			serverVersion: key.version,
			notice: { key: "key.in_use", vars: { count: 1 } },
			details: { uses: [{ plugin: "ai", ref: "quick", label: "ai" }] },
		});
		expect(await cms.apiKeys.get(key.id)).not.toBeNull();
		await cms.apiKeys.remove(key.id, { expectedVersion: key.version, force: true });
		expect(await cms.apiKeys.get(key.id)).toBeNull();
	});

	it("KEY-A2 renames and replaces the value under the same id, keeping the places that use it", async () => {
		const cms = cmsWith();
		const key = await add(cms, "Speller");
		await cms.apiKeys.setUses("text-check-speller", [{ ref: "key", keyId: key.id }]);

		const renamed = await cms.apiKeys.update(key.id, { expectedVersion: key.version, name: "Speller main" });
		const replaced = await cms.apiKeys.update(key.id, {
			expectedVersion: renamed.version,
			value: "brn-0000000000007777",
		});
		expect(replaced).toMatchObject({ id: key.id, name: "Speller main", tail: "7777", service: "anthropic" });
		expect(replaced.uses).toEqual([{ plugin: "text-check-speller", ref: "key", label: "text-check-speller" }]);
		expect((await cms.apiKeys.access(key.id))?.value).toBe("brn-0000000000007777");
		await expect(cms.apiKeys.update(key.id, { expectedVersion: key.version, name: "stale" })).rejects.toMatchObject({
			code: "conflict",
		});
	});

	it("KEY-A4 tells which places use a key, replaces a plugin's places as a whole, and ignores a place that names no key", async () => {
		const cms = cmsWith();
		const key = await add(cms, "Anthropic");
		await cms.apiKeys.setUses("ai", [
			{ ref: "quick", keyId: key.id },
			{ ref: "assistant", keyId: key.id },
			{ ref: "other", keyId: "no-such-key" },
		]);
		await cms.apiKeys.setUses("mailer", [{ ref: "token", keyId: key.id }]);
		expect((await cms.apiKeys.get(key.id))?.uses.map((use) => `${use.plugin}:${use.ref}`).sort()).toEqual([
			"ai:assistant",
			"ai:quick",
			"mailer:token",
		]);

		await cms.apiKeys.setUses("ai", [{ ref: "quick", keyId: key.id }]);
		expect((await cms.apiKeys.get(key.id))?.uses.map((use) => use.plugin).sort()).toEqual(["ai", "mailer"]);
	});

	it("KEY-A4 deleting a key forgets where it was used and what it counted, and the value is gone", async () => {
		const cms = cmsWith();
		const key = await add(cms, "Anthropic");
		await cms.apiKeys.setUses("ai", [{ ref: "quick", keyId: key.id }]);
		await cms.apiKeys.recordUsage(key.id, 120);
		await cms.apiKeys.remove(key.id, { expectedVersion: key.version, force: true });
		expect(await cms.apiKeys.access(key.id)).toBeNull();
		expect(await cms.plugin("core-keys").storage.collection("assignments").list()).toEqual([]);
		expect(await cms.plugin("core-keys").storage.collection("usage").list()).toEqual([]);
	});

	it("KEY-U1 adds up the tokens of each key per month, and shows this month's", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(new Date("2026-10-31T23:00:00Z"));
		const cms = cmsWith();
		const key = await add(cms, "Anthropic");
		const other = await add(cms, "Other", `${VALUE}2`);
		await cms.apiKeys.recordUsage(key.id, 1000);
		await Promise.all([cms.apiKeys.recordUsage(key.id, 200), cms.apiKeys.recordUsage(key.id, 40)]);
		await cms.apiKeys.recordUsage(other.id, 0);
		await cms.apiKeys.recordUsage("no-such-key", 99);
		expect((await cms.apiKeys.list()).map((item) => [item.name, item.usage])).toEqual([
			["Anthropic", 1240],
			["Other", 0],
		]);
		vi.setSystemTime(new Date("2026-11-01T00:10:00Z"));
		expect((await cms.apiKeys.get(key.id))?.usage).toBe(0);
		await cms.apiKeys.recordUsage(key.id, 5);
		expect((await cms.apiKeys.get(key.id))?.usage).toBe(5);
	});

	it("KEY-S2 reports a value that cannot be decrypted any more as unreadable", async () => {
		const shared = fakeCms();
		const storage = (plugin: string) => shared.plugin(plugin).storage;
		const first = cmsWith([], { server: { secret: "first-secret-first-secret" }, storage });
		const key = await add(first, "Anthropic");
		const rotated = cmsWith([], { server: { secret: "other-secret-other-secret" }, storage });
		expect((await rotated.apiKeys.get(key.id))?.readable).toBe(false);
		expect(await rotated.apiKeys.access(key.id)).toMatchObject({ value: null, readable: false });
		const kept = cmsWith([], {
			server: { secret: "other-secret-other-secret", previousSecrets: ["first-secret-first-secret"] },
			storage,
		});
		expect((await kept.apiKeys.access(key.id))?.value).toBe(VALUE);
	});
});

describe("/v1/api-keys", () => {
	it("KEY-A1 creates, lists and renames keys without ever returning the value", async () => {
		const cms = cmsWith();
		const created = await postKey(
			request("POST", "api-keys", { service: "anthropic", name: "Anthropic", value: VALUE }),
			{ cms },
		);
		expect(created.status).toBe(201);
		const key = (await created.json()) as ApiKeyView;

		const listed = await listKeys(request("GET", "api-keys"), { cms });
		const text = await listed.text();
		expect(text).not.toContain(VALUE);
		const body = JSON.parse(text) as ApiKeyList;
		expect(body.items.map((item) => item.name)).toEqual(["Anthropic"]);
		expect(body.services.map((entry) => entry.id)).toEqual(["anthropic", "local", "speller"]);

		const patched = await patchKey(
			request("PATCH", `api-keys/${key.id}`, { expectedVersion: key.version, name: "Claude" }),
			{ cms, params: Promise.resolve({ id: key.id }) },
		);
		expect(((await patched.json()) as ApiKeyView).name).toBe("Claude");
	});

	it("KEY-C1 answers 422 key_rejected when the service refuses the key", async () => {
		const cms = cmsWith();
		const refused = await postKey(
			request("POST", "api-keys", { service: "anthropic", name: "Anthropic", value: REFUSED }),
			{ cms },
		);
		expect(refused.status).toBe(422);
		expect((await refused.json()).error.code).toBe("key_rejected");
	});

	it("KEY-A4 answers 409 key_in_use with the places that would stop working, and deletes only when forced", async () => {
		const cms = cmsWith();
		const key = await add(cms, "Anthropic");
		await cms.apiKeys.setUses("ai", [{ ref: "quick", keyId: key.id }]);
		const params = Promise.resolve({ id: key.id });
		const url = `api-keys/${key.id}?expectedVersion=${key.version}`;

		const refused = await removeKey(request("DELETE", url), { cms, params });
		expect(refused.status).toBe(409);
		const body = await refused.json();
		expect(body.error.code).toBe("key_in_use");
		expect(body.error.details.uses).toEqual([{ plugin: "ai", ref: "quick", label: "ai" }]);
		expect(await cms.apiKeys.get(key.id)).not.toBeNull();

		const forced = await removeKey(request("DELETE", `${url}&force=true`), { cms, params });
		expect(forced.status).toBe(204);
		expect(await cms.apiKeys.get(key.id)).toBeNull();
	});
});

describe("key slots of plugins", () => {
	const assign = routeCaller(assignHandler);

	/** A plugin that asks for one key of the `speller` service. Its label is a getter, so it follows the language when it is read. */
	const speller = (language: { current: string }) =>
		definePlugin({
			name: "speller",
			keySlots: [
				{
					id: "key",
					service: "speller",
					get label() {
						return language.current === "ko" ? "맞춤법 검사" : "Spell check";
					},
				},
			],
		});

	const slotRequest = (body: unknown) =>
		new Request("http://localhost/api/monti/v1/api-keys/slots", {
			method: "PUT",
			headers: { origin: "http://localhost", "content-type": "application/json" },
			body: JSON.stringify(body),
		});

	it("KEY-P1 lists a plugin's declared slot with no key until its service has one", async () => {
		const cms = cmsWith([speller({ current: "en" })]);
		await add(cms, "Anthropic");
		expect(await cms.apiKeys.slots()).toEqual([
			{ plugin: "speller", slot: "key", label: "Spell check", service: "speller", key: null },
		]);
		expect(await cms.apiKeys.slot("speller", "key").read()).toBeNull();
	});

	it("KEY-P1 reads the first key of its service by itself, and shows the slot among that key's uses", async () => {
		const cms = cmsWith([speller({ current: "en" })]);
		const key = await add(cms, "Speller", VALUE, "speller");
		const [slot] = await cms.apiKeys.slots();
		expect(slot?.key).toMatchObject({ id: key.id, name: "Speller", tail: "3f9a" });
		expect((await cms.apiKeys.get(key.id))?.uses).toEqual([
			{ plugin: "speller", ref: "slot:key", label: "Spell check" },
		]);
		expect(await cms.apiKeys.slot("speller", "key").read()).toBe(VALUE);
	});

	it("KEY-P1 reads the key chosen for it among the keys of its service, back to the first with null, and refuses a key of another service", async () => {
		const cms = cmsWith([speller({ current: "en" })]);
		await add(cms, "A speller", VALUE, "speller");
		const second = await add(cms, "B speller", `${VALUE}2`, "speller");
		const other = await add(cms, "Anthropic", `${VALUE}3`);
		await cms.apiKeys.slot("speller", "key").set(second.id);
		expect(await cms.apiKeys.slot("speller", "key").read()).toBe(`${VALUE}2`);
		await expect(cms.apiKeys.slot("speller", "key").set(other.id)).rejects.toMatchObject({ code: "invalid_input" });
		await cms.apiKeys.slot("speller", "key").set(null);
		expect(await cms.apiKeys.slot("speller", "key").read()).toBe(VALUE);
		await expect(cms.apiKeys.slot("speller", "nope").set(null)).rejects.toMatchObject({ code: "not_found" });
	});

	it("KEY-A4 deleting the key a slot reads asks first, then the slot reads the next key of the service", async () => {
		const cms = cmsWith([speller({ current: "en" })]);
		const key = await add(cms, "A speller", VALUE, "speller");
		await add(cms, "B speller", `${VALUE}2`, "speller");
		await expect(cms.apiKeys.remove(key.id, { expectedVersion: key.version })).rejects.toMatchObject({
			code: "key_in_use",
		});
		await cms.apiKeys.remove(key.id, { expectedVersion: key.version, force: true });
		expect((await cms.apiKeys.slots())[0]?.key?.name).toBe("B speller");
	});

	it("KEY-P1 works out a slot label from the site, in the admin language of the instance", async () => {
		const messages = defineMessages("test.slot", { en: { key: "Spell check" }, ko: { key: "맞춤법 검사" } });
		const plugin = definePlugin({
			name: "speller",
			keySlots: [{ id: "key", service: "speller", label: (site) => site.createTranslator(messages)("key") }],
		});
		const english = fakeCms({
			config: { ...testConfig, plugins: [services, plugin], admin: { locale: "en" } } as never,
			server: { secret: SECRET },
		});
		expect((await english.apiKeys.slots())[0]?.label).toBe("Spell check");
		const korean = fakeCms({
			config: { ...testConfig, plugins: [services, plugin], admin: { locale: "ko" } } as never,
			server: { secret: SECRET },
		});
		expect((await korean.apiKeys.slots())[0]?.label).toBe("맞춤법 검사");
	});

	it("KEY-P1 chooses a slot's key through the route, which answers the whole list without values", async () => {
		const cms = cmsWith([speller({ current: "en" })]);
		await add(cms, "A speller", VALUE, "speller");
		const second = await add(cms, "B speller", `${VALUE}2`, "speller");
		const response = await assign(slotRequest({ plugin: "speller", slot: "key", keyId: second.id }), { cms });
		expect(response.status).toBe(200);
		const text = await response.text();
		expect(text).not.toContain(VALUE);
		const body = JSON.parse(text) as ApiKeyList;
		expect(body.slots[0]?.key?.name).toBe("B speller");
		expect(body.items.find((item) => item.id === second.id)?.uses[0]?.label).toBe("Spell check");
	});

	it("KEY-A4 resolves each label when the keys are read, from the plugin, with what the key serves, and does not show an item that is gone", async () => {
		const models = new Map([["quick", "claude-haiku-5-5"]]);
		const ai = definePlugin({
			name: "ai",
			server: async () => ({
				default: {
					keyUses: async (refs) =>
						Object.fromEntries(
							refs.map((ref) => [ref, models.has(ref) ? { label: "Quick tasks", value: models.get(ref) } : null]),
						),
				},
			}),
		});
		const cms = cmsWith([ai]);
		const key = await add(cms, "Anthropic");
		await cms.apiKeys.setUses("ai", [
			{ ref: "quick", keyId: key.id },
			{ ref: "gone", keyId: key.id },
		]);
		// The stored row has no text, and a change shows at the next read.
		expect(JSON.stringify(await cms.plugin("core-keys").storage.collection("assignments").list())).not.toContain(
			"Quick",
		);
		expect((await cms.apiKeys.get(key.id))?.uses).toEqual([
			{ plugin: "ai", ref: "quick", label: "Quick tasks", value: "claude-haiku-5-5" },
		]);
		models.set("quick", "claude-sonnet-5-5");
		expect((await cms.apiKeys.get(key.id))?.uses[0]?.value).toBe("claude-sonnet-5-5");
		// Reading changes nothing: the use of the item that does not exist is dropped when the plugin reports its items again.
		expect((await cms.plugin("core-keys").storage.collection("assignments").list()).map((item) => item.key)).toEqual([
			"ai:gone",
			"ai:quick",
		]);
	});

	it("KEY-A2 keeps a new key and the item that uses it together in cms.transaction, or neither", async () => {
		const cms = cmsWith();
		const settings = () => cms.plugin("my-plugin").storage.collection<{ keyId: string | null }>("settings");
		await expect(
			cms.transaction(async (tx) => {
				const key = await tx.apiKeys.add({ service: "anthropic", name: "Mine", value: VALUE });
				await tx.storage("my-plugin").collection("settings").set("default", { keyId: key.id }, { expectedVersion: 0 });
				throw new Error("the save failed");
			}),
		).rejects.toThrow("the save failed");
		expect(await cms.apiKeys.list()).toEqual([]);
		expect(await settings().get("default")).toBeNull();
	});
});
