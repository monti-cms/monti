import { BLOCK_NODE_VIEWS } from "@monti-cms/admin/editor";
import { BLOCK_BY_NAME, BLOCKS, invalidOptionAttributes } from "@monti-cms/core/client";
import { DIRECTIVES } from "@monti-cms/core/mdx";
import { describe, expect, it, vi } from "vitest";

// 블록은 플러그인(`blocks()`)으로 넣은 설정으로 돌려, 공개 컴포넌트가 플러그인 `render`에서 오게 한다.
vi.mock("../../../core/src/config/resolved", async () => ({
	cmsConfig: (await import("../test/render-config")).default,
}));

const { mdxComponents } = await import("@monti-cms/core/render");

describe("블록 정의(v2 B3)", () => {
	it("JSON 왕복해도 같다 — 함수·컴포넌트가 없다", () => {
		expect(JSON.parse(JSON.stringify(BLOCKS))).toEqual(BLOCKS);
	});

	it("이름이 겹치지 않고 자식·부모 블록이 실제로 있다", () => {
		expect(new Set(BLOCKS.map((block) => block.name)).size).toBe(BLOCKS.length);
		for (const block of BLOCKS) {
			for (const child of ("children" in block ? block.children?.blocks : undefined) ?? []) {
				expect(BLOCK_BY_NAME.get(child)?.parent, `${block.name} → ${child}`).toBe(block.name);
			}
			if ("parent" in block && block.parent) expect(BLOCK_BY_NAME.has(block.parent)).toBe(true);
		}
	});

	it("공개 컴포넌트 표와 편집기 NodeView 등록부에 구현이 있다", async () => {
		const components = await mdxComponents();
		for (const block of BLOCKS) {
			const intrinsic = block.component === block.component.toLowerCase();
			if (!intrinsic && !("renderedBy" in block && block.renderedBy)) {
				expect(components[block.component], `${block.name}.component`).toBeDefined();
			}
			// 본체 블록은 등록부의 편집기 노드를, 더한 블록(블록 확장)은 정의에서 만든 노드를 쓴다.
			if (block.editor.view === "node" && block.editor.nodeView) {
				expect(BLOCK_NODE_VIEWS[block.editor.nodeView], `${block.name}.editor.nodeView`).toBeDefined();
			}
		}
	});

	it("선택 값과 기본값이 맞고, 선택 값 밖의 속성을 찾는다", () => {
		for (const block of BLOCKS) {
			for (const [name, attribute] of Object.entries(block.attributes)) {
				if (attribute.options && typeof attribute.defaultValue === "string") {
					expect(Object.keys(attribute.options), `${block.name}.${name}`).toContain(attribute.defaultValue);
				}
			}
		}
		const callout = BLOCK_BY_NAME.get("callout");
		expect(callout && invalidOptionAttributes(callout, { variant: "caution" })).toEqual(["variant"]);
		expect(callout && invalidOptionAttributes(callout, { variant: "tip", title: "x" })).toEqual([]);
	});

	it("v1 지시자 표(§4.4)를 그대로 만든다", () => {
		expect(
			DIRECTIVES.map((directive) => [directive.name, directive.kind, directive.component, directive.required]),
		).toEqual([
			["text-align", "container", "TextAlign", ["align"]],
			["image", "leaf", "Image", []],
			["file", "leaf", "File", ["mediaId"]],
			// 번역 안내 글(v3). 새 번역본의 원문 글을 감싼다.
			["untranslated", "text", "Untranslated", []],
			["u", "text", "u", []],
			["sup", "text", "sup", []],
			["sub", "text", "sub", []],
			["br", "text", "br", []],
			["table", "container", "Table", []],
			["row", "container", "TableRow", []],
			["cell", "leaf", "TableCell", []],
			// 블록 확장(`@monti-cms/blocks`). 사이트 설정의 `plugins` 순서다.
			["callout", "container", "Callout", []],
			["collapsible", "container", "Collapsible", []],
			["tabs", "container", "Tabs", []],
			["tab", "container", "Tab", ["label"]],
			["columns", "container", "Columns", []],
			["column", "container", "Column", []],
			// 글자 꾸밈 확장. 저장 문법·컴포넌트 이름은 그대로다.
			["tooltip", "text", "Tooltip", ["content"]],
			["code-ref", "text", "CodeRef", ["to"]],
			["color", "text", "Color", []],
		]);
		expect(DIRECTIVES.find((directive) => directive.name === "cell")?.attributes).toEqual({
			colspan: "string",
			rowspan: "string",
			header: "boolean",
		});
		expect(DIRECTIVES.find((directive) => directive.name === "image")?.attributes).toEqual({
			mediaId: "string",
			src: "string",
			alt: "string",
			width: "string",
			align: "string",
			caption: "string",
			decorative: "boolean",
			crop: "string",
			rotate: "string",
			title: "string",
		});
	});
});
