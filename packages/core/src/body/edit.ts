import { z } from "zod";
import { type CodeRule, type LineEffect, moveLineEffects, moveLineRules } from "../code/shape";
import { CheckError } from "../errors";
import { sameJson } from "../json";
import { type Block, type Doc, type Inline, type Mark, NewBlockShape, plainText, walk, withIds } from "./doc";
import { textToInline } from "./inline-text";

/**
 * A change to a body that points at blocks by id, so a proposal shows exactly where it lands (doc 03, principle 5). `setText` gives a block's whole
 * new text: for a text block with its marks as tags, as `body.read` shows them (`textToInline`); for a code block the code as it is.
 */
export const BodyOpShape = z.discriminatedUnion("op", [
	z.object({ op: z.literal("setText"), block: z.string(), text: z.string() }),
	z.object({ op: z.literal("setBlock"), block: z.string(), value: NewBlockShape }),
	z.object({ op: z.literal("insert"), after: z.string().nullable(), blocks: z.array(NewBlockShape).min(1) }),
	z.object({ op: z.literal("move"), block: z.string(), after: z.string().nullable() }),
	z.object({ op: z.literal("remove"), blocks: z.array(z.string()).min(1) }),
]);
export type BodyOp = z.infer<typeof BodyOpShape>;

const clone = (doc: Doc): Doc => structuredClone(doc);

function find(doc: Doc, id: string): { block: Block; siblings: Block[] } {
	for (const found of walk(doc.blocks)) if (found.block.id === id) return found;
	throw new CheckError({ key: "body.noBlock", values: { block: id } });
}

/** Puts blocks after `after` in the list it sits in, or first in the doc for `null`. */
function insertAfter(doc: Doc, after: string | null, blocks: Block[]) {
	if (after === null) {
		doc.blocks.unshift(...blocks);
		return;
	}
	const { siblings } = find(doc, after);
	siblings.splice(siblings.findIndex((block) => block.id === after) + 1, 0, ...blocks);
}

function detach(doc: Doc, id: string): Block {
	const { block, siblings } = find(doc, id);
	siblings.splice(siblings.indexOf(block), 1);
	return block;
}

const sameMarks = (a?: Mark[], b?: Mark[]) => sameJson(a ?? [], b ?? []);
const size = (inline: Inline) => (inline.type === "text" ? inline.text.length : inline.type === "hardBreak" ? 1 : 0);

/** Splits inlines at a text offset. A footnote reference exactly there goes left when `keepLeft`, else right. */
function splitAt(content: Inline[], offset: number, keepLeft: boolean): [Inline[], Inline[]] {
	const left: Inline[] = [];
	const right: Inline[] = [];
	let at = 0;
	for (const inline of content) {
		const end = at + size(inline);
		if (end < offset || (end === offset && (size(inline) > 0 || keepLeft))) left.push(inline);
		else if (at >= offset) right.push(inline);
		else if (inline.type === "text") {
			left.push({ ...inline, text: inline.text.slice(0, offset - at) });
			right.push({ ...inline, text: inline.text.slice(offset - at) });
		}
		at = end;
	}
	return [left, right];
}

/** Puts `text` in place of `from`–`to` of a block's text (in `plainText` offsets): it takes the marks of the text it replaces, or of the text before it. */
function splice(content: Inline[], from: number, to: number, text: string): Inline[] {
	const [left, rest] = splitAt(content, from, true);
	const [replaced, right] = splitAt(rest, to - from, false);
	const firstText = (list: Inline[]) => list.find((inline) => inline.type === "text") as { marks?: Mark[] } | undefined;
	const marks = (firstText(replaced) ?? firstText([...left].reverse()) ?? firstText(right))?.marks;
	const inserted: Inline[] = text ? [{ type: "text", text, ...(marks?.length ? { marks } : {}) }] : [];
	// Join neighbours with the same marks, and drop empty text.
	return [...left, ...inserted, ...right].reduce<Inline[]>((joined, inline) => {
		const last = joined.at(-1);
		if (inline.type === "text" && inline.text === "") return joined;
		if (inline.type === "text" && last?.type === "text" && sameMarks(last.marks, inline.marks))
			joined[joined.length - 1] = { ...last, text: last.text + inline.text };
		else joined.push(inline);
		return joined;
	}, []);
}

/** The smallest change that makes `before` into `after`: what is kept at both ends is not changed. */
function changedRange(before: string, after: string): { from: number; to: number; text: string } {
	let start = 0;
	while (start < before.length && start < after.length && before[start] === after[start]) start++;
	let end = 0;
	while (end < before.length - start && end < after.length - start && before.at(-1 - end) === after.at(-1 - end)) end++;
	return { from: start, to: before.length - end, text: after.slice(start, after.length - end) };
}

/**
 * A code block's new code (doc 17, 17-2): only the part that changed is put in, so the text effects of the code around it stay where they were, and
 * its line effects and rules move with their lines.
 */
function setCode(block: Block, code: string) {
	const before = plainText(block.content);
	const { from, to, text } = changedRange(before, code);
	block.content = splice(block.content ?? [], from, to, text);
	if (Array.isArray(block.attrs?.lines) || Array.isArray(block.attrs?.rules))
		block.attrs = {
			...block.attrs,
			...(Array.isArray(block.attrs?.lines)
				? { lines: moveLineEffects(block.attrs.lines as LineEffect[], before, from, to, text) }
				: {}),
			...(Array.isArray(block.attrs?.rules)
				? { rules: moveLineRules(block.attrs.rules as CodeRule[], before, from, to, text) }
				: {}),
		};
}

/** The body after the operations, in order. Nothing is checked here but that the blocks they name exist; `checkDoc` checks the result. */
export function applyOps(doc: Doc, ops: BodyOp[]): Doc {
	const next = clone(doc);
	for (const op of ops) {
		switch (op.op) {
			case "setText": {
				const { block } = find(next, op.block);
				if (block.children) throw new CheckError({ key: "body.noText", values: { block: op.block } });
				if (block.type === "codeBlock") setCode(block, op.text);
				else {
					const content = textToInline(op.text);
					if (content.length > 0) block.content = content;
					else delete block.content;
				}
				break;
			}
			case "setBlock": {
				const { block } = find(next, op.block);
				const value = withIds({ ...op.value, id: op.block });
				for (const key of ["attrs", "content", "children"] as const) delete block[key];
				Object.assign(block, value);
				break;
			}
			case "insert":
				insertAfter(next, op.after, op.blocks.map(withIds));
				break;
			case "move": {
				const moving = detach(next, op.block);
				if (op.after !== null && [...walk([moving])].some(({ block }) => block.id === op.after))
					throw new CheckError({ key: "body.moveIntoItself", values: { block: op.block } });
				insertAfter(next, op.after, [moving]);
				break;
			}
			case "remove":
				for (const id of op.blocks) detach(next, id);
				break;
		}
	}
	return next;
}
