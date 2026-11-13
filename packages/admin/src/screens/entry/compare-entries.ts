import { type Block, type Doc, type Field, type Label, plainText } from "@monti-cms/core";

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

type Op = { op: "=" | "-" | "+"; tokens: string[] };

const words = (tokens: string[]) => tokens.filter((token) => !/^\s+$/.test(token)).length;

/** Neighbouring runs of one kind joined, and between two same-words runs the removed words first, then the added ones. */
function normalized(ops: Op[]): Op[] {
	const out: Op[] = [];
	let removed: string[] = [];
	let added: string[] = [];
	const flush = () => {
		if (removed.length) out.push({ op: "-", tokens: removed });
		if (added.length) out.push({ op: "+", tokens: added });
		removed = [];
		added = [];
	};
	for (const each of ops) {
		if (each.op === "-") removed = [...removed, ...each.tokens];
		else if (each.op === "+") added = [...added, ...each.tokens];
		else {
			flush();
			const last = out.at(-1);
			if (last?.op === "=") last.tokens = [...last.tokens, ...each.tokens];
			else out.push({ op: "=", tokens: [...each.tokens] });
		}
	}
	flush();
	return out;
}

/**
 * The two texts word by word, then grouped to read (Google diff-match-patch's semantic cleanup, by words): same words between two changes, no longer
 * than the change on either side of them, join the change. Two runs that swapped places are then one changed stretch on each side, instead of one of
 * them said to have moved (which run "moved" is only the tie-break of the shortest diff); changes far apart, with a longer run of same words between,
 * stay apart (doc 04, 2026-11-06 owner).
 */
export function readableWordDiff(mine: string, server: string): { mine: Part[]; server: Part[] } {
	const a = tokens(mine);
	const b = tokens(server);
	const lengths = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
	for (let i = a.length - 1; i >= 0; i--)
		for (let j = b.length - 1; j >= 0; j--)
			lengths[i][j] = a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
	let ops: Op[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length || j < b.length) {
		if (i < a.length && j < b.length && a[i] === b[j]) {
			ops.push({ op: "=", tokens: [a[i]] });
			i++;
			j++;
		} else if (j >= b.length || (i < a.length && lengths[i + 1][j] >= lengths[i][j + 1])) {
			ops.push({ op: "-", tokens: [a[i]] });
			i++;
		} else {
			ops.push({ op: "+", tokens: [b[j]] });
			j++;
		}
	}
	ops = normalized(ops);
	// Join same words into the changes around them until nothing more joins.
	for (let joined = true; joined; ) {
		joined = false;
		for (let at = 0; at < ops.length; at++) {
			const same = ops[at];
			if (same?.op !== "=") continue;
			const side = (from: number, step: -1 | 1) => {
				const sizes = { removed: 0, added: 0 };
				for (let k = from; k >= 0 && k < ops.length && ops[k]?.op !== "="; k += step) {
					const each = ops[k] as Op;
					if (each.op === "-") sizes.removed += words(each.tokens);
					else sizes.added += words(each.tokens);
				}
				return Math.max(sizes.removed, sizes.added);
			};
			const before = side(at - 1, -1);
			const after = side(at + 1, 1);
			const size = words(same.tokens);
			if (before > 0 && after > 0 && size <= before && size <= after) {
				ops.splice(at, 1, { op: "-", tokens: same.tokens }, { op: "+", tokens: same.tokens });
				ops = normalized(ops);
				joined = true;
				break;
			}
		}
	}
	const side = (keep: "-" | "+") =>
		parts(
			ops.flatMap((each) =>
				each.op === "=" || each.op === keep
					? each.tokens.map((token) => ({ token, changed: each.op !== "=" && !/^\s+$/.test(token) }))
					: [],
			),
		);
	return { mine: side("-"), server: side("+") };
}

/**
 * How a block reads in the comparison: a heading, code, or text (a paragraph, a list, a quote: their text, line by line). A block with values has a
 * name line (`values`) above its words: "Callout · Kind Warning · Title Read this" (doc 18, T197). A code block also gives its language, file name
 * and each line's effects (doc 17, T196): two sides with the same code may still differ there.
 */
export type ShownBlock = {
	id: string;
	look: "heading" | "code" | "text";
	values?: string;
	text: string;
	code?: { language: string | null; title: string | null; lines: string[][] };
};

