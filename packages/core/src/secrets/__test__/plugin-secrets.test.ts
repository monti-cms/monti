import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createCms } from "../../cms";
import type { CmsServerConfig } from "../../server/define";
import { createSecretsVault, type LegacySecretFormat } from "../plugin-secrets";

const vault = (secret: string | undefined, previousSecrets?: readonly string[]) =>
	createSecretsVault({ secret, previousSecrets });

/** A value as the AI plugin stored it before per-plugin keys: `v1:<iv>:<tag>:<body>` under `sha256("cms-ai-key:" + secret)`. */
function legacyValue(plain: string, secret: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(`cms-ai-key:${secret}`).digest(), iv);
	const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
	return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(":");
}

const LEGACY: LegacySecretFormat = { prefix: "v1", domain: "cms-ai-key:" };

describe("plugin secrets: one key per plugin", () => {
	it("encrypts and decrypts with the plugin's own key, and never stores the plain text", () => {
		const ai = vault("master").forPlugin("ai");
		const stored = ai.encrypt("sk-live-1234");
		expect(stored).not.toContain("sk-live");
		expect(ai.decrypt(stored)).toBe("sk-live-1234");
		// Each encryption uses a fresh nonce.
		expect(ai.encrypt("sk-live-1234")).not.toBe(stored);
	});

	it("gives two plugins different keys from the same master secret", () => {
		const secrets = vault("master");
		const ai = secrets.forPlugin("ai");
		const seo = secrets.forPlugin("seo");
		expect(ai.deriveKey("signing").equals(seo.deriveKey("signing"))).toBe(false);
		expect(ai.deriveKey("signing").equals(ai.deriveKey("hashing"))).toBe(false);
		expect(ai.deriveKey("signing").equals(secrets.forPlugin("ai").deriveKey("signing"))).toBe(true);
		expect(ai.deriveKey("signing")).toHaveLength(32);
		// The key id written in front of a value differs too.
		expect(ai.encrypt("x").split(":")[1]).not.toBe(seo.encrypt("x").split(":")[1]);
	});

	it("keeps a plugin from decrypting another plugin's value, and a value from another master secret", () => {
		const secrets = vault("master");
		const stored = secrets.forPlugin("ai").encrypt("sk-live-1234");
		expect(secrets.forPlugin("seo").decrypt(stored)).toBeNull();
		expect(vault("other").forPlugin("ai").decrypt(stored)).toBeNull();
	});

	it("does not decrypt a value whose key id was edited to match another plugin's key", () => {
		const secrets = vault("master");
		const [prefix, , iv, tag, body] = secrets.forPlugin("ai").encrypt("x").split(":");
		const seoId = secrets.forPlugin("seo").encrypt("x").split(":")[1];
		expect(secrets.forPlugin("seo").decrypt([prefix, seoId, iv, tag, body].join(":"))).toBeNull();
	});

	it("returns null for corrupted or foreign text instead of throwing", () => {
		const ai = vault("master").forPlugin("ai");
		const stored = ai.encrypt("x");
		expect(ai.decrypt(`${stored.slice(0, -4)}AAAA`)).toBeNull();
		expect(ai.decrypt("plain text")).toBeNull();
		expect(ai.decrypt("mk1:id")).toBeNull();
		expect(ai.decrypt("")).toBeNull();
	});

	it("refuses to encrypt or derive keys without a secret, and rejects an invalid plugin name", () => {
		const ai = vault(undefined).forPlugin("ai");
		expect(ai.available).toBe(false);
		expect(() => ai.encrypt("x")).toThrow(/secret/);
		expect(() => ai.deriveKey("signing")).toThrow(/secret/);
		expect(ai.decrypt(vault("master").forPlugin("ai").encrypt("x"))).toBeNull();
		expect(() => vault("master").forPlugin("Bad Name")).toThrow(/invalid plugin name/);
	});
});

