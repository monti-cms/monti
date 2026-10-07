import { describe, expect, it } from "vitest";
import { composeFile, parseFile } from "../front-matter";

describe("front matter", () => {
	it("writes YAML between --- lines, a blank line, and the body", () => {
		const text = composeFile({ title: "Hello", slug: "hello", monti: { id: "1", locale: "en" } }, "Body text");
		expect(text).toBe('---\ntitle: Hello\nslug: hello\nmonti:\n  id: "1"\n  locale: en\n---\n\nBody text\n');
	});

	it("round trips every value type a field can hold, unchanged", () => {
		const data = {
			title: "A title: with a colon, # a hash and 'quotes'",
			summary: "Line one\nLine two\n\nLine four",
			numeric: "2024",
			bool: "true",
			date: "2026-10-07",
			empty: "",
			tagIds: ["1f0c0000-0000-4000-8000-000000000001", "1f0c0000-0000-4000-8000-000000000002"],
			translations: { ko: { title: "제목" }, ja: { title: "題名" } },
			monti: { id: "8a3b", collection: "post", locale: "en" },
		};
		const parsed = parseFile(composeFile(data, "Body\n\nMore body\n"));
		expect(parsed).toEqual({ ok: true, data, body: "Body\n\nMore body\n" });
	});

	it("keeps strings that look like numbers, booleans and dates as strings", () => {
		const parsed = parseFile("---\nversion: '1.0'\nflag: 'yes'\nwhen: '2026-10-07'\nplain: 2026-10-07\n---\ntext");
		expect(parsed.ok && parsed.data).toEqual({ version: "1.0", flag: "yes", when: "2026-10-07", plain: "2026-10-07" });
	});

	it("reads front matter written by hand: comments, CRLF line endings and a byte order mark", () => {
		const parsed = parseFile("﻿---\r\n# a comment\r\ntitle: By hand\r\ntags:\r\n  - a\r\n  - b\r\n---\r\n\r\nText\r\n");
		expect(parsed).toEqual({ ok: true, data: { title: "By hand", tags: ["a", "b"] }, body: "Text\n" });
	});

	it("treats a file with no front matter as a body only, and an empty front matter as no data", () => {
		expect(parseFile("Just text\n")).toEqual({ ok: true, data: {}, body: "Just text\n" });
		expect(parseFile("---\n---\nText")).toEqual({ ok: true, data: {}, body: "Text" });
	});

	it("does not take a --- inside a value or the body for the end of the front matter", () => {
		const parsed = parseFile("---\ntitle: a---b\n---\n\nbody\n\n---\n\nmore\n");
		expect(parsed).toEqual({ ok: true, data: { title: "a---b" }, body: "body\n\n---\n\nmore\n" });
	});

	it("reports front matter that is not valid YAML or not a mapping", () => {
		const broken = parseFile("---\ntitle: [unclosed\n---\nbody");
		expect(broken.ok).toBe(false);
		expect(!broken.ok && broken.message).toMatch(/not valid YAML/);
		const list = parseFile("---\n- a\n- b\n---\nbody");
		expect(list).toEqual({ ok: false, message: "front matter must be a YAML mapping (key: value lines)" });
	});

	it("does not fold long lines, so a long summary stays on one line in the diff", () => {
		const long = "word ".repeat(80).trim();
		expect(composeFile({ summary: long }, "").split("\n")[1]).toBe(`summary: ${long}`);
	});
});
