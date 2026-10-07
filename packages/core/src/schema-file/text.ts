/**
 * Writes the schema file back as text with as little change as possible, so a change made in the admin shows up in a code review as that change and nothing
 * else. The previous text is parsed with positions; every part of the new content that equals the same place of the old content is copied from the old text
 * as it was written (hand-formatted arrays, spacing, long lines), and only what changed is written fresh, in the file's own indentation. Keys keep the order
 * of the new content, which is the old order for everything that was not moved. A trailing newline (or none) is kept.
 */

/** One JSON value of the old text with the span it was written in. */
interface Spot {
	readonly start: number;
	readonly end: number;
	readonly depth: number;
	readonly value: unknown;
	readonly entries?: ReadonlyMap<string, Spot>;
	readonly items?: readonly Spot[];
}

const WHITESPACE = /\s/;

/** Parses JSON text into spans. The text must be valid JSON (callers parse it with `JSON.parse` first). */
function locate(text: string): Spot {
	let at = 0;
	const skip = () => {
		while (at < text.length && WHITESPACE.test(text[at] ?? "")) at += 1;
	};
	const string = (): string => {
		const start = at;
		at += 1;
		while (at < text.length && text[at] !== '"') at += text[at] === "\\" ? 2 : 1;
		at += 1;
		return JSON.parse(text.slice(start, at)) as string;
	};
	const value = (depth: number): Spot => {
		skip();
		const start = at;
		const first = text[at];
		if (first === "{") {
			at += 1;
			const entries = new Map<string, Spot>();
			const result: Record<string, unknown> = {};
			skip();
			while (text[at] !== "}") {
				skip();
				const key = string();
				skip();
				at += 1; // :
				const child = value(depth + 1);
				entries.set(key, child);
				result[key] = child.value;
				skip();
				if (text[at] === ",") at += 1;
				skip();
			}
			at += 1;
			return { start, end: at, depth, value: result, entries };
		}
		if (first === "[") {
			at += 1;
			const items: Spot[] = [];
			skip();
			while (text[at] !== "]") {
				items.push(value(depth + 1));
				skip();
				if (text[at] === ",") at += 1;
				skip();
			}
			at += 1;
			return { start, end: at, depth, value: items.map((item) => item.value), items };
		}
		if (first === '"') {
			const parsed = string();
			return { start, end: at, depth, value: parsed };
		}
		while (at < text.length && !/[\s,}\]]/.test(text[at] ?? "")) at += 1;
		return { start, end: at, depth, value: JSON.parse(text.slice(start, at)) };
	};
	return value(0);
}

/** The indentation unit of a text: a tab, or the spaces of the first indented line. A tab if the text has none. */
export function indentOf(text: string): string {
	const line = text.split("\n").find((item) => /^[ \t]+\S/.test(item));
	const lead = line ? (/^[ \t]+/.exec(line)?.[0] ?? "") : "";
	return lead.startsWith(" ") ? lead : "\t";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);
/** Whether two JSON values are the same, key order included (a reordered object is a change). */
function sameJson(a: unknown, b: unknown): boolean {
	if (Array.isArray(a))
		return Array.isArray(b) && a.length === b.length && a.every((item, index) => sameJson(item, b[index]));
	if (isRecord(a)) {
		if (!isRecord(b)) return false;
		const left = Object.keys(a).filter((key) => a[key] !== undefined);
		const right = Object.keys(b).filter((key) => b[key] !== undefined);
		return left.length === right.length && left.every((key, index) => key === right[index] && sameJson(a[key], b[key]));
	}
	return a === b;
}
const isPrimitive = (value: unknown): boolean => !isRecord(value) && !Array.isArray(value);

/**
 * The text of a schema file for `next`, written over `previous` (the text it replaces; pass `undefined` for a new file). With `previous` the unchanged parts keep
 * their text; the rest is written with the indentation of `previous`.
 */
export function formatSchemaText(previous: string | undefined, next: unknown): string {
	if (previous === undefined || previous.trim() === "") return `${JSON.stringify(next, null, "\t")}\n`;
	const root = locate(previous);
	const unit = indentOf(previous);
	const pad = (depth: number) => unit.repeat(depth);

	/** The old text of a value, moved to `depth` when it sat at another depth. */
	const reuse = (spot: Spot, depth: number): string => {
		const text = previous.slice(spot.start, spot.end);
		const delta = depth - spot.depth;
		if (delta === 0 || !text.includes("\n")) return text;
		return text
			.split("\n")
			.map((line, index) => {
				if (index === 0) return line;
				if (delta > 0) return `${pad(delta)}${line}`;
				let rest = line;
				for (let step = 0; step < -delta && rest.startsWith(unit); step += 1) rest = rest.slice(unit.length);
				return rest;
			})
			.join("\n");
	};

	const emit = (value: unknown, spot: Spot | undefined, depth: number): string => {
		if (spot && sameJson(value, spot.value)) return reuse(spot, depth);
		if (Array.isArray(value)) {
			if (value.length === 0) return "[]";
			const old = spot?.items ? spot : undefined;
			const wasInline = old !== undefined && !previous.slice(old.start, old.end).includes("\n");
			if (wasInline && value.every(isPrimitive)) {
				const spaced = /,\s/.test(previous.slice(old.start, old.end));
				return `[${value.map((item) => JSON.stringify(item)).join(spaced ? ", " : ",")}]`;
			}
			const lines = value.map((item, index) => `${pad(depth + 1)}${emit(item, old?.items?.[index], depth + 1)}`);
			return `[\n${lines.join(",\n")}\n${pad(depth)}]`;
		}
		if (isRecord(value)) {
			const keys = Object.keys(value).filter((key) => value[key] !== undefined);
			if (keys.length === 0) return "{}";
			const old = spot?.entries ? spot : undefined;
			const wasInline = old !== undefined && !previous.slice(old.start, old.end).includes("\n");
			if (wasInline && keys.every((key) => isPrimitive(value[key]))) {
				const body = keys.map((key) => `${JSON.stringify(key)}: ${JSON.stringify(value[key])}`).join(", ");
				return `{ ${body} }`;
			}
			const lines = keys.map(
				(key) => `${pad(depth + 1)}${JSON.stringify(key)}: ${emit(value[key], old?.entries?.get(key), depth + 1)}`,
			);
			return `{\n${lines.join(",\n")}\n${pad(depth)}}`;
		}
		return JSON.stringify(value);
	};

	const body = emit(next, root, 0);
	return `${previous.slice(0, root.start)}${body}${previous.slice(root.end)}`;
}
