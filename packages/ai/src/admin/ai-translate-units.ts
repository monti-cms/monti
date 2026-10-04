import { mdxToTiptap, tiptapToMdx, UNTRANSLATED_MARK_NAME } from "@monti-cms/admin/editor";
import type { Editor, JSONContent } from "@tiptap/core";
import { Fragment, type Node as PmNode } from "@tiptap/pm/model";

/**
 * AI 번역의 단위(v2 D2). 블록 손잡이가 가리키는 블록 하나, 또는 `모두 번역`이 모은 블록들이다.
 *
 * - 목록은 항목 하나가 단위다. 항목만으로는 MDX가 안 되므로 같은 종류의 목록(항목 하나)으로 감싸 보내고,
 *   돌아온 목록에서 항목을 꺼내 그 항목 자리만 바꾼다.
 * - 콜아웃·인용구·탭 안의 블록은 그 블록만으로 MDX가 되므로 그대로 보낸다.
 * - 바꿀 때는 같은 자리에 같은 모양으로 들어가는지 확인한다. 안 들어가면 바꾸지 않는다(목록을 쪼개지 않는다).
 */

const LISTS = new Set(["bulletList", "orderedList", "taskList"]);
const LIST_ITEMS = new Set(["listItem", "taskItem"]);

export interface TranslateUnit {
	/** 보낼 원문 MDX(안내 글 표시를 걷어 낸 것). */
	mdx: string;
	/** 바꿀 블록의 JSON. 그사이 사용자가 고쳤는지 본다. */
	original: string;
	/** 목록 항목이면 감싼 목록의 종류. */
	wrap: string | null;
}

export type ApplyResult = "replaced" | "changed" | "invalid";

/** 블록 안에 번역 안내 글이 남아 있는가. */
export function hasHints(node: PmNode): boolean {
	let found = false;
	node.descendants((child) => {
		if (found) return false;
		if (child.marks.some((mark) => mark.type.name === UNTRANSLATED_MARK_NAME)) found = true;
		return !found;
	});
	return found;
}

/** 안내 글 표시를 걷어 낸 JSON. 안내 글은 원문 그대로라 이것이 곧 원문 블록이다. */
const withoutHints = (json: JSONContent): JSONContent => ({
	...json,
	...(json.marks ? { marks: json.marks.filter((mark) => mark.type !== UNTRANSLATED_MARK_NAME) } : {}),
	...(json.content ? { content: json.content.map(withoutHints) } : {}),
});

/** 블록(JSON)의 원문 MDX. */
export const sourceMdxFromJson = (json: JSONContent) =>
	tiptapToMdx({ type: "doc", content: [withoutHints(json)] }).trim();

/** 블록 하나의 번역 단위. `parent`는 그 블록을 담은 노드다. */
export function unitOf(node: PmNode, parent: PmNode | null): TranslateUnit {
	const json = node.toJSON() as JSONContent;
	const wrap = LIST_ITEMS.has(node.type.name) && parent && LISTS.has(parent.type.name) ? parent : null;
	const sent = wrap ? { type: wrap.type.name, attrs: wrap.attrs, content: [json] } : json;
	return { mdx: sourceMdxFromJson(sent), original: JSON.stringify(json), wrap: wrap?.type.name ?? null };
}

/** 블록 손잡이 자리(`pos`는 블록 바로 앞)의 번역 단위. 안내 글이 없으면 `null`. */
export function unitAt(doc: PmNode, pos: number): TranslateUnit | null {
	const node = doc.nodeAt(pos);
	if (!node || !node.isBlock || !hasHints(node)) return null;
	return unitOf(node, doc.resolve(pos).parent);
}

/** `모두 번역`의 단위. 최상위 블록 하나씩이고, 목록은 항목 하나씩이다. */
export function collectUnits(doc: PmNode): TranslateUnit[] {
	const units: TranslateUnit[] = [];
	doc.forEach((node) => {
		if (!hasHints(node)) return;
		if (LISTS.has(node.type.name)) {
			node.forEach((item) => {
				if (hasHints(item)) units.push(unitOf(item, node));
			});
		} else units.push(unitOf(node, doc));
	});
	return units;
}

/** 원래 블록(JSON이 같은 것)의 자리. `hint` 자리를 먼저 보고, 없으면 문서에서 찾는다. */
function findBlock(doc: PmNode, original: string, hint: number | null): { pos: number; size: number } | null {
	const at = hint !== null && hint < doc.content.size ? doc.nodeAt(hint) : null;
	if (at && JSON.stringify(at.toJSON()) === original) return { pos: hint as number, size: at.nodeSize };
	let found: { pos: number; size: number } | null = null;
	doc.descendants((node, pos) => {
		if (found) return false;
		if (node.isBlock && JSON.stringify(node.toJSON()) === original) {
			found = { pos, size: node.nodeSize };
			return false;
		}
		return true;
	});
	return found;
}

/**
 * 번역 결과로 원래 블록을 바꾼다. 그사이 블록이 바뀌었으면 `changed`, 결과가 그 자리에 들어가지 않으면
 * `invalid`이고 둘 다 문서를 건드리지 않는다.
 */
export function applyTranslation(editor: Editor, unit: TranslateUnit, mdx: string, hint: number | null): ApplyResult {
	const { state } = editor;
	const target = findBlock(state.doc, unit.original, hint);
	if (!target) return "changed";
	let content = mdxToTiptap(mdx).content ?? [];
	if (unit.wrap) {
		const [list] = content;
		if (content.length !== 1 || list?.type !== unit.wrap || list.content?.length !== 1) return "invalid";
		content = list.content;
	}
	let nodes: PmNode[];
	try {
		nodes = content.map((json) => state.schema.nodeFromJSON(json));
		for (const node of nodes) node.check();
	} catch {
		return "invalid";
	}
	const $pos = state.doc.resolve(target.pos);
	const index = $pos.index();
	const fragment = Fragment.fromArray(nodes);
	if (nodes.length === 0 || !$pos.parent.canReplace(index, index + 1, fragment)) return "invalid";
	editor.view.dispatch(state.tr.replaceWith(target.pos, target.pos + target.size, fragment));
	return "replaced";
}
