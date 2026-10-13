import { fakeCms } from "@monti-cms/core/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import config from "../../test/cms.config";
import { migrateGitSync, moveTokenToStore } from "../migrate";

/**
 * The GitHub token used to be saved in the plugin's own settings, encrypted with `cms.secrets("git-sync")`. It now lives in the central API key store, and
 * `monti db:migrate` moves an old one over.
 */
const SECRET = "a-long-test-secret-for-the-token-move";
const OLD_TOKEN = "ghp_old_token_in_settings_1234";

const setup = (server: { secret?: string; previousSecrets?: string[] } = { secret: SECRET }) => {
	const cms = fakeCms({ config, server });
	const settings = () => cms.storage("git-sync").collection<Record<string, unknown>>("settings");
	/** Settings as they were saved before the token moved: the token is ciphertext in the row. */
	const seedOld = async (token: string | null, extra: Record<string, unknown> = {}) => {
		await settings().set(
			"default",
			{ token: token === null ? null : cms.secrets("git-sync").encrypt(token), webhookSecret: null, ...extra },
			{ expectedVersion: 0 },
		);
	};
	const read = async () => (await settings().get("default"))?.value ?? null;
	const migrate = () => migrateGitSync(cms.storage("git-sync"), cms);
	return { cms, seedOld, read, migrate };
};

afterEach(() => vi.restoreAllMocks());

describe("moving the token into the API key store", () => {
	it("moves an old encrypted token once: a key named GitHub, the settings keep its id, the old token is gone", async () => {
		const { cms, seedOld, read, migrate } = setup();
		await seedOld(OLD_TOKEN, { webhookSecret: cms.secrets("git-sync").encrypt("hook") });
		await migrate();

		const keys = await cms.apiKeys.list();
		expect(keys.map((key) => key.name)).toEqual(["GitHub"]);
		const key = keys[0];
		expect(await cms.apiKeys.read(key?.id ?? "")).toBe(OLD_TOKEN);
		const row = await read();
		expect(row).toMatchObject({ tokenKeyId: key?.id });
		expect(row).not.toHaveProperty("token");
		expect(JSON.stringify(row)).not.toContain(OLD_TOKEN);
		// The webhook secret is the plugin's own and stays as it was.
		expect(cms.secrets("git-sync").decrypt(String(row?.webhookSecret))).toBe("hook");
		expect((await cms.apiKeys.get(key?.id ?? ""))?.uses).toEqual([
			expect.objectContaining({ plugin: "git-sync", slot: "token" }),
		]);
	});

	it("can be repeated: the second run changes nothing", async () => {
		const { cms, seedOld, read, migrate } = setup();
		await seedOld(OLD_TOKEN);
		expect(await moveTokenToStore(cms.storage("git-sync"), cms)).toBe(1);
		const afterFirst = await cms.storage("git-sync").collection("settings").get("default");
		expect(await moveTokenToStore(cms.storage("git-sync"), cms)).toBe(0);
		await migrate();
		expect(await cms.apiKeys.list()).toHaveLength(1);
		expect((await cms.storage("git-sync").collection("settings").get("default"))?.version).toBe(afterFirst?.version);
		expect(await read()).toEqual(afterFirst?.value);
	});

	it("shares a key that already has the same value instead of adding another", async () => {
		const { cms, seedOld, read, migrate } = setup();
		const existing = await cms.apiKeys.add({ name: "Team token", value: OLD_TOKEN });
		await seedOld(OLD_TOKEN);
		await migrate();
		expect(await cms.apiKeys.list()).toHaveLength(1);
		expect(await read()).toMatchObject({ tokenKeyId: existing.id });
	});

	it("names the key GitHub 2 when GitHub is taken by another value", async () => {
		const { cms, seedOld, read, migrate } = setup();
		await cms.apiKeys.add({ name: "GitHub", value: "ghp_some_other_token_9999" });
		await seedOld(OLD_TOKEN);
		await migrate();
		const moved = (await cms.apiKeys.list()).find((key) => key.name === "GitHub 2");
		expect(await cms.apiKeys.read(moved?.id ?? "")).toBe(OLD_TOKEN);
		expect(await read()).toMatchObject({ tokenKeyId: moved?.id });
	});

	it("only drops the old field when there was no token", async () => {
		const { cms, seedOld, read, migrate } = setup();
		await seedOld(null);
		await migrate();
		expect(await cms.apiKeys.list()).toEqual([]);
		const row = await read();
		expect(row).toMatchObject({ tokenKeyId: null });
		expect(row).not.toHaveProperty("token");
	});

	it("warns and leaves the token where it is when it cannot be decrypted", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { cms, seedOld, read, migrate } = setup();
		await seedOld(OLD_TOKEN);
		// The server secret changed without keeping the old one.
		const changed = fakeCms({
			config,
			server: { secret: "another-long-secret-for-the-test-case" },
			storage: () => cms.storage("git-sync"),
		});
		await migrateGitSync(changed.storage("git-sync"), changed);
		expect(warn).toHaveBeenCalledOnce();
		expect(await changed.apiKeys.list()).toEqual([]);
		expect(await read()).toHaveProperty("token");
		await migrate();
		expect(await cms.apiKeys.list()).toHaveLength(1);
	});

	it("reads a token saved under a previous secret", async () => {
		const { cms, seedOld } = setup();
		await seedOld(OLD_TOKEN);
		const rotated = fakeCms({
			config,
			server: { secret: "another-long-secret-for-the-test-case", previousSecrets: [SECRET] },
			storage: () => cms.storage("git-sync"),
		});
		await migrateGitSync(rotated.storage("git-sync"), rotated);
		const [key] = await rotated.apiKeys.list();
		expect(await rotated.apiKeys.read(key?.id ?? "")).toBe(OLD_TOKEN);
	});

	it("does nothing without a server secret or without saved settings", async () => {
		const bare = setup({});
		await bare.migrate();
		expect(await bare.read()).toBeNull();
		const { cms, migrate } = setup();
		await migrate();
		expect(await cms.apiKeys.list()).toEqual([]);
	});
});
