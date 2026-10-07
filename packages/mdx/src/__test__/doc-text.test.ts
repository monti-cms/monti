import { withoutBlockIds } from "@monti-cms/core/document";
import { describe, expect, it } from "vitest";
import { docOfText } from "../../../core/src/doc/__test__/doc-text";
import { testSite } from "../../../core/test/site";
import { docOfMdx } from "../testing";

/**
 * Core tests describe a body in plain text with a tiny reader (`packages/core/src/doc/__test__/doc-text.ts`) because core parses no text format. This keeps that reader
 * honest: for the subset it reads, it must give the document the real `mdx` format gives.
 */
const SAMPLES = [
	"Plain paragraph\n",
	"One\n\nTwo\n\nThree\n",
	'With **bold**, *em*, `code`, ~~gone~~ and [a link](https://example.com "Title").\n',
	"# Title\n\n## Sub\n\nBody\n",
	"- one\n- two\n\n1. a\n2. b\n",
	"> quote\n",
	"---\n",
	"```ts\nconst a = 1;\n```\n",
	'```ts title="a.ts"\nconst a = 1;\n```\n',
	'![alt](https://example.com/a.png "T")\n',
	"text ![inline](https://example.com/a.png) more\n",
	"Line one<br />\nLine two\n",
	"Joined\nacross lines\n",
	"하나\n\n둘\n",
];

describe("the plain-text reader of core tests", () => {
	for (const sample of SAMPLES) {
		it(`reads ${JSON.stringify(sample)} like the mdx format`, () => {
			expect(withoutBlockIds(docOfText(sample).content)).toEqual(withoutBlockIds(docOfMdx(testSite, sample).content));
		});
	}
});
