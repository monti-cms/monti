import { createTranslator } from "@monti-cms/core/client";
import type { CmsJsonValue, CmsMark, CmsNode } from "@monti-cms/core/mdx";
import { TEXT_ALIGN_VALUES as ALIGN_VALUES, analyze, serialize, sortMarks, toDocument } from "@monti-cms/core/mdx";
import type { JSONContent } from "@tiptap/core";
import { ADDED_MARK_BY_EDITOR_NAME, ADDED_MARKS, addedMarkName, markAttrsOf } from "./added-marks";
import { PARENT_ONLY_TYPES } from "./blocks/added";
import { type ConverterContext, converterForCms, converterForTiptap } from "./converters";
import { asNumber, asString, brDirectiveNode } from "./converters/shared";
import { editorMessages } from "./messages";

const t = createTranslator(editorMessages);

/**
 * CmsNode ↔ Tiptap JSONContent 변환. 시각 에디터의 적재/저장 경로다.
 *
 * - 적재: MDX → `analyze` → `toDocument` → 이 모듈 → Tiptap JSON.
 * - 저장: Tiptap `getJSON()` → 이 모듈 → CmsNode → `serialize` → MDX.
 *
 * 두 방향 모두 **데이터를 버리지 않는다.** Tiptap 스키마에 없는 블록(표·수식·차트·콜아웃·탭·
 * 수식 외 JSX 등)은 `cmsOpaqueBlock`에 원문 MDX를 담아 읽기 전용 상자로 보존한다(§4.4
 * "조용히 노드를 삭제하거나 임의의 HTML로 바꾸지 않는다"). 블록 하나가 통째로 네이티브거나
 * 통째로 상자다 — 상자 안 일부만 날아가는 일은 없다.
 */

export const OPAQUE_BLOCK_NAME = "cmsOpaqueBlock";

/** Tiptap이 그대로 들고 다닐 수 있는 mark. 더한 글자 꾸밈(블록 확장)은 정의에서 만든 마크로 옮긴다(`added-marks.ts`). */
const NATIVE_MARKS = new Set([
	"bold",
	"italic",
	"strike",
	"code",
	"link",
	"underline",
	"superscript",
	"subscript",
	// 번역 안내 글(v3). 속성이 없어 이름 그대로 오간다.
	"untranslated",
]);
const MAPPABLE_MARKS = new Set([...NATIVE_MARKS, ...ADDED_MARKS.keys()]);

const TEXT_ALIGN_VALUES: ReadonlySet<string> = new Set(ALIGN_VALUES);

/**
 * `to-document.ts`의 `jsxAttrs`와 같은 모양으로 JSX 노드를 만든다.
 * `{type: 이름, attrs: {펼친 속성, name, attributes}}` — 키 순서는 비교에 영향 없다.
 */
const jsxCmsNode = (name: string, record: Record<string, CmsJsonValue>): CmsNode => {
	const attributes = Object.entries(record)
		.filter(([, value]) => value !== undefined)
		.map(([attrName, value]) => ({ name: attrName, value: value as CmsJsonValue }));
	return { type: name, attrs: { ...record, name, attributes } };
};

/** 서브트리를 상자로 감싼다. `source`는 그 서브트리의 저장 문자열(되돌릴 때 다시 파싱한다). */
const toOpaque = (node: CmsNode): JSONContent => {
	const body = serialize({ type: "doc", content: [structuredClone(node)] } as CmsNode).trimEnd();
	const label = typeof node.attrs?.name === "string" && node.attrs.name.length > 0 ? node.attrs.name : node.type;
	return { type: OPAQUE_BLOCK_NAME, attrs: { source: body, label } };
};

const isMappableInline = (node: CmsNode): boolean => {
	if (node.type === "text") return (node.marks ?? []).every((mark) => MAPPABLE_MARKS.has(mark.type));
	if (node.type === "hardBreak") return true;
	// `:br[]`는 `mdxJsx`(name=br)로 온다 — 에디터의 진짜 줄바꿈으로 보여준다.
	if (node.type === "mdxJsx" && node.attrs?.name === "br") return true;
	// 이미지·수식·그 밖의 JSX는 인라인 자리에 둘 수 없으므로 블록째 상자로 보낸다.
	return false;
};

