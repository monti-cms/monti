/** One line of a line diff: in both texts (`same`), only in the first (`remove`) or only in the second (`add`). */
export interface DiffLine {
	readonly type: "same" | "remove" | "add";
	readonly text: string;
}

/** Above this many cells the table of a diff would be too big for a browser tab; the two texts are then shown as wholly different. */
const MAX_CELLS = 4_000_000;

const linesOf = (text: string): string[] => {
	if (text === "") return [];
	const lines = text.replace(/\r\n/g, "\n").split("\n");
	if (lines.at(-1) === "") lines.pop();
	return lines;
};

/**
 * A line diff of two texts (the longest common subsequence of their lines). `remove` lines are in `before` only, `add` lines in `after` only. For the conflict
 * screen: `before` is the server's text and `after` is git's.
 */
export function lineDiff(before: string, after: string): DiffLine[] {
	const a = linesOf(before);
	const b = linesOf(after);
	let start = 0;
	while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
	let endA = a.length;
	let endB = b.length;
	while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
		endA -= 1;
		endB -= 1;
	}
	const head: DiffLine[] = a.slice(0, start).map((text) => ({ type: "same", text }));
	const tail: DiffLine[] = a.slice(endA).map((text) => ({ type: "same", text }));
	const middleA = a.slice(start, endA);
	const middleB = b.slice(start, endB);

	if ((middleA.length + 1) * (middleB.length + 1) > MAX_CELLS) {
		return [
			...head,
			...middleA.map((text): DiffLine => ({ type: "remove", text })),
			...middleB.map((text): DiffLine => ({ type: "add", text })),
			...tail,
		];
	}

	// lcs[i][j]: the length of the common subsequence of middleA[i..] and middleB[j..].
	const width = middleB.length + 1;
	const lcs = new Uint32Array((middleA.length + 1) * width);
	for (let i = middleA.length - 1; i >= 0; i -= 1) {
		for (let j = middleB.length - 1; j >= 0; j -= 1) {
			lcs[i * width + j] =
				middleA[i] === middleB[j]
					? (lcs[(i + 1) * width + j + 1] ?? 0) + 1
					: Math.max(lcs[(i + 1) * width + j] ?? 0, lcs[i * width + j + 1] ?? 0);
		}
	}
	const middle: DiffLine[] = [];
	let i = 0;
	let j = 0;
	while (i < middleA.length && j < middleB.length) {
		if (middleA[i] === middleB[j]) {
			middle.push({ type: "same", text: middleA[i] ?? "" });
			i += 1;
			j += 1;
		} else if ((lcs[(i + 1) * width + j] ?? 0) >= (lcs[i * width + j + 1] ?? 0)) {
			middle.push({ type: "remove", text: middleA[i] ?? "" });
			i += 1;
		} else {
			middle.push({ type: "add", text: middleB[j] ?? "" });
			j += 1;
		}
	}
	for (; i < middleA.length; i += 1) middle.push({ type: "remove", text: middleA[i] ?? "" });
	for (; j < middleB.length; j += 1) middle.push({ type: "add", text: middleB[j] ?? "" });
	return [...head, ...middle, ...tail];
}
