import type { ApiKeyList } from "@monti-cms/core/site";
import { describe, expect, it } from "vitest";
import { formatTokens, hostOf, slotRows } from "../key-rows";

describe("key rows", () => {
	it("KEY-U1 shows this month's tokens with three significant digits, in K and M", () => {
		const site = { ADMIN_LOCALE: "en" } as never;
		expect([0, 999, 1_000, 312_400, 1_240_000, 12_345_678].map((tokens) => formatTokens(site, tokens))).toEqual([
			"0",
			"999",
			"1K",
			"312K",
			"1.24M",
			"12.3M",
		]);
	});

	it("KEY-C2 names an OpenAI-compatible key after its host, and nothing while the address is not one yet", () => {
		expect(hostOf("http://localhost:11434/v1")).toBe("localhost:11434");
		expect(hostOf(" https://llm.example.dev/v1 ")).toBe("llm.example.dev");
		expect(hostOf("localhost")).toBe("");
	});

	it("KEY-W3 titles a slot by its service, adds the slot's name only when its plugin asks for several keys, and offers the keys of that service", () => {
		const key = (id: string, service: string) => ({ id, service }) as ApiKeyList["items"][number];
		const list = {
			items: [key("a", "anthropic"), key("s", "search")],
			services: [
				{ id: "speller", label: "Speller", group: "plugin" },
				{ id: "search", label: "Search", group: "plugin" },
			],
			slots: [
				{ plugin: "speller", slot: "key", label: "Spell check", service: "speller", key: null },
				{ plugin: "search", slot: "read", label: "Search key", service: "search", key: null },
				{ plugin: "search", slot: "admin", label: "Admin key", service: "search", key: null },
			],
			secretsAvailable: true,
		} as ApiKeyList;
		expect(slotRows(list).map((row) => [row.title, row.detail ?? null, row.keys.map((item) => item.id)])).toEqual([
			["Speller", null, []],
			["Search", "Search key", ["s"]],
			["Search", "Admin key", ["s"]],
		]);
	});
});
