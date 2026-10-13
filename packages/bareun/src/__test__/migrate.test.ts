// @vitest-environment node

import { defineSite } from "@monti-cms/core";
import { fakeCms } from "@monti-cms/core/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testConfig, testSite } from "../../test/site";
import { bareun } from "../index";
import { bareunMessages } from "../messages";
import bareunServer from "../server";
import { getSettingsView, readApiKey } from "../settings";

const OLD_KEY = "old-env-key-123456789";

const cmsWith = (secret = "test-secret-for-bareun") =>
	fakeCms({ config: defineSite({ ...testConfig, plugins: [bareun()] }), server: secret ? { secret } : {} });

const migrate = (cms: ReturnType<typeof cmsWith>) => {
	expect(bareunServer.migrate).toBeDefined();
	return bareunServer.migrate?.(cms.storage("text-check-bareun"), cms);
};

describe("Bareun migration of the old environment variable", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("moves the key of BAREUN_API_KEY into the key store once, and is repeatable", async () => {
		vi.stubEnv("BAREUN_API_KEY", `  ${OLD_KEY} `);
		const cms = cmsWith();
		await migrate(cms);
		await migrate(cms);

		const keys = await cms.apiKeys.list();
		expect(keys.map((key) => key.name)).toEqual(["Bareun"]);
		expect(await readApiKey(cms)).toBe(OLD_KEY);
		expect((await getSettingsView(cms)).key?.name).toBe("Bareun");
		expect(keys[0]?.uses.map((use) => use.label)).toEqual([testSite.createTranslator(bareunMessages)("keyUse")]);
	});

	it("reuses a key that already has the same value", async () => {
		vi.stubEnv("BAREUN_API_KEY", OLD_KEY);
		const cms = cmsWith();
		const existing = await cms.apiKeys.add({ name: "Mine", value: OLD_KEY });
		await migrate(cms);
		expect((await cms.apiKeys.list()).map((key) => key.id)).toEqual([existing.id]);
		expect((await getSettingsView(cms)).key?.id).toBe(existing.id);
	});

	it("does nothing when the variable is unset or empty", async () => {
		vi.stubEnv("BAREUN_API_KEY", "  ");
		const cms = cmsWith();
		await migrate(cms);
		expect(await cms.apiKeys.list()).toEqual([]);
		expect((await getSettingsView(cms)).key).toBeNull();
	});

	it("does not replace a key that is already chosen", async () => {
		const cms = cmsWith();
		const chosen = await cms.apiKeys.add({ name: "Chosen", value: "chosen-key-123456789" });
		await cms
			.storage("text-check-bareun")
			.collection("settings")
			.set("default", { keyId: chosen.id }, { expectedVersion: 0 });
		vi.stubEnv("BAREUN_API_KEY", OLD_KEY);
		await migrate(cms);
		expect((await getSettingsView(cms)).key?.id).toBe(chosen.id);
		expect(await cms.apiKeys.list()).toHaveLength(1);
	});

	it("does nothing when the server has no secret to encrypt keys with", async () => {
		vi.stubEnv("BAREUN_API_KEY", OLD_KEY);
		const cms = cmsWith("");
		expect(cms.apiKeys.available).toBe(false);
		await migrate(cms);
		expect(await cms.apiKeys.list()).toEqual([]);
	});
});
