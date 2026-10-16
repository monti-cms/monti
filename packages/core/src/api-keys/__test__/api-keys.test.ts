import { describe, expect, it } from "vitest";
import { fakeCms } from "../../cms";
import type { ApiKeyList, ApiKeyView } from "../../core/api-keys";
import { PATCH as patchKeyHandler, DELETE as removeKeyHandler } from "../../http/v1/api-keys/[id]/route";
import { GET as listKeysHandler, POST as postKeyHandler } from "../../http/v1/api-keys/route";
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
	it("keeps the value encrypted in storage and never returns it", async () => {
		const cms = cmsWithSecret();
		const view = await cms.apiKeys.add({ name: "Anthropic", value: VALUE });
		expect(JSON.stringify(view)).not.toContain(VALUE);
		expect(view.tail).toBe("3f9a");

		const stored = await cms.storage("core-keys").collection<{ secret: string }>("keys").get(view.id);
		expect(stored?.value.secret).not.toContain(VALUE);
		expect(JSON.stringify(await cms.apiKeys.list())).not.toContain(VALUE);
		expect(await cms.apiKeys.read(view.id)).toBe(VALUE);
	});

	it("shows no tail for a value too short to show any of it", async () => {
		const cms = cmsWithSecret();
		expect((await cms.apiKeys.add({ name: "Short", value: "abcd1234" })).tail).toBe("");
	});

	it("refuses to save without a server secret and says how to fix it", async () => {
		const cms = fakeCms();
		expect(cms.apiKeys.available).toBe(false);
		await expect(cms.apiKeys.add({ name: "X", value: VALUE })).rejects.toMatchObject({ code: "secret_not_configured" });
	});

	it("rejects a taken name, and picks a free one when the place chooses the name", async () => {
		const cms = cmsWithSecret();
		await cms.apiKeys.add({ name: "Anthropic", value: VALUE });
		await expect(cms.apiKeys.add({ name: "anthropic", value: VALUE })).rejects.toMatchObject({
			code: "key_name_taken",
		});
		const second = await cms.apiKeys.addNamed({ baseName: "Anthropic", value: `${VALUE}2` });
		const third = await cms.apiKeys.addNamed({ baseName: "Anthropic", value: `${VALUE}3` });
		expect([second.name, third.name]).toEqual(["Anthropic 2", "Anthropic 3"]);
	});

	it("keeps names unique without regard to case, also when two keys are saved at the same moment", async () => {
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

	it("frees a name when its key is renamed or deleted", async () => {
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

	it("reuses a key that has the same value, and names a new one when there is none", async () => {
		const cms = cmsWithSecret();
		const first = await cms.apiKeys.findOrAdd({ baseName: "GitHub", value: VALUE });
		expect((await cms.apiKeys.findOrAdd({ baseName: "Other", value: VALUE })).id).toBe(first.id);
		expect((await cms.apiKeys.findOrAdd({ baseName: "GitHub", value: `${VALUE}2` })).name).toBe("GitHub 2");
	});

	it("refuses to delete a key that is used unless forced, and deletes the key with its uses together", async () => {
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

	it("renames and replaces the value under the same id, keeping the places that use it", async () => {
		const cms = cmsWithSecret();
		const key = await cms.apiKeys.add({ name: "Bareun", value: VALUE });
		await cms.apiKeys.setUses("text-check-bareun", [{ ref: "key", keyId: key.id }]);

		const renamed = await cms.apiKeys.update(key.id, { expectedVersion: key.version, name: "Bareun main" });
		const replaced = await cms.apiKeys.update(key.id, {
			expectedVersion: renamed.version,
			value: "brn-0000000000007777",
		});
		expect(replaced.id).toBe(key.id);
		expect(replaced.name).toBe("Bareun main");
		expect(replaced.tail).toBe("7777");
		expect(replaced.uses).toEqual([{ plugin: "text-check-bareun", ref: "key", label: "text-check-bareun" }]);
		expect(await cms.apiKeys.read(key.id)).toBe("brn-0000000000007777");
		await expect(cms.apiKeys.update(key.id, { expectedVersion: key.version, name: "stale" })).rejects.toMatchObject({
			code: "conflict",
		});
	});

	it("tells which places use a key, replaces a plugin's places as a whole, and ignores a place that names no key", async () => {
		const cms = cmsWithSecret();
		const key = await cms.apiKeys.add({ name: "Anthropic", value: VALUE });
		await cms.apiKeys.setUses("ai", [
			{ ref: "connection:a", keyId: key.id },
			{ ref: "connection:b", keyId: key.id },
			{ ref: "connection:c", keyId: "no-such-key" },
		]);
		await cms.apiKeys.setUses("git-sync", [{ ref: "token", keyId: key.id }]);
		expect((await cms.apiKeys.get(key.id))?.uses.map((use) => `${use.plugin}:${use.ref}`).sort()).toEqual([
			"ai:connection:a",
			"ai:connection:b",
			"git-sync:token",
		]);

		await cms.apiKeys.setUses("ai", [{ ref: "connection:a", keyId: key.id }]);
		expect((await cms.apiKeys.get(key.id))?.uses.map((use) => use.plugin).sort()).toEqual(["ai", "git-sync"]);
	});

	it("deleting a key forgets where it was used, and the value is gone", async () => {
		const cms = cmsWithSecret();
		const key = await cms.apiKeys.add({ name: "Anthropic", value: VALUE });
		await cms.apiKeys.setUses("ai", [{ ref: "connection:a", keyId: key.id }]);
		await cms.apiKeys.remove(key.id, { expectedVersion: key.version, force: true });
		expect(await cms.apiKeys.read(key.id)).toBeNull();
		expect(await cms.storage("core-keys").collection("assignments").list()).toEqual([]);
	});

	it("reports a value that cannot be decrypted any more as unreadable", async () => {
		const storage = fakeCms().storage;
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
	it("creates, lists and renames keys without ever returning the value", async () => {
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

	it("answers 409 key_in_use with the places that would stop working, and deletes only when forced", async () => {
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

	it("deletes a key nothing uses without asking", async () => {
		const cms = cmsWithSecret();
		const key = await cms.apiKeys.add({ name: "Spare", value: VALUE });
		const response = await removeKey(request("DELETE", `api-keys/${key.id}?expectedVersion=${key.version}`), {
			cms,
			params: Promise.resolve({ id: key.id }),
		});
		expect(response.status).toBe(204);
	});
});
