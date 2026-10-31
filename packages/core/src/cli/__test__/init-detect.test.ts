import { describe, expect, it } from "vitest";
import { parseFrontMatterKeys } from "../init-detect";

describe("front matter keys", () => {
	it("INIT-C1 types the top-level keys and ignores nested ones and the body", () => {
		const keys = parseFrontMatterKeys(
			'---\ntitle: "Hello: world"\ncount: 3\nok: true\nwhen: 2024-02-03T10:00:00Z\ntags: [a, b]\nauthors:\n  - name: x\nnested:\n  inner: 1\n---\nbody: not a key\n',
		);
		expect([...keys]).toEqual([
			["title", "string"],
			["count", "number"],
			["ok", "boolean"],
			["when", "date"],
			["tags", "list"],
			["authors", "list"],
			["nested", "string"],
		]);
		expect(parseFrontMatterKeys("# no front matter\n").size).toBe(0);
		expect(parseFrontMatterKeys("﻿---\r\ntitle: x\r\n---\r\n").has("title")).toBe(true);
	});
});