/** 모든 항목이 `- [ ]`/`- [x]`인 비순서 목록. */
const isTaskList = (node: CmsNode): boolean => {
	const items = node.content ?? [];
	return (
		node.type === "bulletList" &&
		items.length > 0 &&
		items.every(
			(item) =>
				item.type === "listItem" &&
				typeof item.attrs?.checked === "boolean" &&
				(item.content ?? []).every((child) => isMappableBlock(child)),
		)
	);
};

const isMappableBlock = (node: CmsNode): boolean => {
	// 부모 전용 블록(탭 하나·단 하나)은 부모 밖에서 유효하지 않다. 부모 변환기가 자식을 직접 검증한다.
	if (PARENT_ONLY_TYPES.has(node.type)) return false;
	const converter = converterForCms(node.type, node);
	if (converter) return converter.isMappable(node, context);
	switch (node.type) {
		case "paragraph":
		case "heading":
			return (node.content ?? []).every(isMappableInline);
		case "blockquote":
		case "orderedList":
			return (node.content ?? []).every(isMappableBlock);
		case "bulletList":
			// 모든 항목이 체크 항목이면 Tiptap 체크 목록으로 편집한다. 섞인 목록은 상자로 보존한다.
			return isTaskList(node) || (node.content ?? []).every(isMappableBlock);
		case "listItem":
			// 체크 항목은 체크 목록(`isTaskList`) 안에서만 옮긴다. 번호 목록의 체크 항목은 상자로 보존한다.
			if (node.attrs?.checked != null) return false;
			return (node.content ?? []).every(isMappableBlock);
		case "horizontalRule":
			return true;
		case "TextAlign": {
			const align = asString(node.attrs?.align);
			const children = node.content ?? [];
			const only = children.length === 1 ? children[0] : undefined;
			return (
				!!align &&
				TEXT_ALIGN_VALUES.has(align) &&
				!!only &&
				(only.type === "paragraph" || only.type === "heading") &&
				isMappableBlock(only)
			);
		}
		default:
			return false;
	}
};

const toTiptapMarks = (marks: CmsMark[] | undefined): JSONContent["marks"] => {
	if (!marks || marks.length === 0) return undefined;
	const out: NonNullable<JSONContent["marks"]> = [];
	for (const mark of marks) {
		const added = ADDED_MARKS.get(mark.type);
		if (added) {
			out.push({ type: addedMarkName(added.name), attrs: markAttrsOf(added, mark.attrs) });
			continue;
		}
		// isMappableInline이 걸렀으므로 여기 오는 mark는 전부 네이티브다.
		if (mark.type === "link") {
			const href = asString(mark.attrs?.href) ?? "";
			const title = asString(mark.attrs?.title);
			out.push(title != null ? { type: "link", attrs: { href, title } } : { type: "link", attrs: { href } });
			continue;
		}
		const rest = mark.attrs && Object.keys(mark.attrs).length > 0 ? { attrs: { ...mark.attrs } } : {};
		out.push({ type: mark.type, ...rest });
	}
	return out.length > 0 ? out : undefined;
};

const inlineChildren = (nodes: CmsNode[]): JSONContent[] => {
	const out: JSONContent[] = [];
	for (const node of nodes) {
		if (node.type === "text") {
			const marks = toTiptapMarks(node.marks);
			out.push(marks ? { type: "text", text: node.text ?? "", marks } : { type: "text", text: node.text ?? "" });
			continue;
		}
		if (node.type === "hardBreak" || (node.type === "mdxJsx" && node.attrs?.name === "br")) {
			out.push({ type: "hardBreak" });
			continue;
		}
		// isMappableInline이 걸렀으므로 도달 불가. 인라인 자리에는 상자를 둘 수 없어서
		// 여기가 실행되면 상위 블록 판정이 잘못된 것이다 — 조용히 넘기지 않고 드러낸다.
		throw new Error(t("tiptapContent.unmappableInline", { type: node.type }));
	}
	return out;
};

