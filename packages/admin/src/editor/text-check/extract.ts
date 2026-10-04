import { PLACEHOLDER, type TextCheckSegment } from "@monti-cms/core/client";
import type { Mark, Node as PmNode } from "@tiptap/pm/model";

export { PLACEHOLDER };

/**
 * 편집기 문서 → 검사 단위(문단) 뽑기. 글이 든 블록(문단·제목·목록 항목·표 칸·콜아웃 본문 등) 하나가 한 단위다.
 *
 * 보내지 않는 것:
 * - 코드 블록, 수식·코드 펜스·원문 보존 상자처럼 글이 아닌 블록(통째로 고르는 노드), 블록 속성
 * - 인라인 코드, 주소(링크 글자가 주소 자체인 것과 본문에 그대로 쓴 주소). 이 자리는 `PLACEHOLDER` 한 글자로 바꿔
 *   앞뒤 글자의 위치가 그대로 문서 위치로 돌아가게 한다.
 * - 이미지 같은 인라인 노드도 `PLACEHOLDER` 한 글자다. 줄바꿈은 `\n`이다.
 * 링크는 글자만 보내고 주소(속성)는 보내지 않는다.
 */

/** 문서 위치를 아는 검사 단위. */
export interface DocSegment extends TextCheckSegment {
	/** 블록 내용의 문서 범위. */
	readonly from: number;
	readonly to: number;
	/** 글자 `i`가 차지하는 문서 범위(`starts[i]` ~ `ends[i]`). 자리 표시 글자는 감춘 범위 전체다. */
	readonly starts: readonly number[];
	readonly ends: readonly number[];
}

export interface ExtractOptions {
	readonly locale: string;
	/** 이 범위에 걸친 블록만 돌려준다(선택 영역 검사). 이름(`id`)은 문서 전체 기준으로 매긴다. */
	readonly range?: { readonly from: number; readonly to: number } | null;
}

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s￼]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}\u0027\u0022’”]+$/;
const LETTER = /\p{L}/u;

const looksLikeUrl = (text: string) => /^(?:[a-z][a-z0-9+.-]*:|www\.|\/)\S*$/i.test(text.trim());

/** 보내지 않는 글자 노드: 인라인 코드, 글자가 주소 그대로인 링크. */
function isHiddenText(text: string, marks: readonly Mark[]): boolean {
	for (const mark of marks) {
		if (mark.type.spec.code || mark.type.name === "code") return true;
		if (mark.type.name === "link") {
			const href = String(mark.attrs.href ?? "");
			const trimmed = text.trim();
			if (trimmed === href || looksLikeUrl(trimmed)) return true;
		}
	}
	return false;
}

/** 32비트 FNV-1a(UTF-16 단위). 같은 글자면 늘 같은 이름이 된다. */
function hashText(text: string): string {
	let hash = 0x811c9dc5;
	for (let index = 0; index < text.length; index++) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(36);
}

interface Builder {
	chars: string[];
	starts: number[];
	ends: number[];
}

function push(builder: Builder, char: string, from: number, to: number) {
	const last = builder.chars.length - 1;
	// 이어진 자리 표시(마크로 나뉜 인라인 코드 등)는 한 글자로 합친다.
	if (char === PLACEHOLDER && builder.chars[last] === PLACEHOLDER && builder.ends[last] === from) {
		builder.ends[last] = to;
		return;
	}
	builder.chars.push(char);
	builder.starts.push(from);
	builder.ends.push(to);
}

