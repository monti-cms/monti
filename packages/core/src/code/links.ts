import { type Doc, walk } from "../body/doc";
import { ANCHOR, effectsOf } from "./shape";

/** A code link: words of the text that point at labelled lines of a code block (`codeRef { block, anchor }`, doc 17). */
export type CodeRef = { block: string; anchor: string };

/**
 * The code blocks a body draws, by the ids a code link may name: a block's own id, and in a translation the id of the source block it came from
 * (`link.from`), since a link copied from the source names that one (doc 17, "끊김").
 */
export function codeBlocksByRef(doc: Doc) {
	const byId = new Map<string, { id: string; labels: Map<string, { start: number; end: number }> }>();
	for (const { block } of walk(doc.blocks)) {
		if (block.type !== "codeBlock") continue;
		const labels = new Map<string, { start: number; end: number }>();
		for (const effect of effectsOf(block))
			if (effect.name === ANCHOR && effect.attrs?.id && !labels.has(effect.attrs.id))
				labels.set(effect.attrs.id, { start: effect.start, end: effect.end });
		const entry = { id: block.id, labels };
		byId.set(block.id, entry);
		if (block.link?.from && !byId.has(block.link.from)) byId.set(block.link.from, entry);
	}
	return byId;
}

/** Where a code link goes in this body: the drawn block's id and the lines, or `null` when it is broken. */
export function resolveCodeRef(blocks: ReturnType<typeof codeBlocksByRef>, ref: Partial<CodeRef>) {
	if (typeof ref.block !== "string" || typeof ref.anchor !== "string") return null;
	const block = blocks.get(ref.block);
	const lines = block?.labels.get(ref.anchor);
	return block && lines ? { block: block.id, anchor: ref.anchor, ...lines } : null;
}

/** The code links of a body that go nowhere: the block is gone, its labelled lines were all taken out, or the link came from another entry. */
export function brokenCodeRefs(doc: Doc): { block: string; ref: CodeRef }[] {
	const blocks = codeBlocksByRef(doc);
	const broken: { block: string; ref: CodeRef }[] = [];
	for (const { block } of walk(doc.blocks))
		for (const part of block.content ?? [])
			for (const mark of part.type === "text" ? (part.marks ?? []) : [])
				if (mark.type === "codeRef" && !resolveCodeRef(blocks, mark as Partial<CodeRef>))
					broken.push({ block: block.id, ref: { block: String(mark.block ?? ""), anchor: String(mark.anchor ?? "") } });
	return broken;
}
