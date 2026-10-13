import { defineSite } from "@monti-cms/core";
import { fakeCms } from "@monti-cms/core/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { baseConfig } from "../../test/cms.config";
import { gitSync } from "../index";
import { migrateGitSync, moveTokenToSlot } from "../migrate";

/**
 * The GitHub token used to be saved in the plugin's own settings, first as ciphertext (`token`, encrypted with `cms.secrets("git-sync")`), then as the id of a key
 * of the API key store (`tokenKeyId`). It is now the key assigned to the plugin's `token` slot, and `monti db:migrate` moves an old one over.
 */
const config = defineSite({ ...baseConfig, plugins: [gitSync({ targets: [] })] });
const SECRET = "a-long-test-secret-for-the-token-move";
const OLD_TOKEN = "ghp_old_token_in_settings_1234";

const setup = (server: { secret?: string; previousSecrets?: string[] } = { secret: SECRET }) => {
	const cms = fakeCms({ config, server });
	const settings = () => cms.storage("git-sync").collection<Record<string, unknown>>("settings");
	/** Settings as they were first saved: the token is ciphertext in the row. */
	const seedOld = async (token: string | null, extra: Record<string, unknown> = {}) => {
		await settings().set(
			"default",
			{ token: token === null ? null : cms.secrets("git-sync").encrypt(token), webhookSecret: null, ...extra },
			{ expectedVersion: 0 },
		);
	};
	/** Settings as they were saved when the token was a key id. */
	const seedKeyId = async (tokenKeyId: string | null, extra: Record<string, unknown> = {}) => {
		await settings().set("default", { tokenKeyId, webhookSecret: null, ...extra }, { expectedVersion: 0 });
	};
	const read = async () => (await settings().get("default"))?.value ?? null;
	const migrate = () => migrateGitSync(cms.storage("git-sync"), cms);
	const slotKey = async () => (await cms.apiKeys.slots()).find((slot) => slot.slot === "token")?.key ?? null;
	return { cms, seedOld, seedKeyId, read, migrate, slotKey };
};

afterEach(() => vi.restoreAllMocks());

describe("moving the token into the key slot", () => {
	it("moves an old encrypted token once: a key named GitHub in the slot, the old token is gone, the webhook secret stays", async () => {
		const { cms, seedOld, read, migrate, slotKey } = setup();
		await seedOld(OLD_TOKEN, { webhookSecret: cms.secrets("git-sync").encrypt("hook") });
		await migrate();

		const keys = await cms.apiKeys.list();
		expect(keys.map((key) => key.name)).toEqual(["GitHub"]);
		expect(await slotKey()).toMatchObject({ id: keys[0]?.id, name: "GitHub" });
		expect(await cms.apiKeys.readSlot("git-sync", "token")).toBe(OLD_TOKEN);
		const row = await read();
		expect(row).not.toHaveProperty("token");
		expect(row).not.toHaveProperty("tokenKeyId");
		expect(JSON.stringify(row)).not.toContain(OLD_TOKEN);
		expect(cms.secrets("git-sync").decrypt(String(row?.webhookSecret))).toBe("hook");
		expect((await cms.apiKeys.get(keys[0]?.id ?? ""))?.slots).toHaveLength(1);
	});

	it("moves a key id of the old settings into the slot and keeps the key itself", async () => {
		const { cms, seedKeyId, read, migrate, slotKey } = setup();
		const key = await cms.apiKeys.add({ name: "Team token", value: OLD_TOKEN });
		await seedKeyId(key.id, { webhookSecret: cms.secrets("git-sync").encrypt("hook") });
		await migrate();
		expect(await slotKey()).toMatchObject({ id: key.id, name: "Team token" });
		expect(await cms.apiKeys.list()).toHaveLength(1);
		const row = await read();
		expect(row).not.toHaveProperty("tokenKeyId");
		expect(cms.secrets("git-sync").decrypt(String(row?.webhookSecret))).toBe("hook");
	});

	it("can be repeated: the second run changes nothing", async () => {
		const { cms, seedOld, read, migrate, slotKey } = setup();
		await seedOld(OLD_TOKEN);
		expect(await moveTokenToSlot(cms.storage("git-sync"), cms)).toBe(1);
		const afterFirst = await cms.storage("git-sync").collection("settings").get("default");
		const slotAfterFirst = await slotKey();
		expect(await moveTokenToSlot(cms.storage("git-sync"), cms)).toBe(0);
		await migrate();
		expect(await cms.apiKeys.list()).toHaveLength(1);
		expect(await slotKey()).toEqual(slotAfterFirst);
		expect((await cms.storage("git-sync").collection("settings").get("default"))?.version).toBe(afterFirst?.version);
		expect(await read()).toEqual(afterFirst?.value);
	});

	it("shares a key that already has the same value instead of adding another", async () => {
		const { cms, seedOld, migrate, slotKey } = setup();
		const existing = await cms.apiKeys.add({ name: "Team token", value: OLD_TOKEN });
		await seedOld(OLD_TOKEN);
		await migrate();
		expect(await cms.apiKeys.list()).toHaveLength(1);
		expect(await slotKey()).toMatchObject({ id: existing.id });
	});

	it("names the key GitHub 2 when GitHub is taken by another value", async () => {
		const { cms, seedOld, migrate, slotKey } = setup();
		await cms.apiKeys.add({ name: "GitHub", value: "ghp_some_other_token_9999" });
		await seedOld(OLD_TOKEN);
		await migrate();
		expect(await slotKey()).toMatchObject({ name: "GitHub 2" });
		expect(await cms.apiKeys.readSlot("git-sync", "token")).toBe(OLD_TOKEN);
	});

	it("does not touch a slot that has a key already", async () => {
		const { cms, seedOld, read, migrate, slotKey } = setup();
		const chosen = await cms.apiKeys.add({ name: "Chosen", value: "ghp_chosen_token_5555" });
		await cms.apiKeys.setSlot("git-sync", "token", chosen.id);
		await seedOld(OLD_TOKEN);
		await migrate();
		expect(await slotKey()).toMatchObject({ id: chosen.id });
		expect(await cms.apiKeys.list()).toHaveLength(1);
		expect(await read()).not.toHaveProperty("token");
	});

	it("only drops the old fields when there was no token, or the key of the old settings is gone", async () => {
		const none = setup();
		await none.seedOld(null);
		await none.migrate();
		expect(await none.cms.apiKeys.list()).toEqual([]);
		expect(await none.slotKey()).toBeNull();
		expect(await none.read()).not.toHaveProperty("token");

		const gone = setup();
		await gone.seedKeyId("deleted-key-id");
		await gone.migrate();
		expect(await gone.slotKey()).toBeNull();
		expect(await gone.read()).not.toHaveProperty("tokenKeyId");
	});

	it("warns and leaves the token where it is when it cannot be decrypted", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
		const { cms, seedOld, read, migrate, slotKey } = setup();
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
		expect(await slotKey()).not.toBeNull();
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
		expect(await rotated.apiKeys.readSlot("git-sync", "token")).toBe(OLD_TOKEN);
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
