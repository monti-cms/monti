import { describe, expect, it } from "vitest";
import { parseFile } from "../front-matter";

describe("parseFile", () => {
	it("DATA-I9 says on which line of the file the front matter is not valid YAML", () => {
		// The second `title` is the error.
		expect(parseFile("---\ntitle: First\nslug: first\ntitle: Again\n---\n\nText\n")).toMatchObject({
			ok: false,
			line: 4,
		});
	});
});
