/** A run of a text as a change leaves it: words that stay, words taken out, words put in. */
export type DiffRun = { text: string; kind: "same" | "del" | "ins" };

/** Words and the space between them, each a token: joined again they are the text, letter for letter. */
const tokens = (text: string) => text.match(/\s+|[^\s]+/g) ?? [];

/** Texts longer than this are not compared word by word (the table of two long texts is large): the whole old text goes out and the new one in. */
const MOST_TOKENS = 4000;

/**
 * What a change does to a text, word by word, in one run of words: the words of `before` it takes out and the words of `after` it puts in, each
 * where it stands, among the words that stay. Shown whole it is the change on one line; without the words put in it is the text as it was,
 * without the words taken out the text as proposed.
 */
export function inlineDiff(before: string, after: string): DiffRun[] {
	if (before === after) return before === "" ? [] : [{ text: before, kind: "same" }];
	const a = tokens(before);
	const b = tokens(after);
	if (a.length === 0) return [{ text: after, kind: "ins" }];
	if (b.length === 0) return [{ text: before, kind: "del" }];
	if (a.length * b.length > MOST_TOKENS * MOST_TOKENS)
		return [
			{ text: before, kind: "del" },
			{ text: after, kind: "ins" },
		];
	// The longest run of tokens both texts keep, in order: what is not in it was taken out or put in.
	const width = b.length + 1;
	const lengths = new Uint32Array((a.length + 1) * width);
	for (let i = a.length - 1; i >= 0; i -= 1)
		for (let j = b.length - 1; j >= 0; j -= 1)
			lengths[i * width + j] =
				a[i] === b[j]
					? (lengths[(i + 1) * width + j + 1] ?? 0) + 1
					: Math.max(lengths[(i + 1) * width + j] ?? 0, lengths[i * width + j + 1] ?? 0);
	const runs: DiffRun[] = [];
	const push = (text: string, kind: DiffRun["kind"]) => {
		const last = runs.at(-1);
		if (last && last.kind === kind) last.text += text;
		else runs.push({ text, kind });
	};
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		if (a[i] === b[j]) {
			push(a[i] ?? "", "same");
			i += 1;
			j += 1;
		} else if ((lengths[(i + 1) * width + j] ?? 0) >= (lengths[i * width + j + 1] ?? 0)) {
			push(a[i] ?? "", "del");
			i += 1;
		} else {
			push(b[j] ?? "", "ins");
			j += 1;
		}
	}
	for (; i < a.length; i += 1) push(a[i] ?? "", "del");
	for (; j < b.length; j += 1) push(b[j] ?? "", "ins");
	return runs;
}
