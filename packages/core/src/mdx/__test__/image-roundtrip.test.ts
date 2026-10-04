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

	it("::image directive의 crop과 rotate 속성을 왕복한다", () => {
		const mdx = '::image{crop="10,20,50,40" rotate="90" src="https://example.com/pic.png"}\n';
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

	it("기본값(rotate=0, 전체 자르기)은 저장하지 않는다", () => {
		const mdx = '::image{crop="0,0,100,100" rotate="0" src="https://example.com/pic.png"}\n';
		const parsed = analyze(mdx);
		const doc = toDocument(parsed);

		const serialized = serialize(doc);
		expect(serialized).not.toContain("rotate=");
		expect(serialized).not.toContain("crop=");
		// 추가 속성이 없으므로 표준 Markdown 이미지로 돌아간다
		expect(serialized.trim()).toBe("![](https://example.com/pic.png)");
	});

	it("제목(title) 있는 이미지에 crop/rotate 적용 시 directive에서 title을 보존하고 왕복한다 (P1-3)", () => {
		const mdx = '![설명](https://example.com/pic.png "내 제목")\n';
		const parsed = analyze(mdx);
		const doc = toDocument(parsed);

		const imageNode = doc.content?.find((n) => n.type === "image");
		expect(imageNode?.attrs?.title).toBe("내 제목");

		// 사용자가 에디터에서 crop 추가 시뮬레이션
		if (imageNode?.attrs) {
			imageNode.attrs.crop = "10,10,80,80";
		}

		const serialized = serialize(doc);
		expect(serialized).toContain('title="내 제목"');
		expect(serialized).toContain('crop="10,10,80,80"');

		// 다시 파싱해도 title과 crop이 보존됨
		const reparsed = analyze(serialized);
		const redoc = toDocument(reparsed);
		const reImageNode = redoc.content?.find((n) => n.type === "image");
		expect(reImageNode?.attrs?.title).toBe("내 제목");
		expect(reImageNode?.attrs?.crop).toBe("10,10,80,80");
	});
});
