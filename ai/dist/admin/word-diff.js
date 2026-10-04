/** Splits into words, whitespace and punctuation. For Korean, the unit is the eojeol (space-separated word). */
const tokens = (text) => text.match(/\s+|[^\s\p{P}]+|\p{P}/gu) ?? [];
/** Maximum number of words to compare. Beyond it, the text is treated as entirely changed (prevents the table computation on long text). */
const MAX_TOKENS = 3000;
/** Finds the changes between two texts using the longest common subsequence. Adjacent runs of the same kind are merged. */
export function diffWords(before, after) {
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
    const parts = [];
    const push = (type, text) => {
        const last = parts.at(-1);
        if (last?.type === type)
            parts[parts.length - 1] = { type, text: last.text + text };
        else
            parts.push({ type, text });
    };
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
            push("same", a[i] ?? "");
            i++;
            j++;
        }
        else if ((table[(i + 1) * cols + j] ?? 0) >= (table[i * cols + j + 1] ?? 0)) {
            push("del", a[i++] ?? "");
        }
        else {
            push("add", b[j++] ?? "");
        }
    }
    while (i < a.length)
        push("del", a[i++] ?? "");
    while (j < b.length)
        push("add", b[j++] ?? "");
    return parts;
}
