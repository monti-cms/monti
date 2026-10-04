import { describe, expect, it } from "vitest";
import { buildBlockSlashCommands } from "../../../slash-command";
import { mdxToTiptap, OPAQUE_BLOCK_NAME, tiptapToMdx } from "../../../tiptap-content";
import { blockNodeName, insertContentOf } from "..";
import { ADDED_NODE_BLOCKS } from "../shared";

// 예시 설정(`packages/core/test/cms.config.ts`)의 사용자 블록: `notice`(편집기 노드 컨테이너), `embed`(원문 상자).
describe("사용자 블록 편집", () => {
	it("편집기 노드가 있는 사용자 블록은 속성·본문을 노드로 옮기고 그대로 되돌린다", () => {
		const mdx = ':::notice{level="warn" title="점검"}\n오늘 밤 점검합니다.\n:::\n';
		const json = mdxToTiptap(mdx);
		const node = json.content?.[0];
		expect(node?.type).toBe(blockNodeName({ name: "notice" }));
		expect(node?.type).toBe("cmsNotice");
		expect(node?.attrs?.values).toEqual({ level: "warn", title: "점검" });
		expect(node?.content?.[0]?.type).toBe("paragraph");
		expect(tiptapToMdx(json)).toBe(mdx);
	});

	it("원문 상자로 정한 사용자 블록은 원문 그대로 보존한다", () => {
		const mdx = '::embed{url="https://example.com/video"}\n';
		const node = mdxToTiptap(mdx).content?.[0];
		expect(node?.type).toBe(OPAQUE_BLOCK_NAME);
		expect(tiptapToMdx(mdxToTiptap(mdx))).toBe(mdx);
	});

	it("삽입할 수 있는 사용자 블록이 슬래시 메뉴에 나온다", () => {
		const items = buildBlockSlashCommands();
		expect(items.find((item) => item.id === "notice")?.title).toBe("공지");
		expect(items.some((item) => item.id === "embed")).toBe(false);
	});
});

// 예시 설정은 블록 확장(`@monti-cms/blocks`)의 블록을 모두 쓴다.
describe("더한 블록의 편집기 표현", () => {
	const block = (name: string) => {
		const found = ADDED_NODE_BLOCKS.find((candidate) => candidate.name === name);
		if (!found) throw new Error(name);
		return found;
	};

	it("슬래시 메뉴는 더한 블록(설정 순서) 다음에 본체 블록이고, 아이콘은 정의에서 온다", () => {
		const items = buildBlockSlashCommands();
		expect(items.map((item) => item.id)).toEqual([
			"callout",
			"collapsible",
			"tabs",
			"columns",
			"mermaid",
			"chart",
			"notice",
			"math",
		]);
		expect(items.find((item) => item.id === "mermaid")).toMatchObject({
			title: "다이어그램",
			description: "Mermaid 다이어그램·흐름도",
			icon: "workflow",
		});
	});

	it("삽입 내용은 정의의 처음 값을 따르고, 없으면 기본값과 최소 개수의 자식이다", () => {
		expect(insertContentOf(block("callout"))).toEqual({
			type: "cmsCallout",
			attrs: { values: { variant: "info" }, originalAttributes: [] },
			content: [{ type: "paragraph", content: [{ type: "text", text: "내용을 입력하세요" }] }],
		});
		expect(insertContentOf(block("tabs")).content?.map((tab) => tab.attrs?.values)).toEqual([
			{ label: "첫 번째" },
			{ label: "두 번째" },
		]);
		expect(insertContentOf(block("mermaid"))).toEqual({
			type: "cmsMermaid",
			attrs: { value: "graph TD\n  A --> B", language: "mermaid" },
		});
		expect(insertContentOf(block("notice"))).toEqual({
			type: "cmsNotice",
			attrs: { values: { level: "info" }, originalAttributes: [] },
			content: [{ type: "paragraph" }],
		});
	});

	it("코드 펜스 블록은 그 언어의 코드 블록을 노드로 옮기고 메타까지 되돌린다", () => {
		const mdx = "```mermaid title=흐름\ngraph TD\n  A --> B\n```\n";
		const node = mdxToTiptap(mdx).content?.[0];
		expect(node).toMatchObject({ type: "cmsMermaid", attrs: { value: "graph TD\n  A --> B", meta: "title=흐름" } });
		expect(tiptapToMdx(mdxToTiptap(mdx))).toBe(mdx);
	});
});
