import { BLOCKS } from "../../blocks/active";
import type { BlockDefinition } from "../../blocks/define";
import { createTranslator } from "../../i18n";
import { analyze, toDocument } from "../../mdx";
import type { CmsJsonValue, CmsNode } from "../../mdx/types";
import { translationMessages } from "./messages";

/**
 * 번역 결과의 구조 검사(v2 D2). 원문과 번역의 "글자를 뺀 뼈대"가 같은지 본다.
 *
 * - 같아야 하는 것: 블록·인라인 요소의 종류와 순서, 링크 주소, 이미지 주소, 코드·수식 내용, 코드 언어,
 *   directive·JSX 이름과 사람이 읽지 않는 속성, 인라인 코드 글자.
 * - 달라도 되는 것: 글자, 사람이 읽는 속성 값, 문장 안에서 굵게·링크가 걸린 위치.
 *
 * 사람이 읽는 속성은 블록 정의에서 정한다. 번역할 속성(`translatable`)과, 그 속성 값을 가리키는 속성
 * (`childValue`, 예: 처음 열 탭 → 탭 이름)이다. 사이트가 더한 블록도 같은 규칙을 따른다.
 */

/** Markdown 문법 요소의 사람이 읽는 속성. 블록 정의가 없는 요소만 둔다(링크 제목 `[글](주소 "제목")`). */
const MARKDOWN_READABLE: Readonly<Record<string, readonly string[]>> = { link: ["title"] };

/** 블록 하나의 사람이 읽는 속성 이름. */
export function readableAttributes(
	block: BlockDefinition,
	blockByName: ReadonlyMap<string, BlockDefinition>,
): Set<string> {
	const childTranslatable = new Set(
		(block.children?.blocks ?? []).flatMap((name) =>
			Object.entries(blockByName.get(name)?.attributes ?? {}).flatMap(([attribute, definition]) =>
				definition.translatable ? [attribute] : [],
			),
		),
	);
	return new Set(
		Object.entries(block.attributes).flatMap(([name, attribute]) =>
			attribute.translatable || (attribute.childValue !== undefined && childTranslatable.has(attribute.childValue))
				? [name]
				: [],
		),
	);
}

/**
 * 노드·마크 종류 → 사람이 읽는 속성. 지시자·JSX 블록은 렌더러 이름(`Callout`), 인라인 지시자 마크와
 * Markdown 이미지는 블록 이름(`tooltip`·`image`)이 종류다.
 */
export function readableAttributesByType(blocks: readonly BlockDefinition[]): Map<string, ReadonlySet<string>> {
	const byName = new Map(blocks.map((block) => [block.name, block]));
	const map = new Map<string, ReadonlySet<string>>();
	for (const block of blocks) {
		const readable = readableAttributes(block, byName);
		if (readable.size === 0) continue;
		map.set(block.name, readable);
		map.set(block.component, readable);
	}
	for (const [type, names] of Object.entries(MARKDOWN_READABLE)) map.set(type, new Set(names));
	return map;
}

let readableByType: Map<string, ReadonlySet<string>> | undefined;
const NONE: ReadonlySet<string> = new Set();
const readableOf = (type: string): ReadonlySet<string> => {
	readableByType ??= readableAttributesByType(BLOCKS);
	return readableByType.get(type) ?? NONE;
};

type Skeleton = {
	type: string;
	attrs: Record<string, CmsJsonValue>;
	/** 이 노드 바로 아래 글자에 걸린 서식(종류·주소). 겹치지 않게 모아 정렬한다. */
	marks: string[];
	/** 이 노드 바로 아래 인라인 코드 글자(번역하지 않는다). */
	codes: string[];
	children: Skeleton[];
};

const withoutReadable = (
	type: string,
	attrs: Record<string, CmsJsonValue> | undefined,
): Record<string, CmsJsonValue> => {
	const readable = readableOf(type);
	const kept: Record<string, CmsJsonValue> = {};
	for (const [key, value] of Object.entries(attrs ?? {})) {
		if (readable.has(key)) continue;
		// JSX 원래 속성 목록: 이름은 그대로, 사람이 읽는 속성의 값만 뺀다.
		kept[key] =
			key === "attributes" && Array.isArray(value)
				? value.map((item) => {
						const attribute = item as { name?: unknown; value?: CmsJsonValue };
						return typeof attribute.name === "string" && readable.has(attribute.name)
							? { name: attribute.name }
							: (item as CmsJsonValue);
					})
				: value;
	}
	return kept;
};

function skeletonOf(node: CmsNode): Skeleton {
	const marks = new Set<string>();
	const codes: string[] = [];
	const children: Skeleton[] = [];
	for (const child of node.content ?? []) {
		if (child.type !== "text") {
			children.push(skeletonOf(child));
			continue;
		}
		for (const mark of child.marks ?? []) {
			if (mark.type === "code") codes.push(child.text ?? "");
			else marks.add(JSON.stringify([mark.type, withoutReadable(mark.type, mark.attrs)]));
		}
	}
	return {
		type: node.type,
		attrs: withoutReadable(node.type, node.attrs),
		marks: [...marks].sort(),
		codes: codes.sort(),
		children,
	};
}

/** 구조 검사가 실패한 이유 코드. 이유 문구는 `reason`이다. */
export type StructureFailCode = "mdx_error" | "source_unreadable" | "structure_changed";

export type StructureCheck =
	| { ok: true }
	| { ok: false; code: StructureFailCode /** 사이트 화면 언어의 이유(`cms.translation` 사전). */; reason: string };

const tTranslation = createTranslator(translationMessages);

const mdxFailure = (message: string | undefined): StructureCheck => ({
	ok: false,
	code: "mdx_error",
	reason: tTranslation("mdx_error", { message: message ?? tTranslation("unreadable") }),
});

/** 번역한 MDX가 원문 MDX와 같은 뼈대인가. MDX로 읽을 수 없으면 실패다. */
export function compareStructure(sourceMdx: string, translatedMdx: string): StructureCheck {
	const translated = analyze(translatedMdx);
	if (translated.errors.length > 0) return mdxFailure(translated.errors[0]?.message);
	const source = analyze(sourceMdx);
	if (source.errors.length > 0) {
		return { ok: false, code: "source_unreadable", reason: tTranslation("source_unreadable") };
	}
	const a = skeletonOf(toDocument(source));
	const b = skeletonOf(toDocument(translated));
	return JSON.stringify(a) === JSON.stringify(b)
		? { ok: true }
		: { ok: false, code: "structure_changed", reason: tTranslation("structure_changed") };
}

/** MDX로 읽을 수 있는가(구조 검사를 끈 때도 본문에 넣으려면 읽을 수 있어야 한다). */
export function readableMdx(mdx: string): StructureCheck {
	const analysis = analyze(mdx);
	return analysis.errors.length > 0 ? mdxFailure(analysis.errors[0]?.message) : { ok: true };
}
