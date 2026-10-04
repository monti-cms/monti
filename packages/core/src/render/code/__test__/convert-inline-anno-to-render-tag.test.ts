import type { Element, Root } from "hast";
import { describe, expect, it } from "vitest";
import { convertInlineAnnoToRenderTag } from "../transformers";

const runCodeHook = (codeEl: Element, allowedRenderTags: string[] = ["Tooltip", "strong"]) => {
	const transformer = convertInlineAnnoToRenderTag(allowedRenderTags);
	const hook = transformer.root;
	expect(hook).toBeTypeOf("function");
	const root: Root = {
		type: "root",
		children: [{ type: "element", tagName: "pre", properties: {}, children: [codeEl] }],
	};
	hook?.call({} as never, root);
};

const createInlineElement = (properties: Element["properties"]): Element => ({
	type: "element",
	tagName: "span",
	properties,
	children: [{ type: "text", value: "hello" }],
});

describe("convertInlineAnnoToRenderTag", () => {
	it("data-anno-render를 tagName으로 바꾸고 data-anno-* 속성을 일반 prop으로 변환한다", () => {
		const node = createInlineElement({
			"data-anno-render": "Tooltip",
			"data-anno-variant": '"tip"',
			"data-anno-open": "true",
		});
		const codeEl: Element = { type: "element", tagName: "code", properties: {}, children: [node] };

		runCodeHook(codeEl);

		expect(node.tagName).toBe("Tooltip");
		expect(node.properties.variant).toBe("tip");
		expect(node.properties.open).toBe(true);
		expect(node.properties["data-anno-render"]).toBeUndefined();
		expect(node.properties["data-anno-variant"]).toBeUndefined();
		expect(node.properties["data-anno-open"]).toBeUndefined();
	});

	it("유효하지 않은 render tag면 변환하지 않는다", () => {
		const node = createInlineElement({
			"data-anno-render": "Callout<script>",
			"data-anno-variant": '"tip"',
		});
		const codeEl: Element = { type: "element", tagName: "code", properties: {}, children: [node] };

		runCodeHook(codeEl);

		expect(node.tagName).toBe("span");
		expect(node.properties.variant).toBeUndefined();
		expect(node.properties["data-anno-render"]).toBe("Callout<script>");
		expect(node.properties["data-anno-variant"]).toBe('"tip"');
	});

	it("deny 대상 prop은 변환하지 않는다", () => {
		const node = createInlineElement({
			"data-anno-render": "Tooltip",
			"data-anno-variant": '"tip"',
			"data-anno-__proto__": '{"polluted":true}',
			"data-anno-dangerouslySetInnerHTML": '{"__html":"<b>x</b>"}',
			"data-anno-children": '"forbidden"',
			"data-anno-onClick": '"alert(1)"',
			"data-anno-href": '"javascript:alert(1)"',
		});
		const codeEl: Element = { type: "element", tagName: "code", properties: {}, children: [node] };

		runCodeHook(codeEl);

		const props = node.properties as Record<string, unknown>;
		expect(node.tagName).toBe("Tooltip");
		expect(props.variant).toBe("tip");
		expect(props.dangerouslySetInnerHTML).toBeUndefined();
		expect(props.children).toBeUndefined();
		expect(props.onClick).toBeUndefined();
		expect(props.href).toBeUndefined();
		expect(Object.hasOwn(props, "__proto__")).toBe(false);
		expect("polluted" in props).toBe(false);
	});

	it("허용되지 않은 render tag면 변환하지 않는다", () => {
		const node = createInlineElement({
			"data-anno-render": "Callout",
			"data-anno-variant": '"tip"',
		});
		const codeEl: Element = { type: "element", tagName: "code", properties: {}, children: [node] };

		runCodeHook(codeEl, ["Tooltip"]);

		expect(node.tagName).toBe("span");
		expect(node.properties.variant).toBeUndefined();
	});
});