const withTextAlign = (node: CmsNode, content: JSONContent): JSONContent => {
	const align = asString(node.attrs?.textAlign);
	if (align && TEXT_ALIGN_VALUES.has(align)) {
		content.attrs = { ...(content.attrs ?? {}), textAlign: align };
	}
	return content;
};

const blockToTiptap = (node: CmsNode): JSONContent => {
	if (!isMappableBlock(node)) return toOpaque(node);
	const converter = converterForCms(node.type, node);
	if (converter) return converter.toTiptap(node, context);
	switch (node.type) {
		case "paragraph":
			return withTextAlign(node, { type: "paragraph", content: inlineChildren(node.content ?? []) });
		case "heading": {
			const level = asNumber(node.attrs?.level) ?? 2;
			return withTextAlign(node, {
				type: "heading",
				attrs: { level },
				content: inlineChildren(node.content ?? []),
			});
		}
		case "blockquote":
			return { type: "blockquote", content: (node.content ?? []).map(blockToTiptap) };
		case "bulletList":
			if (isTaskList(node)) {
				return {
					type: "taskList",
					content: (node.content ?? []).map((item) => ({
						type: "taskItem",
						attrs: { checked: item.attrs?.checked === true },
						content: (item.content ?? []).map(blockToTiptap),
					})),
				};
			}
			return { type: "bulletList", content: (node.content ?? []).map(blockToTiptap) };
		case "orderedList": {
			const start = asNumber(node.attrs?.start);
			return {
				type: "orderedList",
				...(start != null && start !== 1 ? { attrs: { start } } : {}),
				content: (node.content ?? []).map(blockToTiptap),
			};
		}
		case "listItem":
			return { type: "listItem", content: (node.content ?? []).map(blockToTiptap) };
		case "horizontalRule":
			return { type: "horizontalRule" };
		case "TextAlign": {
			const child = (node.content ?? [])[0] as CmsNode;
			const converted = blockToTiptap(child);
			converted.attrs = { ...(converted.attrs ?? {}), textAlign: asString(node.attrs?.align) };
			return converted;
		}
		default:
			return toOpaque(node);
	}
};

/** MDX 본문 → Tiptap JSON. 파싱 오류가 있어도 있는 만큼은 옮긴다(상자는 원문을 품는다). */
export const cmsNodeToTiptap = (node: CmsNode): JSONContent => {
	if (node.type === "doc") {
		return {
			type: "doc",
			content: (node.content ?? []).map((block) => {
				try {
					return blockToTiptap(block);
				} catch {
					// 매핑 버그가 나도 본문을 버리지 않는다 — 상자로 보존하면 저장은 정확하다.
					return toOpaque(block);
				}
			}),
		};
	}
	return blockToTiptap(node);
};

/** MDX 본문 문자열 → Tiptap JSON. 에디터 적재용이다. */
export const mdxToTiptap = (source: string): JSONContent => cmsNodeToTiptap(toDocument(analyze(source)));

const tiptapMarksToCms = (marks: JSONContent["marks"]): CmsMark[] => {
	const out: CmsMark[] = [];
	for (const mark of marks ?? []) {
		if (!mark || typeof mark.type !== "string") continue;
		const added = ADDED_MARK_BY_EDITOR_NAME.get(mark.type);
		if (added) {
			const attrs = markAttrsOf(added, mark.attrs);
			out.push(Object.keys(attrs).length > 0 ? { type: added.name, attrs } : { type: added.name });
			continue;
		}
		if (mark.type === "link") {
			const href = asString(mark.attrs?.href) ?? "";
			const title = asString(mark.attrs?.title);
			out.push(title != null ? { type: "link", attrs: { href, title } } : { type: "link", attrs: { href } });
			continue;
		}
		// Tiptap 스키마 밖의 mark는 getJSON에 나타날 수 없다(방어: 버린다).
		if (NATIVE_MARKS.has(mark.type)) out.push({ type: mark.type });
	}
	return sortMarks(out);
};

