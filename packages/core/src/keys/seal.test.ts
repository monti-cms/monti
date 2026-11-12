import { describe, expect, it } from "vitest";
import { seal, unseal } from "./seal";

describe("sealing a key", () => {
	it("14-4 a sealed key reads as nothing of the key, and only the secret that sealed it opens it", async () => {
		const sealed = await seal("server-secret", "sk-ant-api03-abcdef-a1b2");
		expect(sealed).not.toContain("a1b2");
		expect(sealed).not.toContain("sk-ant");
		expect(await unseal("server-secret", sealed)).toBe("sk-ant-api03-abcdef-a1b2");
		expect(await unseal("another-secret", sealed)).toBeNull();
	});

	it("14-4 the same key sealed twice reads differently, so two rows do not tell they hold one key", async () => {
		const [one, two] = await Promise.all([seal("s", "the-same-key"), seal("s", "the-same-key")]);
		expect(one).not.toBe(two);
	});

	it("a value that was never sealed, or was cut, opens as nothing rather than failing", async () => {
		const sealed = await seal("s", "key");
		expect(await unseal("s", "plain text")).toBeNull();
		expect(await unseal("s", sealed.slice(0, -4))).toBeNull();
		expect(await unseal("s", `v2.${sealed.slice(3)}`)).toBeNull();
	});

	it.each(["", "  "])("14-4 an empty secret (%j) seals nothing and opens nothing", async (empty) => {
		await expect(seal(empty, "sk-ant-api03-abcdef-a1b2")).rejects.toThrow(/empty secret/);
		expect(await unseal(empty, await seal("s", "key"))).toBeNull();
	});

	it("an empty key (a service that needs none) seals and opens as empty", async () => {
		expect(await unseal("s", await seal("s", ""))).toBe("");
	});
});
