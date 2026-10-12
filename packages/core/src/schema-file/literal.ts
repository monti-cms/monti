/**
 * Reads `monti.schema.ts` as plain text when it is a pure literal: the `defineSchema` import, `export default defineSchema(<object literal>)`, and nothing else.
 * The admin's schema settings screen rewrites the file only when this accepts it, so code in the file (an import, a spread, a call, a variable) is never overwritten.
 *
 * It is a small parser of the literal subset, not of TypeScript: objects, arrays, strings (quotes, no template expressions), numbers, `true`, `false` and `null`;
 * keys that are names, strings or numbers; comments; trailing commas. Anything else is refused with the line it was found on. It accepts what `printSchemaFile`
 * writes and what a person would write by hand in the same shape. The runtime reads the schema by importing the module, never through this parser.
 */

/** The module the one import of the file names. */
export const SCHEMA_MODULE = "@monti-cms/core";

export type SchemaLiteral =
	| {
			readonly ok: true;
			/** The object passed to `defineSchema`. */
			readonly value: Record<string, unknown>;
			/** The file has comments; writing it again drops them. */
			readonly comments: boolean;
	  }
	| {
			readonly ok: false;
			/** What in the file is code (or not valid), with its line. */
			readonly message: string;
			readonly line: number;
			readonly column: number;
	  };

class Refused extends Error {
	readonly at: number;
	constructor(message: string, at: number) {
		super(message);
		this.at = at;
	}
}

const NAME = /[A-Za-z_$][\w$]*/y;
const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const SIMPLE_ESCAPES: Readonly<Record<string, string>> = {
	n: "\n",
	t: "\t",
	r: "\r",
	b: "\b",
	f: "\f",
	v: "\v",
	"0": "\0",
	"\\": "\\",
	"'": "'",
	'"': '"',
	"`": "`",
};

