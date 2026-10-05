import { describe, expect, it } from "vitest";
import { analyze, serialize, toDocument } from "../index";

describe("MDX Image Component Roundtrip & Conversion", () => {
	it("parses <Image mediaId='123' alt='Test' width='60%' align='center' caption='Cap' /> into image node and serializes both mediaId and src", () => {
		const mdx = `<Image mediaId="123e4567-e89b-12d3-a456-426614174000" src="https://media.example.com/pic.png" alt="Test Image" width="60%" align="center" caption="My caption" />\n`;
		const parsed = analyze(mdx);
		const doc = toDocument(parsed);

		expect(doc.content).toBeDefined();
		const imageNode = doc.content?.find((n) => n.type === "image");
		expect(imageNode).toBeDefined();
		expect(imageNode?.attrs?.mediaId).toBe("123e4567-e89b-12d3-a456-426614174000");
		expect(imageNode?.attrs?.src).toBe("https://media.example.com/pic.png");
		expect(imageNode?.attrs?.alt).toBe("Test Image");
		expect(imageNode?.attrs?.width).toBe("60%");
		expect(imageNode?.attrs?.align).toBe("center");
		expect(imageNode?.attrs?.caption).toBe("My caption");

		const serialized = serialize(doc);
		expect(serialized).toContain('mediaId="123e4567-e89b-12d3-a456-426614174000"');
		expect(serialized).toContain('src="https://media.example.com/pic.png"');
		expect(serialized).toContain('alt="Test Image"');
		expect(serialized).toContain('width="60%"');
		expect(serialized).toContain('align="center"');
		expect(serialized).toContain('caption="My caption"');
	});

	it("preserves standard markdown image ![alt](src) when no extra props exist", () => {
		const mdx = `![Simple alt](https://example.com/pic.png)\n`;
		const parsed = analyze(mdx);
		const doc = toDocument(parsed);

		const imageNode = doc.content?.find((n) => n.type === "image");
		expect(imageNode).toBeDefined();
		expect(imageNode?.attrs?.src).toBe("https://example.com/pic.png");
		expect(imageNode?.attrs?.alt).toBe("Simple alt");

		const serialized = serialize(doc);
		expect(serialized.trim()).toBe("![Simple alt](https://example.com/pic.png)");
	});

	it("round-trips the crop and rotate attributes of an Image element", () => {
		const mdx = '<Image crop="10,20,50,40" rotate="90" src="https://example.com/pic.png" />\n';
		const parsed = analyze(mdx);
		const doc = toDocument(parsed);

		const imageNode = doc.content?.find((n) => n.type === "image");
		expect(imageNode).toBeDefined();
		expect(imageNode?.attrs?.crop).toBe("10,20,50,40");
		expect(imageNode?.attrs?.rotate).toBe("90");

		const serialized = serialize(doc);
		expect(serialized).toContain('crop="10,20,50,40"');
		expect(serialized).toContain('rotate="90"');
	});

	it("does not store default values (rotate=0, full crop)", () => {
		const mdx = '<Image crop="0,0,100,100" rotate="0" src="https://example.com/pic.png" />\n';
		const parsed = analyze(mdx);
		const doc = toDocument(parsed);

		const serialized = serialize(doc);
		expect(serialized).not.toContain("rotate=");
		expect(serialized).not.toContain("crop=");
		// No extra attributes, so it goes back to a standard Markdown image
		expect(serialized.trim()).toBe("![](https://example.com/pic.png)");
	});

	it("keeps the title in the directive and round-trips it when crop/rotate is applied to an image with a title", () => {
		const mdx = '![설명](https://example.com/pic.png "내 제목")\n';
		const parsed = analyze(mdx);
		const doc = toDocument(parsed);

		const imageNode = doc.content?.find((n) => n.type === "image");
		expect(imageNode?.attrs?.title).toBe("내 제목");

		// Simulate the user adding a crop in the editor
		if (imageNode?.attrs) {
			imageNode.attrs.crop = "10,10,80,80";
		}

		const serialized = serialize(doc);
		expect(serialized).toContain('title="내 제목"');
		expect(serialized).toContain('crop="10,10,80,80"');

		// title and crop are preserved after parsing again
		const reparsed = analyze(serialized);
		const redoc = toDocument(reparsed);
		const reImageNode = redoc.content?.find((n) => n.type === "image");
		expect(reImageNode?.attrs?.title).toBe("내 제목");
		expect(reImageNode?.attrs?.crop).toBe("10,10,80,80");
	});
});
