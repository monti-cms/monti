import { analyze, type CmsMark, type CmsNode, serialize, toDocument } from "../../mdx";
import { sortMarks } from "../../mdx/registry";

const HINT: CmsMark = { type: "untranslated" };

/** 글자 노드마다 번역 안내 표시를 단다. 코드·수식·다이어그램은 글자 노드가 아니라(속성 값) 그대로 남는다. */
const hint = (node: CmsNode): CmsNode => {
	if (node.type === "text") {
		if (!node.text?.trim()) return node;
		const marks = node.marks ?? [];
		return marks.some((mark) => mark.type === HINT.type) ? node : { ...node, marks: sortMarks([...marks, HINT]) };
	}
	return node.content ? { ...node, content: node.content.map(hint) } : node;
};

/**
 * 새 번역본의 본문(v3): 원문 구조(제목·문단·상자·목록·표)를 그대로 두고, 글자는 번역 안내 표시
 * (`:untranslated[원문 글]`)로 감싼다. 에디터는 안내 글을 흐리게 보이고 입력하면 지운다.
 * 코드·이미지·수식·상자 제목처럼 글자 노드가 아닌 것은 원문 그대로 복사된다. 원문을 해석할 수 없으면 원문 그대로다.
 */
export function withTranslationHints(sourceMdx: string): string {
	const analysis = analyze(sourceMdx);
	if (analysis.errors.length > 0) return sourceMdx;
	return serialize(hint(toDocument(analysis)));
}
