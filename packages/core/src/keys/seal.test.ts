import { describe, expect, it } from "vitest";
import { type KeyBinding, seal, unseal } from "./seal";

const ROW: KeyBinding = { id: "key-1", service: "anthropic", baseUrl: null };

describe("sealing a key", () => {
	it("14-4 a sealed key reads as nothing of the key, and only the secret that sealed it opens it", async () => {
		const sealed = await seal("server-secret", "sk-ant-api03-abcdef-a1b2", ROW);
		expect(sealed).not.toContain("a1b2");
		expect(sealed).not.toContain("sk-ant");
		expect(await unseal("server-secret", sealed, ROW)).toBe("sk-ant-api03-abcdef-a1b2");
		expect(await unseal("another-secret", sealed, ROW)).toBeNull();
	});

	it("14-4 the same key sealed twice reads differently, so two rows do not tell they hold one key", async () => {
		const [one, two] = await Promise.all([seal("s", "the-same-key", ROW), seal("s", "the-same-key", ROW)]);
		expect(one).not.toBe(two);
	});

	it("14-4 a sealed key opens only in the row it was sealed for: another id, service or address opens nothing", async () => {
		const compatible: KeyBinding = { id: "key-1", service: "openai-compatible", baseUrl: "http://x.test/v1" };
		const sealed = await seal("s", "the-key", compatible);
		expect(await unseal("s", sealed, compatible)).toBe("the-key");
		expect(await unseal("s", sealed, { ...compatible, baseUrl: "http://evil.test/v1" })).toBeNull();
		expect(await unseal("s", sealed, { ...compatible, baseUrl: null })).toBeNull();
		expect(await unseal("s", sealed, { ...compatible, service: "anthropic" })).toBeNull();
		expect(await unseal("s", sealed, { ...compatible, id: "key-2" })).toBeNull();
		// The parts are told apart, not run together: an id that ends where a service begins is another row.
		const joined = await seal("s", "k", { id: "a", service: "bc", baseUrl: null });
		expect(await unseal("s", joined, { id: "ab", service: "c", baseUrl: null })).toBeNull();
	});

	it("a value that was never sealed, or was cut, opens as nothing rather than failing", async () => {
		const sealed = await seal("s", "key", ROW);
		expect(await unseal("s", "plain text", ROW)).toBeNull();
		expect(await unseal("s", sealed.slice(0, -4), ROW)).toBeNull();
		expect(await unseal("s", `v2.${sealed.slice(3)}`, ROW)).toBeNull();
	});

	it.each(["", "  "])("14-4 an empty secret (%j) seals nothing and opens nothing", async (empty) => {
		await expect(seal(empty, "sk-ant-api03-abcdef-a1b2", ROW)).rejects.toThrow(/empty secret/);
		expect(await unseal(empty, await seal("s", "key", ROW), ROW)).toBeNull();
	});

	it("an empty key (a service that needs none) seals and opens as empty", async () => {
		expect(await unseal("s", await seal("s", "", ROW), ROW)).toBe("");
	});
});