describe("plugin secrets: rotation", () => {
	it("decrypts values made with a previous secret and tells that they are not current", () => {
		const old = vault("old-secret").forPlugin("ai").encrypt("sk-live-1234");
		const rotated = vault("new-secret", ["old-secret"]).forPlugin("ai");
		expect(rotated.decrypt(old)).toBe("sk-live-1234");
		expect(rotated.isCurrent(old)).toBe(false);

		const upgraded = rotated.encrypt(rotated.decrypt(old) ?? "");
		expect(rotated.isCurrent(upgraded)).toBe(true);
		// Once re-encrypted, the previous secret is no longer needed.
		expect(vault("new-secret").forPlugin("ai").decrypt(upgraded)).toBe("sk-live-1234");
	});

	it("cannot read values of a secret that is neither current nor listed", () => {
		const old = vault("old-secret").forPlugin("ai").encrypt("x");
		expect(vault("new-secret").forPlugin("ai").decrypt(old)).toBeNull();
		expect(vault("new-secret", ["unrelated"]).forPlugin("ai").decrypt(old)).toBeNull();
	});

	it("reads through several rotations, and still keeps plugins apart", () => {
		const first = vault("first").forPlugin("ai").encrypt("a");
		const second = vault("second", ["first"]).forPlugin("ai").encrypt("b");
		const third = vault("third", ["second", "first"]).forPlugin("ai");
		expect([third.decrypt(first), third.decrypt(second)]).toEqual(["a", "b"]);
		expect(vault("third", ["second", "first"]).forPlugin("seo").decrypt(first)).toBeNull();
	});

	it("an instance without a current secret can still read values of its previous secrets", () => {
		const old = vault("old").forPlugin("ai").encrypt("x");
		const readOnly = vault(undefined, ["old"]).forPlugin("ai");
		expect(readOnly.decrypt(old)).toBe("x");
		expect(readOnly.isCurrent(old)).toBe(false);
	});
});

describe("plugin secrets: legacy values", () => {
	it("reads a plugin's old-format value with its declared legacy format, and says it is not current", () => {
		const stored = legacyValue("sk-live-1234", "master");
		const ai = vault("master").forPlugin("ai", { legacy: LEGACY });
		expect(ai.decrypt(stored)).toBe("sk-live-1234");
		expect(ai.isCurrent(stored)).toBe(false);
		expect(ai.isCurrent(ai.encrypt("sk-live-1234"))).toBe(true);
	});

	it("reads an old-format value made with a previous secret", () => {
		const stored = legacyValue("sk-live-1234", "old");
		expect(vault("new", ["old"]).forPlugin("ai", { legacy: LEGACY }).decrypt(stored)).toBe("sk-live-1234");
	});

	it("does not read old-format values for a plugin that did not declare the legacy format", () => {
		expect(vault("master").forPlugin("ai").decrypt(legacyValue("x", "master"))).toBeNull();
		expect(
			vault("master")
				.forPlugin("seo", { legacy: { prefix: "v1", domain: "other:" } })
				.decrypt(legacyValue("x", "master")),
		).toBeNull();
	});
});

describe("the CMS instance does not hand out the master secret", () => {
	const server = {
		database: { name: "x", createStore: () => ({}), migrate: async () => undefined, pluginDatabase: () => ({}) },
		auth: { name: "x", create: () => ({}) },
		secret: "master-secret",
		previousSecrets: ["older-secret"],
	} as unknown as CmsServerConfig;

	it("has no raw secret on the instance or in its server config view", () => {
		const cms = createCms({ server });
		expect("secret" in cms).toBe(false);
		expect(JSON.stringify(Object.keys(cms.server))).not.toMatch(/secret/i);
		expect(Object.values(cms.server)).not.toContain("master-secret");
		expect(Object.values(cms.server)).not.toContain("older-secret");
	});

	it("gives each plugin its own key and honors previousSecrets", () => {
		const before = createCms({ server: { ...server, secret: "older-secret", previousSecrets: undefined } });
		const after = createCms({ server });
		const stored = before.secrets("ai").encrypt("x");
		expect(after.secrets("ai").decrypt(stored)).toBe("x");
		expect(after.secrets("seo").decrypt(stored)).toBeNull();
	});
});
