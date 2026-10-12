import { SCHEMA_MODULE } from "./literal";

/**
 * Writes the schema as the text of `monti.schema.ts`, the same text for the same data: the `defineSchema` import, then `export default defineSchema({ ... });`.
 * Keys keep the order of the data. Tabs, trailing commas, double-quoted strings, keys unquoted where they are names. A list of plain values and a small object of plain
 * values stay on one line when they fit; everything else has a line per entry. The admin's schema settings screen writes the file with it, so a save changes the
 * lines that changed and the file is formatted the way the formatter of the repo leaves it.
 */

const NAME = /^[A-Za-z_$][\w$]*$/;
/** The width a list may take on one line (the formatter's line width). Tabs count as two columns. */
const LINE_WIDTH = 120;
/** The width a small object may take on one line. Lower than a line, so a field with a few options stays readable. */
const OBJECT_WIDTH = 80;
const TAB = 2;

const WIDE =
	/[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]|\p{Extended_Pictographic}/u;

/** The columns a text takes on a line: wide characters (Korean, Chinese, Japanese, emoji) take two, as the formatter counts them. */
const widthOf = (text: string): number => {
	let width = 0;
	for (const char of text) width += WIDE.test(char) ? 2 : 1;
	return width;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const keyText = (key: string): string => {
	if (key === "__proto__") throw new Error('a schema cannot hold the key "__proto__"');
	return NAME.test(key) ? key : JSON.stringify(key);
};

function primitive(value: unknown): string | undefined {
	if (value === null) return "null";
	if (typeof value === "boolean") return String(value);
	if (typeof value === "string") return JSON.stringify(value);
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new Error(`a schema cannot hold the number ${value}`);
		return String(value);
	}
	if (typeof value === "object" || value === undefined) return undefined;
	throw new Error(`a schema cannot hold a ${typeof value}`);
}

/** The entries of an object that are set. */
const entriesOf = (value: Record<string, unknown>): [string, unknown][] =>
	Object.entries(value).filter(([, item]) => item !== undefined);

/** The one-line text of a value made of plain values (and objects and lists of them), or `undefined` when it has to be written on several lines. */
function flat(value: unknown): string | undefined {
	const plain = primitive(value);
	if (plain !== undefined) return plain;
	if (Array.isArray(value)) {
		const items = value.map(flat);
		return items.every((item) => item !== undefined) ? `[${items.join(", ")}]` : undefined;
	}
	if (isRecord(value)) {
		const entries = entriesOf(value);
		if (entries.length === 0) return "{}";
		if (!entries.every(([, item]) => primitive(item) !== undefined)) return undefined;
		return `{ ${entries.map(([key, item]) => `${keyText(key)}: ${flat(item)}`).join(", ")} }`;
	}
	return undefined;
}

const manyEntries = (value: unknown): boolean =>
	Array.isArray(value) ? value.length > 1 : isRecord(value) && entriesOf(value).length > 1;

/** The text of `value` written after `column` columns of the line (its indentation and its key). */
function print(value: unknown, depth: number, column: number, expand = false): string {
	const plain = primitive(value);
	if (plain !== undefined) return plain;
	const pad = "\t".repeat(depth + 1);
	const end = "\t".repeat(depth);
	if (Array.isArray(value)) {
		if (value.length === 0) return "[]";
		const oneLine = flat(value);
		// A list of several objects with several keys each is always written out, as the formatter does.
		const written = value.length > 1 && value.every(manyEntries);
		if (oneLine !== undefined && !written && column + widthOf(oneLine) + 1 <= LINE_WIDTH) return oneLine;
		const lines = value.map((item) => `${pad}${print(item, depth + 1, (depth + 1) * TAB)},`);
		return `[\n${lines.join("\n")}\n${end}]`;
	}
	if (isRecord(value)) {
		const entries = entriesOf(value);
		if (entries.length === 0) return "{}";
		const oneLine = flat(value);
		if (!expand && oneLine !== undefined && column + widthOf(oneLine) + 1 <= OBJECT_WIDTH) return oneLine;
		const lines = entries.map(([key, item]) => {
			const name = keyText(key);
			const column = (depth + 1) * TAB + name.length + 2;
			const value = print(item, depth + 1, column);
			// A string that does not fit after its key goes on the next line, as the formatter writes it.
			if (typeof item === "string" && column + widthOf(value) + 1 > LINE_WIDTH)
				return `${pad}${name}:\n${pad}\t${value},`;
			return `${pad}${name}: ${value},`;
		});
		return `{\n${lines.join("\n")}\n${end}}`;
	}
	throw new Error(`a schema cannot hold a ${typeof value}`);
}

/** The text of `monti.schema.ts` for `schema` (the data of the file: `schemaVersion`, `collections`, `locales`, ...). */
export function printSchemaFile(schema: Record<string, unknown>): string {
	return `import { defineSchema } from "${SCHEMA_MODULE}";\n\nexport default defineSchema(${print(schema, 0, 0, true)});\n`;
}
