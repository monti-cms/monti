import { describe, expect, it } from "vitest";
import { analyze, serialize, toDocument } from "../format";

const roundTrip = (mdx: string) => serialize(toDocument(analyze(mdx))).trim();

describe("reference-style links and images", () => {
	it("turns a full reference link into an inline link and drops the definition", () => {
		const mdx = '[Shiki][1]\n\n[1]: https://shiki.style "T"\n';
		const doc = toDocument(analyze(mdx));
		const paragraph = doc.content?.[0];
		expect(doc.content).toHaveLength(1);
		expect(paragraph?.content?.[0]).toMatchObject({
			type: "text",
			text: "Shiki",
			marks: [{ type: "link", attrs: { href: "https://shiki.style", title: "T" } }],
		});
		expect(serialize(doc).trim()).toBe('[Shiki](https://shiki.style "T")');
	});

	it("resolves collapsed and shortcut references", () => {
		expect(roundTrip("[Shiki][] and [Vite]\n\n[shiki]: https://shiki.style\n[vite]: https://vite.dev\n")).toBe(
			"[Shiki](https://shiki.style) and [Vite](https://vite.dev)",
		);
	});

	it("matches labels case-insensitively and with collapsed whitespace", () => {
		expect(roundTrip("[a][Foo   Bar]\n\n[foo bar]: /x\n")).toBe("[a](/x)");
	});

	it("keeps inline marks inside a reference link", () => {
		expect(roundTrip("[**bold** text][a]\n\n[a]: /x\n")).toBe("[**bold** text](/x)");
	});

	it("resolves a definition that appears before its use and inside nested blocks", () => {
		expect(roundTrip("[a]: /x\n\n> see [a]\n\n- item [a][]\n")).toBe("> see [a](/x)\n\n- item [a](/x)");
	});

	it("turns a full, collapsed and shortcut image reference into an image", () => {
		const mdx = '![Alt][i]\n\n![i][]\n\n![i]\n\n[i]: https://example.com/p.png "Pic"\n';
		const doc = toDocument(analyze(mdx));
		expect(doc.content).toHaveLength(3);
		expect(doc.content?.[0]).toMatchObject({
			type: "image",
			attrs: { src: "https://example.com/p.png", alt: "Alt", title: "Pic" },
		});
		expect(doc.content?.[1]?.attrs?.alt).toBe("i");
		expect(doc.content?.[2]?.attrs?.alt).toBe("i");
		expect(serialize(doc).split("\n\n")[0]).toBe('![Alt](https://example.com/p.png "Pic")');
	});

	it("resolves an image reference inside a paragraph", () => {
		expect(roundTrip("before ![A][i] after\n\n[i]: /p.png\n")).toBe("before ![A](/p.png) after");
	});
});
