import { contentPath } from "@monti-cms/core/client";
import type { Editor, Range } from "@tiptap/core";

export interface InternalLinkItem {
	id: string;
	collection: string;
	title: string;
	slug: string;
	/** 대상의 상태. 초안 대상 링크는 편집 중 허용하되 표시한다(§6.2). */
	status?: string;
}

/**
 * 내부 글 링크 주소(§4.4·§6.2). 일반 Markdown 링크 `[제목](<컬렉션 path에 주소를 넣은 경로>)`로 저장되며 고정 ID는 저장하지 않는다.
 * 주소 모양은 컬렉션 정의의 `path`다. 경로가 없는 컬렉션이거나 slug가 없으면 깨진 링크를 만들지 않는다.
 */
export function internalLinkHref(item: InternalLinkItem): string | null {
	return contentPath(item.collection, item.slug);
}

/** MDX 저장 형식. 원문 모드 삽입과 테스트가 쓴다. */
export function formatContentLinkMdx(item: InternalLinkItem, alias?: string): string {
	const displayText = alias ? alias.trim() : item.title;
	const href = internalLinkHref(item);
	return href ? `[${displayText}](${href})` : displayText;
}

/**
 * `[[검색어` 범위를 링크 mark가 있는 텍스트로 바꾼다. 링크 문구는 삽입 당시 제목이며 이후 자유롭게 고칠 수 있다.
 * 문자열 `[제목](주소)`을 텍스트로 넣으면 저장할 때 이스케이프되어 링크가 되지 않는다.
 */
export function insertInternalLink(editor: Editor, range: Range, item: InternalLinkItem): void {
	const href = internalLinkHref(item);
	const chain = editor.chain().focus().deleteRange(range);
	if (!href) {
		chain.insertContent(item.title).run();
		return;
	}
	chain
		.insertContent([
			{ type: "text", text: item.title, marks: [{ type: "link", attrs: { href } }] },
			{ type: "text", text: " " },
		])
		.run();
}

export function parseInternalLinkTrigger(text: string): { active: boolean; query: string } {
	const match = text.match(/\[\[([^\]]*)$/);
	if (!match) return { active: false, query: "" };
	return { active: true, query: match[1] };
}