function read(text: string): { value: Record<string, unknown>; comments: boolean } {
	let at = 0;
	let comments = false;
	const refuse = (message: string, position = at): never => {
		throw new Refused(message, position);
	};

	const skip = () => {
		for (;;) {
			const char = text[at];
			if (char === undefined) return;
			if (char === "﻿" || /\s/.test(char)) {
				at += 1;
			} else if (char === "/" && text[at + 1] === "/") {
				comments = true;
				while (at < text.length && text[at] !== "\n") at += 1;
			} else if (char === "/" && text[at + 1] === "*") {
				comments = true;
				const end = text.indexOf("*/", at + 2);
				if (end === -1) refuse("a comment that is never closed");
				at = end + 2;
			} else return;
		}
	};
	const peek = (): string | undefined => {
		skip();
		return text[at];
	};
	const word = (): string | undefined => {
		skip();
		NAME.lastIndex = at;
		return NAME.exec(text)?.[0];
	};
	const eat = (expected: string, what = `\`${expected}\``) => {
		if (peek() !== expected) refuse(`expected ${what}${text[at] === undefined ? "" : `, found \`${text[at]}\``}`);
		at += 1;
	};
	const eatWord = (expected: string) => {
		if (word() !== expected) refuse(`expected \`${expected}\``);
		at += expected.length;
	};

	const string = (): string => {
		const quote = text[at] as string;
		const start = at;
		at += 1;
		let out = "";
		for (;;) {
			const char = text[at];
			if (char === undefined) refuse("a string that is never closed", start);
			if (char === quote) {
				at += 1;
				return out;
			}
			if (quote !== "`" && char === "\n") refuse("a string that is never closed", start);
			if (quote === "`" && char === "$" && text[at + 1] === "{") refuse("a template expression `${...}`", at);
			if (char !== "\\") {
				out += char;
				at += 1;
				continue;
			}
			const next = text[at + 1];
			if (next === undefined) refuse("a string that is never closed", start);
			if (next === "\n") {
				at += 2;
			} else if (next === "x" || next === "u") {
				const braced = next === "u" && text[at + 2] === "{";
				const close = braced ? text.indexOf("}", at) : -1;
				const digits = braced ? text.slice(at + 3, close) : text.slice(at + 2, at + 2 + (next === "x" ? 2 : 4));
				if (
					!/^[0-9a-fA-F]+$/.test(digits) ||
					(!braced && digits.length !== (next === "x" ? 2 : 4)) ||
					(braced && close === -1)
				) {
					refuse("a malformed escape in a string", at);
				}
				const code = Number.parseInt(digits, 16);
				if (code > 0x10ffff) refuse("a malformed escape in a string", at);
				out += String.fromCodePoint(code);
				at += braced ? close + 1 - at : 2 + digits.length;
			} else {
				out += SIMPLE_ESCAPES[next] ?? next;
				at += 2;
			}
		}
	};

	const key = (): string => {
		const char = peek();
		if (char === '"' || char === "'") return string();
		if (char === "[") return refuse("a computed key `[...]`");
		if (char === ".") return refuse("a spread `...`");
		NUMBER.lastIndex = at;
		const number = NUMBER.exec(text)?.[0];
		if (number !== undefined) {
			at += number.length;
			return String(Number(number));
		}
		const name = word();
		if (name === undefined) return refuse(`expected a property name${char === undefined ? "" : `, found \`${char}\``}`);
		at += name.length;
		const after = peek();
		if (after === "(" || (after !== ":" && /^(?:get|set|async|static)$/.test(name))) {
			refuse(`a method or accessor \`${name}\``, at - name.length);
		}
		if (after !== ":") refuse(`the shorthand property \`${name}\` (write \`${name}: <value>\`)`, at - name.length);
		return name;
	};

	const value = (): unknown => {
		const char = peek();
		if (char === undefined) return refuse("expected a value");
		if (char === "{") {
			at += 1;
			const result: Record<string, unknown> = {};
			for (;;) {
				if (peek() === "}") {
					at += 1;
					return result;
				}
				if (text.startsWith("...", at)) refuse("a spread `...`");
				const start = at;
				const name = key();
				if (name === "__proto__") refuse("the key `__proto__`", start);
				if (Object.hasOwn(result, name)) refuse(`the key \`${name}\` is written twice`, start);
				eat(":");
				result[name] = value();
				if (peek() === ",") at += 1;
				else if (peek() !== "}")
					refuse(`expected \`,\` or \`}\`${text[at] === undefined ? "" : `, found \`${text[at]}\``}`);
			}
		}
		if (char === "[") {
			at += 1;
			const result: unknown[] = [];
			for (;;) {
				if (peek() === "]") {
					at += 1;
					return result;
				}
				if (text.startsWith("...", at)) refuse("a spread `...`");
				if (peek() === ",") refuse("an empty slot in a list");
				result.push(value());
				if (peek() === ",") at += 1;
				else if (peek() !== "]")
					refuse(`expected \`,\` or \`]\`${text[at] === undefined ? "" : `, found \`${text[at]}\``}`);
			}
		}
		if (char === '"' || char === "'" || char === "`") return string();
		NUMBER.lastIndex = at;
		const number = NUMBER.exec(text)?.[0];
		if (number !== undefined) {
			at += number.length;
			return Number(number);
		}
		const name = word();
		if (name === undefined) return refuse(`an expression that is not data, starting with \`${char}\``);
		const start = at;
		at += name.length;
		if (name === "true") return true;
		if (name === "false") return false;
		if (name === "null") return null;
		const after = peek();
		if (after === "(") return refuse(`a function call \`${name}(...)\``, start);
		if (after === ".") return refuse(`a property access on \`${name}\``, start);
		return refuse(`the identifier \`${name}\` (a schema holds data only)`, start);
	};

	// import { defineSchema } from "@monti-cms/core";
	const first = word();
	if (first !== "import") {
		refuse(
			first === undefined
				? 'expected `import { defineSchema } from "@monti-cms/core"`'
				: `code before the schema (\`${first}\`)`,
		);
	}
	at += "import".length;
	eat("{");
	eatWord("defineSchema");
	eat("}");
	eatWord("from");
	const quote = peek();
	if (quote !== '"' && quote !== "'") refuse(`expected "${SCHEMA_MODULE}"`);
	const moduleAt = at;
	if (string() !== SCHEMA_MODULE) refuse(`an import from a module other than "${SCHEMA_MODULE}"`, moduleAt);
	if (peek() === ";") at += 1;
	if (word() === "import") refuse("a second import (only `defineSchema` is imported)");

	// export default defineSchema({ ... });
	const next = word();
	if (next !== undefined && next !== "export") refuse(`code before the schema (\`${next}\`)`);
	eatWord("export");
	eatWord("default");
	eatWord("defineSchema");
	eat("(");
	if (peek() !== "{")
		refuse(`expected the schema object \`{\`${text[at] === undefined ? "" : `, found \`${text[at]}\``}`);
	const result = value() as Record<string, unknown>;
	eat(")");
	if (peek() === ";") at += 1;
	if (peek() !== undefined) refuse("code after the schema");
	return { value: result, comments };
}

const lineOf = (text: string, at: number): { line: number; column: number } => {
	const before = text.slice(0, at);
	return { line: before.split("\n").length, column: at - (before.lastIndexOf("\n") + 1) + 1 };
};

/** Parses the text of a schema file that is a pure literal. A file that has code (or is not valid) is refused with a message that names the line. */
export function parseSchemaLiteral(text: string): SchemaLiteral {
	try {
		return { ok: true, ...read(text) };
	} catch (error) {
		if (!(error instanceof Refused)) throw error;
		const { line, column } = lineOf(text, error.at);
		return { ok: false, message: `line ${line}: ${error.message}`, line, column };
	}
}