/** What the comparison names blocks and their values with: the site's catalog, and the admin's words for a name. */
export type BlockNames = {
	/** A block type's name and its fields (`blocks.catalog`). */
	block: (
		type: string,
	) =>
		| { label: Label; fields?: Record<string, Field> | null; fence?: { language: string; attr: string } | null }
		| undefined;
	/** A name in the admin's language: a site's words, or a key of the admin's dictionary. */
	say: (label: Label) => string;
	/** A library file's name, for a picture or a file. */
	file?: (media: string) => string | undefined;
};

/** The words of a core block that holds values, by the admin's dictionary keys, in the order they are said. */
const CORE_VALUES: Record<string, (attrs: Record<string, unknown>, names: BlockNames) => [string, string][]> = {
	image: (attrs, names) => [
		[
			"compare.value.file",
			typeof attrs.media === "string" ? (names.file?.(attrs.media) ?? attrs.media) : String(attrs.src ?? ""),
		],
		["compare.value.alt", typeof attrs.alt === "string" ? attrs.alt : ""],
		["compare.value.caption", typeof attrs.caption === "string" ? attrs.caption : ""],
		[
			"compare.value.width",
			typeof attrs.width === "number"
				? `${attrs.width}px`
				: typeof attrs.widthPercent === "number"
					? `${attrs.widthPercent}%`
					: "",
		],
	],
	file: (attrs, names) => [
		[
			"compare.value.file",
			typeof attrs.name === "string" && attrs.name !== ""
				? attrs.name
				: typeof attrs.media === "string"
					? (names.file?.(attrs.media) ?? attrs.media)
					: "",
		],
	],
	table: () => [],
	divider: () => [],
};

/** A block's name line: its name and the values it has, each by its field's name. `undefined` for a block that is only its words. */
function valuesOf(block: Block, names: BlockNames | undefined): string | undefined {
	if (!names) return undefined;
	const attrs = block.attrs ?? {};
	const known = names.block(block.type);
	const core = CORE_VALUES[block.type];
	if (!known || (!core && !known.fields)) return undefined;
	// A core block says only the values it has; a site's switch that is on is said by its name alone.
	const pairs: [string, string][] = core
		? core(attrs, names).flatMap(([key, value]): [string, string][] => (value === "" ? [] : [[names.say(key), value]]))
		: Object.entries(known.fields ?? {}).flatMap(([key, field]): [string, string][] => {
				const value = attrs[key];
				if (key === known.fence?.attr || value === undefined || value === null || value === "" || value === false)
					return [];
				// A value that is on is said by its name alone ("Open at first"); an option by its own name.
				if (value === true) return [[names.say(field.label), ""]];
				const option = field.options?.[String(value)];
				if (option) return [[names.say(field.label), names.say(option)]];
				return [[names.say(field.label), String(value)]];
			});
	return [names.say(known.label), ...pairs.map(([name, value]) => (value ? `${name} ${value}` : name))].join(" · ");
}

/** A block's own words: its text, a table's rows, a source (a formula, a diagram), or the lines of the blocks it holds with their name lines. */
function wordsOf(block: Block, names: BlockNames | undefined): string {
	if (block.type === "table" && Array.isArray(block.attrs?.rows))
		return (block.attrs.rows as unknown[][]).map((row) => row.map(String).join(" | ")).join("\n");
	const fence = names?.block(block.type)?.fence;
	if (fence) return typeof block.attrs?.[fence.attr] === "string" ? String(block.attrs[fence.attr]) : "";
	if (!block.children) return plainText(block.content);
	return block.children
		.flatMap((child) => [valuesOf(child, names), wordsOf(child, names)])
		.filter((line): line is string => line !== undefined && line !== "")
		.join("\n");
}

/** A block written as code of its own language (a formula, a diagram): it reads as code. */
const isSource = (block: Block, names: BlockNames | undefined) => Boolean(names?.block(block.type)?.fence);

/** Each line's effects, by name, in a stable order. A label a code link names is not something the reader sees: it is left out. */
const lineEffects = (block: Block): string[][] => {
	const lines: string[][] = plainText(block.content)
		.split("\n")
		.map(() => []);
	for (const effect of (block.attrs?.lines ?? []) as { name: string; start: number; end: number }[])
		if (effect.name !== "anchor")
			for (let line = effect.start; line < effect.end && line < lines.length; line++) lines[line].push(effect.name);
	return lines.map((names) => [...new Set(names)].sort());
};

