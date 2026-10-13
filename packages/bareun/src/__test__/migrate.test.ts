// @vitest-environment node

import { defineSite } from "@monti-cms/core";
import { fakeCms } from "@monti-cms/core/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig } from "../../test/site";
import { bareun } from "../index";
import bareunServer from "../server";

const OLD_KEY = "old-env-key-123456789";
const PLUGIN = "text-check-bareun";

const cmsWith = (secret = "test-secret-for-bareun") =>
	fakeCms({ config: defineSite({ ...testConfig, plugins: [bareun()] }), server: secret ? { secret } : {} });

const migrate = (cms: ReturnType<typeof cmsWith>) => {
	expect(bareunServer.migrate).toBeDefined();
	return bareunServer.migrate?.(cms.storage(PLUGIN), cms);
};

const legacySettings = (cms: ReturnType<typeof cmsWith>) => cms.storage(PLUGIN).collection("settings");

describe("Bareun migration into the key slot", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("moves the key of BAREUN_API_KEY into the key store and the slot once, and is repeatable", async () => {
		vi.stubEnv("BAREUN_API_KEY", `  ${OLD_KEY} `);
		const cms = cmsWith();
		await migrate(cms);
		await migrate(cms);

		const keys = await cms.apiKeys.list();
		expect(keys.map((key) => key.name)).toEqual(["Bareun"]);
		expect(await cms.apiKeys.readSlot(PLUGIN, "key")).toBe(OLD_KEY);
		expect((await cms.apiKeys.slots())[0]?.key?.name).toBe("Bareun");
	});

	it("does not bring the key back from the variable after it was cleared in the admin", async () => {
		vi.stubEnv("BAREUN_API_KEY", OLD_KEY);
		const cms = cmsWith();
		await migrate(cms);
		expect(await cms.apiKeys.readSlot(PLUGIN, "key")).toBe(OLD_KEY);

		await cms.apiKeys.setSlot(PLUGIN, "key", null);
		await migrate(cms);
		expect(await cms.apiKeys.readSlot(PLUGIN, "key")).toBeNull();
	});

	it("reuses a key that already has the same value", async () => {
		vi.stubEnv("BAREUN_API_KEY", OLD_KEY);
		const cms = cmsWith();
		const existing = await cms.apiKeys.add({ name: "Mine", value: OLD_KEY });
		await migrate(cms);
		expect((await cms.apiKeys.list()).map((key) => key.id)).toEqual([existing.id]);
		expect((await cms.apiKeys.slots())[0]?.key?.id).toBe(existing.id);
	});

	it("does nothing when the variable is unset or empty", async () => {
		vi.stubEnv("BAREUN_API_KEY", "  ");
		const cms = cmsWith();
		await migrate(cms);
		expect(await cms.apiKeys.list()).toEqual([]);
		expect(await cms.apiKeys.readSlot(PLUGIN, "key")).toBeNull();
	});

	it("does not replace a key that is already assigned", async () => {
		const cms = cmsWith();
		const chosen = await cms.apiKeys.add({ name: "Chosen", value: "chosen-key-123456789" });
		await cms.apiKeys.setSlot(PLUGIN, "key", chosen.id);
		vi.stubEnv("BAREUN_API_KEY", OLD_KEY);
		await migrate(cms);
		expect((await cms.apiKeys.slots())[0]?.key?.id).toBe(chosen.id);
		expect(await cms.apiKeys.list()).toHaveLength(1);
	});

	it("does nothing when the server has no secret to encrypt keys with", async () => {
		vi.stubEnv("BAREUN_API_KEY", OLD_KEY);
		const cms = cmsWith("");
		expect(cms.apiKeys.available).toBe(false);
		await migrate(cms);
		expect(await cms.apiKeys.list()).toEqual([]);
	});

	it("moves the key chosen on the old Tools page to the slot and removes the old settings item", async () => {
		const cms = cmsWith();
		const chosen = await cms.apiKeys.add({ name: "Chosen", value: "chosen-key-123456789" });
		await legacySettings(cms).set("default", { keyId: chosen.id }, { expectedVersion: 0 });
		vi.stubEnv("BAREUN_API_KEY", OLD_KEY);
		await migrate(cms);
		await migrate(cms);
		expect((await cms.apiKeys.slots())[0]?.key?.id).toBe(chosen.id);
		expect(await legacySettings(cms).get("default")).toBeNull();
		expect(await cms.apiKeys.list()).toHaveLength(1);
	});

	it("removes an old settings item that chose no key or a deleted key, without assigning anything", async () => {
		const cms = cmsWith();
		await legacySettings(cms).set("default", { keyId: "gone" }, { expectedVersion: 0 });
		await migrate(cms);
		expect(await legacySettings(cms).get("default")).toBeNull();
		expect(await cms.apiKeys.readSlot(PLUGIN, "key")).toBeNull();
	});

	it("leaves a slot that is already assigned alone when an old settings item names another key", async () => {
		const cms = cmsWith();
		const current = await cms.apiKeys.add({ name: "Current", value: "current-key-123456789" });
		const old = await cms.apiKeys.add({ name: "Old", value: "old-key-123456789012" });
		await cms.apiKeys.setSlot(PLUGIN, "key", current.id);
		await legacySettings(cms).set("default", { keyId: old.id }, { expectedVersion: 0 });
		await migrate(cms);
		expect((await cms.apiKeys.slots())[0]?.key?.id).toBe(current.id);
		expect(await legacySettings(cms).get("default")).toBeNull();
	});
});