const tiptapInlineToCms = (nodes: JSONContent[] | undefined): CmsNode[] => {
	const out: CmsNode[] = [];
	for (const node of nodes ?? []) {
		if (!node || typeof node.type !== "string") continue;
		if (node.type === "text") {
			const text: CmsNode = { type: "text", text: node.text ?? "" };
			const marks = tiptapMarksToCms(node.marks);
			if (marks.length > 0) text.marks = marks;
			out.push(text);
			continue;
		}
		if (node.type === "hardBreak") {
			out.push(brDirectiveNode());
			continue;
		}
		if (node.type === "image") {
			out.push(...tiptapBlockToCms(node));
		}
		// 스키마 밖의 인라인은 getJSON에 나타날 수 없다(방어: 버린다).
	}
	return out;
};

const tiptapBlockToCms = (node: JSONContent): CmsNode[] => {
	if (!node || typeof node.type !== "string") return [];
	const converter = converterForTiptap(node.type);
	if (converter) return converter.toCms(node, context);
	switch (node.type) {
		case "paragraph":
		case "text": {
			const block: CmsNode =
				node.type === "text"
					? { type: "text", text: node.text ?? "" }
					: { type: "paragraph", content: tiptapInlineToCms(node.content) };
			if (node.type === "paragraph") {
				const align = asString(node.attrs?.textAlign);
				if (align && TEXT_ALIGN_VALUES.has(align)) {
					return [{ ...jsxCmsNode("TextAlign", { align }), content: [block] }];
				}
			}
			return [block];
		}
		case "heading": {
			const block: CmsNode = {
				type: "heading",
				attrs: { level: asNumber(node.attrs?.level) ?? 2 },
				content: tiptapInlineToCms(node.content),
			};
			const align = asString(node.attrs?.textAlign);
			if (align && TEXT_ALIGN_VALUES.has(align)) {
				return [{ ...jsxCmsNode("TextAlign", { align }), content: [block] }];
			}
			return [block];
		}
		case "blockquote":
		case "bulletList":
		case "orderedList":
		case "listItem": {
			const children = (node.content ?? []).flatMap(tiptapBlockToCms);
			if (node.type === "blockquote") return [{ type: "blockquote", content: children }];
			if (node.type === "bulletList") return [{ type: "bulletList", content: children }];
			if (node.type === "listItem") return [{ type: "listItem", content: children }];
			const start = asNumber(node.attrs?.start);
			return [
				start != null && start !== 1
					? { type: "orderedList", attrs: { start }, content: children }
					: { type: "orderedList", content: children },
			];
		}
		case "taskList":
			return [
				{
					type: "bulletList",
					content: (node.content ?? []).map((item) => ({
						type: "listItem",
						attrs: { checked: item.attrs?.checked === true },
						content: (item.content ?? []).flatMap(tiptapBlockToCms),
					})),
				},
			];
		case "horizontalRule":
			return [{ type: "horizontalRule" }];
		case "hardBreak":
			return [brDirectiveNode()];
		case OPAQUE_BLOCK_NAME: {
			const source = asString(node.attrs?.source) ?? "";
			if (!source) return [];
			return [...(toDocument(analyze(source)).content ?? [])];
		}
		default:
			// Tiptap 스키마 밖의 노드는 getJSON에 나타날 수 없다(방어: 버린다).
			return [];
	}
};

/** 변환기 등록부(`./converters`)에 넘기는 재귀 변환 함수. 함수 선언 뒤에 두지만 호출은 실행 시점이라 안전하다. */
const context: ConverterContext = {
	blockToTiptap: (node) => blockToTiptap(node),
	tiptapBlockToCms: (node) => tiptapBlockToCms(node),
	isMappableBlock: (node) => isMappableBlock(node),
	isMappableInline: (node) => isMappableInline(node),
	inlineToTiptap: (nodes) => inlineChildren(nodes),
	inlineToCms: (nodes) => tiptapInlineToCms(nodes),
};

/** Tiptap `getJSON()` → CmsNode. 저장용이다. */
export const tiptapToCmsNode = (content: JSONContent): CmsNode => {
	const children = Array.isArray(content?.content) ? content.content : [];
	return { type: "doc", content: children.flatMap(tiptapBlockToCms) };
};

/** Tiptap `getJSON()` → MDX 본문. 에디터 저장용이다. */
export const tiptapToMdx = (content: JSONContent): string => serialize(tiptapToCmsNode(content));