/** The body's blocks as the comparison reads them. With `names`, a block with values has its name line, and a formula or a diagram reads as code. */
export function shownBlocks(doc: Doc | null, names?: BlockNames): ShownBlock[] {
	return (doc?.blocks ?? []).map((block) => {
		const values = valuesOf(block, names);
		return {
			id: block.id,
			look:
				block.type === "heading" ? "heading" : block.type === "codeBlock" || isSource(block, names) ? "code" : "text",
			...(values !== undefined ? { values } : {}),
			text: wordsOf(block, names),
			...(block.type === "codeBlock"
				? {
						code: {
							language: typeof block.attrs?.language === "string" ? block.attrs.language : null,
							title: typeof block.attrs?.title === "string" ? block.attrs.title : null,
							lines: lineEffects(block),
						},
					}
				: {}),
		};
	});
}

/** The lines of two codes paired by their words (the longest run of equal lines in order): a line put in on one side moves no pair. */
function pairedLines(mine: string[], theirs: string[]): Map<number, number> {
	const table = Array.from({ length: mine.length + 1 }, () => new Array<number>(theirs.length + 1).fill(0));
	for (let a = mine.length - 1; a >= 0; a--)
		for (let b = theirs.length - 1; b >= 0; b--)
			(table[a] as number[])[b] =
				mine[a] === theirs[b]
					? ((table[a + 1] as number[])[b + 1] ?? 0) + 1
					: Math.max((table[a + 1] as number[])[b] ?? 0, (table[a] as number[])[b + 1] ?? 0);
	const pairs = new Map<number, number>();
	let a = 0;
	let b = 0;
	while (a < mine.length && b < theirs.length) {
		if (mine[a] === theirs[b]) {
			pairs.set(a++, b++);
			continue;
		}
		if (((table[a + 1] as number[])[b] ?? 0) >= ((table[a] as number[])[b + 1] ?? 0)) a++;
		else b++;
	}
	return pairs;
}

/**
 * Where two sides of a code block differ besides their words: the lines whose effects differ (counted on this side), and whether the language or the
 * file name does. Lines are paired by their words; a line the other side does not have is the words' change, not the effects'.
 */
export function codeChanges(block: ShownBlock, other: ShownBlock | undefined) {
	if (!block.code || !other?.code) return { lines: [] as number[], language: false, title: false };
	const theirs = other.code.lines;
	const pairs = pairedLines(block.text.split("\n"), other.text.split("\n"));
	return {
		lines: block.code.lines.flatMap((names, line) => {
			const paired = pairs.get(line);
			return paired !== undefined && names.join(" ") !== (theirs[paired] ?? []).join(" ") ? [line] : [];
		}),
		language: block.code.language !== other.code.language,
		title: block.code.title !== other.code.title,
	};
}

/**
 * Each side's blocks with their words marked (screens.md, EditorCompare: `compareEntries`). Blocks pair by their id: a block the other side does not
 * have is marked whole, a block both have is compared word by word, and a code block's effects line by line (`changes`).
 */
export function compareBodies(mine: Doc | null, server: Doc | null, names?: BlockNames) {
	const ours = shownBlocks(mine, names);
	const theirs = shownBlocks(server, names);
	const diff = (a: string, b: string, pick: "mine" | "server") =>
		(pick === "mine" ? wordDiff(a, b) : wordDiff(b, a))[pick];
	const side = (blocks: ShownBlock[], other: ShownBlock[], pick: "mine" | "server") =>
		blocks.map((block) => {
			const match = other.find((each) => each.id === block.id);
			if (!match)
				return {
					...block,
					parts: [{ text: block.text, changed: block.text !== "" }],
					...(block.values !== undefined ? { valueParts: [{ text: block.values, changed: true }] } : {}),
					changes: codeChanges(block, undefined),
				};
			// A value is compared word by word, like the words: "Kind Note" against "Kind Warning" marks the kind's name (doc 18).
			return {
				...block,
				parts: diff(block.text, match.text, pick),
				...(block.values !== undefined ? { valueParts: diff(block.values, match.values ?? "", pick) } : {}),
				changes: codeChanges(block, match),
			};
		});
	return { mine: side(ours, theirs, "mine"), server: side(theirs, ours, "server") };
}
