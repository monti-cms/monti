/** A unified diff of two texts, with 2 lines of context. Files are small, so a plain LCS is enough. */
export function unifiedDiff(file: string, before: string, after: string): string {
	const a = before.split("\n");
	const b = after.split("\n");
	const width = b.length + 1;
	// lcs[i * width + j]: length of the longest common run of a[i..] and b[j..]
	const lcs = new Array<number>((a.length + 1) * width).fill(0);
	const at = (i: number, j: number) => lcs[i * width + j] ?? 0;
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			lcs[i * width + j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
		}
	}
	const ops: { op: " " | "-" | "+"; line: string }[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length || j < b.length) {
		if (i < a.length && j < b.length && a[i] === b[j]) {
			ops.push({ op: " ", line: a[i] ?? "" });
			i++;
			j++;
		} else if (i < a.length && (j >= b.length || at(i + 1, j) >= at(i, j + 1))) {
			ops.push({ op: "-", line: a[i] ?? "" });
			i++;
		} else {
			ops.push({ op: "+", line: b[j] ?? "" });
			j++;
		}
	}
	const CONTEXT = 2;
	const lines = [`--- a/${file}`, `+++ b/${file}`];
	let gap = false;
	for (const [index, entry] of ops.entries()) {
		const near = ops.slice(Math.max(0, index - CONTEXT), index + CONTEXT + 1).some((other) => other.op !== " ");
		if (!near) {
			gap = true;
			continue;
		}
		if (gap && lines.length > 2) lines.push("...");
		gap = false;
		lines.push(`${entry.op}${entry.line}`);
	}
	return lines.join("\n");
}
