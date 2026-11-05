import { type Block, type Doc, plainText } from "@monti-cms/core";

/** A run of words, marked when the other side does not have it. */
export type Part = { text: string; changed: boolean };

/** Words and the spaces between them, so the parts join back into the text. */
const tokens = (text: string) => text.split(/(\s+)/).filter((token) => token !== "");

/** Joins neighbouring tokens of the same kind into one part. */
function parts(list: { token: string; changed: boolean }[]): Part[] {
	const out: Part[] = [];
	for (const { token, changed } of list) {
		const last = out.at(-1);
		// A space between two changed words belongs to the change, so one change reads as one marked run.
		if (last && (last.changed === changed || /^\s+$/.test(token))) last.text += token;
		else out.push({ text: token, changed });
	}
	return out.map((part) => ({ ...part, text: part.text }));
}

/** The two texts word by word (the longest common run of words stays unmarked on both sides). */
export function wordDiff(mine: string, server: string): { mine: Part[]; server: Part[] } {
	const a = tokens(mine);
	const b = tokens(server);
	// lengths[i][j]: the longest common run of a[i..] and b[j..].
	const lengths = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
	for (let i = a.length - 1; i >= 0; i--)
		for (let j = b.length - 1; j >= 0; j--)
			lengths[i][j] = a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
	const left: { token: string; changed: boolean }[] = [];
	const right: { token: string; changed: boolean }[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length || j < b.length) {
		if (i < a.length && j < b.length && a[i] === b[j]) {
			left.push({ token: a[i], changed: false });
			right.push({ token: b[j], changed: false });
			i++;
			j++;
		} else if (j >= b.length || (i < a.length && lengths[i + 1][j] >= lengths[i][j + 1])) {
			left.push({ token: a[i], changed: !/^\s+$/.test(a[i]) });
			i++;
		} else {
			right.push({ token: b[j], changed: !/^\s+$/.test(b[j]) });
			j++;
		}
	}
	return { mine: parts(left), server: parts(right) };
}

/** How a block reads in the comparison: a heading, code, or text (a paragraph, a list, a quote: their text, line by line). */
export type ShownBlock = { id: string; look: "heading" | "code" | "text"; text: string };

const textOf = (block: Block): string =>
	block.children ? block.children.map(textOf).join("\n") : plainText(block.content);

export function shownBlocks(doc: Doc | null): ShownBlock[] {
	return (doc?.blocks ?? []).map((block) => ({
		id: block.id,
		look: block.type === "heading" ? "heading" : block.type === "codeBlock" ? "code" : "text",
		text: textOf(block),
	}));
}

/**
 * Each side's blocks with their words marked (screens.md, EditorCompare: `compareEntries`). Blocks pair by their id: a block the other side does not
 * have is marked whole, a block both have is compared word by word.
 */
export function compareBodies(mine: Doc | null, server: Doc | null) {
	const ours = shownBlocks(mine);
	const theirs = shownBlocks(server);
	const side = (blocks: ShownBlock[], other: ShownBlock[], pick: "mine" | "server") =>
		blocks.map((block) => {
			const match = other.find((each) => each.id === block.id);
			if (!match) return { ...block, parts: [{ text: block.text, changed: block.text !== "" }] };
			const diff = pick === "mine" ? wordDiff(block.text, match.text) : wordDiff(match.text, block.text);
			return { ...block, parts: diff[pick] };
		});
	return { mine: side(ours, theirs, "mine"), server: side(theirs, ours, "server") };
}