/** 본문에 그대로 쓴 주소를 자리 표시 한 글자로 접는다. */
function collapseUrls(builder: Builder): Builder {
	const text = builder.chars.join("");
	const out: Builder = { chars: [], starts: [], ends: [] };
	let cursor = 0;
	for (const match of text.matchAll(URL_PATTERN)) {
		const start = match.index ?? 0;
		const end = start + match[0].replace(TRAILING_PUNCTUATION, "").length;
		if (end <= start) continue;
		for (let index = cursor; index < start; index++)
			push(out, builder.chars[index] ?? "", builder.starts[index] ?? 0, builder.ends[index] ?? 0);
		push(out, PLACEHOLDER, builder.starts[start] ?? 0, builder.ends[end - 1] ?? 0);
		cursor = end;
	}
	if (cursor === 0) return builder;
	for (let index = cursor; index < builder.chars.length; index++)
		push(out, builder.chars[index] ?? "", builder.starts[index] ?? 0, builder.ends[index] ?? 0);
	return out;
}

function buildTextblock(node: PmNode, pos: number): Builder {
	const builder: Builder = { chars: [], starts: [], ends: [] };
	node.forEach((child, offset) => {
		const at = pos + 1 + offset;
		if (child.isText) {
			const text = child.text ?? "";
			if (isHiddenText(text, child.marks)) {
				push(builder, PLACEHOLDER, at, at + text.length);
				return;
			}
			// ProseMirror 글자 위치도 UTF-16 단위라 한 글자씩 대응한다.
			for (let index = 0; index < text.length; index++) push(builder, text[index] ?? "", at + index, at + index + 1);
			return;
		}
		if (child.type.name === "hardBreak") push(builder, "\n", at, at + child.nodeSize);
		else push(builder, PLACEHOLDER, at, at + child.nodeSize);
	});
	return collapseUrls(builder);
}

/** 문서에서 검사 단위를 뽑는다. 글자(문자)가 없는 블록은 뺀다. */
export function extractSegments(doc: PmNode, { locale, range }: ExtractOptions): DocSegment[] {
	const segments: DocSegment[] = [];
	const seen = new Map<string, number>();
	doc.descendants((node, pos) => {
		if (!node.isTextblock) return !node.isAtom;
		if (node.type.spec.code) return false;
		const built = buildTextblock(node, pos);
		const text = built.chars.join("");
		if (!LETTER.test(text.replaceAll(PLACEHOLDER, ""))) return false;
		const hash = hashText(text);
		const occurrence = seen.get(hash) ?? 0;
		seen.set(hash, occurrence + 1);
		const from = pos + 1;
		const to = pos + node.nodeSize - 1;
		if (range && (to < range.from || from > range.to)) return false;
		segments.push({ id: `${hash}-${occurrence}`, text, locale, from, to, starts: built.starts, ends: built.ends });
		return false;
	});
	return segments;
}

/**
 * 문단 안 위치(UTF-16, `end` 미포함) → 문서 범위. 자리 표시 글자를 덮는 결과(코드·주소에 걸친 것)는 `null`이다.
 * 길이 0인 결과(빠진 띄어쓰기 등)는 옆 글자 하나로 넓힌다.
 */
export function segmentRangeToDoc(
	segment: DocSegment,
	start: number,
	end: number,
): { from: number; to: number } | null {
	const length = segment.text.length;
	if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > length || start > end) return null;
	let first = start;
	let last = end;
	if (first === last) {
		if (last < length) last += 1;
		else if (first > 0) first -= 1;
		else return null;
	}
	for (let index = first; index < last; index++) if (segment.text[index] === PLACEHOLDER) return null;
	const from = segment.starts[first];
	const to = segment.ends[last - 1];
	return from === undefined || to === undefined ? null : { from, to };
}

/** 문서 범위가 걸친 문단 안 위치(`[start, end)`). 걸치지 않으면 `null`이다. */
export function docRangeToSegment(
	segment: DocSegment,
	from: number,
	to: number,
): { start: number; end: number } | null {
	let start = -1;
	let end = -1;
	for (let index = 0; index < segment.text.length; index++) {
		const charFrom = segment.starts[index] ?? 0;
		const charTo = segment.ends[index] ?? 0;
		if (charTo > from && charFrom < to) {
			if (start < 0) start = index;
			end = index + 1;
		}
	}
	return start < 0 ? null : { start, end };
}
