/** 낱말 단위 바뀐 곳(문체 다듬기 미리보기). `same`은 그대로, `del`은 빠진 글, `add`는 더한 글이다. */
export type DiffPart = { readonly type: "same" | "del" | "add"; readonly text: string };

/** 낱말·공백·문장 부호 단위로 나눈다. 한국어는 어절 단위다. */
const tokens = (text: string) => text.match(/\s+|[^\s\p{P}]+|\p{P}/gu) ?? [];

/** 비교할 최대 낱말 수. 넘으면 통째로 바뀐 것으로 본다(긴 글의 표 계산을 막는다). */
const MAX_TOKENS = 3000;

/** 가장 긴 공통 부분열로 두 글의 바뀐 곳을 찾는다. 이웃한 같은 종류는 합친다. */
export function diffWords(before: string, after: string): DiffPart[] {
	const a = tokens(before);
	const b = tokens(after);
	if (a.length * b.length > MAX_TOKENS * MAX_TOKENS || a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
		return [
			{ type: "del", text: before },
			{ type: "add", text: after },
		];
	}
	const rows = a.length + 1;
	const cols = b.length + 1;
	const table = new Uint32Array(rows * cols);
	for (let i = a.length - 1; i >= 0; i--) {
		for (let j = b.length - 1; j >= 0; j--) {
			table[i * cols + j] =
				a[i] === b[j]
					? (table[(i + 1) * cols + j + 1] ?? 0) + 1
					: Math.max(table[(i + 1) * cols + j] ?? 0, table[i * cols + j + 1] ?? 0);
		}
	}
	const parts: DiffPart[] = [];
	const push = (type: DiffPart["type"], text: string) => {
		const last = parts.at(-1);
		if (last?.type === type) parts[parts.length - 1] = { type, text: last.text + text };
		else parts.push({ type, text });
	};
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		if (a[i] === b[j]) {
			push("same", a[i] ?? "");
			i++;
			j++;
		} else if ((table[(i + 1) * cols + j] ?? 0) >= (table[i * cols + j + 1] ?? 0)) {
			push("del", a[i++] ?? "");
		} else {
			push("add", b[j++] ?? "");
		}
	}
	while (i < a.length) push("del", a[i++] ?? "");
	while (j < b.length) push("add", b[j++] ?? "");
	return parts;
}
