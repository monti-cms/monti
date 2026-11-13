import { z } from "zod";
import { type CodeRule, type LineEffect, moveLineEffects, moveLineRules } from "../code/shape";
import { CheckError } from "../errors";
import { sameJson } from "../json";
import { type Block, type Doc, type Inline, type Mark, NewBlockShape, plainText, walk, withIds } from "./doc";

/** A change to a body that points at blocks by id, so a proposal shows exactly where it lands (doc 03, principle 5). */
export const BodyOpShape = z.discriminatedUnion("op", [
	z.object({
		op: z.literal("replaceText"),
		block: z.string(),
		from: z.number().int().min(0),
		to: z.number().int().min(0),
		text: z.string(),
	}),
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

/** Replaces `from`–`to` of a block's text (in `plainText` offsets). The new text takes the marks of the text it replaces, or of the text before it. */
export function replaceText(content: Inline[], from: number, to: number, text: string): Inline[] {
	const length = plainText(content).length;
	if (from > to || to > length) throw new CheckError({ key: "body.badRange", values: { from, to, length } });
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

/** The body after the operations, in order. Nothing is checked here but that the blocks they name exist; `checkDoc` checks the result. */
export function applyOps(doc: Doc, ops: BodyOp[]): Doc {
	const next = clone(doc);
	for (const op of ops) {
		switch (op.op) {
			case "replaceText": {
				const { block } = find(next, op.block);
				const before = plainText(block.content);
				block.content = replaceText(block.content ?? [], op.from, op.to, op.text);
				// A code block's line effects stay on their lines (doc 17, 17-2).
				if (block.type === "codeBlock" && (Array.isArray(block.attrs?.lines) || Array.isArray(block.attrs?.rules)))
					block.attrs = {
						...block.attrs,
						...(Array.isArray(block.attrs?.lines)
							? { lines: moveLineEffects(block.attrs.lines as LineEffect[], before, op.from, op.to, op.text) }
							: {}),
						...(Array.isArray(block.attrs?.rules)
							? { rules: moveLineRules(block.attrs.rules as CodeRule[], before, op.from, op.to, op.text) }
							: {}),
					};
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
