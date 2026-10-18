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
const found = (p) => (p.found ? `, found \`${p.found}\`` : "");
/** The English sentence of each code. */
const ENGLISH = {
    comment_unclosed: () => "a comment that is never closed",
    string_unclosed: () => "a string that is never closed",
    escape_malformed: () => "a malformed escape in a string",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: names the syntax it refuses
    template_expression: () => "a template expression `${...}`",
    expected_token: (p) => `expected ${p.what ?? `\`${p.expected}\``}${found(p)}`,
    expected_value: () => "expected a value",
    expected_name: (p) => `expected a property name${found(p)}`,
    expected_import: () => 'expected `import { defineSchema } from "@monti-cms/core"`',
    expected_module: () => `expected "${SCHEMA_MODULE}"`,
    expected_schema_object: (p) => `expected the schema object \`{\`${found(p)}`,
    computed_key: () => "a computed key `[...]`",
    spread: () => "a spread `...`",
    method: (p) => `a method or accessor \`${p.name}\``,
    shorthand: (p) => `the shorthand property \`${p.name}\` (write \`${p.name}: <value>\`)`,
    proto_key: () => "the key `__proto__`",
    duplicate_key: (p) => `the key \`${p.name}\` is written twice`,
    empty_slot: () => "an empty slot in a list",
    not_data: (p) => `an expression that is not data, starting with \`${p.found}\``,
    call: (p) => `a function call \`${p.name}(...)\``,
    access: (p) => `a property access on \`${p.name}\``,
    identifier: (p) => `the identifier \`${p.name}\` (a schema holds data only)`,
    foreign_module: () => `an import from a module other than "${SCHEMA_MODULE}"`,
    second_import: () => "a second import (only `defineSchema` is imported)",
    code_before: (p) => `code before the schema (\`${p.name}\`)`,
    code_after: () => "code after the schema",
};
class Refused extends Error {
    at;
    code;
    params;
    constructor(code, params, at) {
        super(ENGLISH[code](params));
        this.code = code;
        this.params = params;
        this.at = at;
    }
}
const NAME = /[A-Za-z_$][\w$]*/y;
const NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
const SIMPLE_ESCAPES = {
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
function read(text) {
    let at = 0;
    let comments = false;
    const refuse = (code, params = {}, position = at) => {
        throw new Refused(code, params, position);
    };
    const here = () => (text[at] === undefined ? {} : { found: text[at] });
    const skip = () => {
        for (;;) {
            const char = text[at];
            if (char === undefined)
                return;
            if (char === "﻿" || /\s/.test(char)) {
                at += 1;
            }
            else if (char === "/" && text[at + 1] === "/") {
                comments = true;
                while (at < text.length && text[at] !== "\n")
                    at += 1;
            }
            else if (char === "/" && text[at + 1] === "*") {
                comments = true;
                const end = text.indexOf("*/", at + 2);
                if (end === -1)
                    refuse("comment_unclosed");
                at = end + 2;
            }
            else
                return;
        }
    };
    const peek = () => {
        skip();
        return text[at];
    };
    const word = () => {
        skip();
        NAME.lastIndex = at;
        return NAME.exec(text)?.[0];
    };
    const eat = (expected, what) => {
        if (peek() !== expected)
            refuse("expected_token", { expected, ...(what === undefined ? {} : { what }), ...here() });
        at += 1;
    };
    const eatWord = (expected) => {
        if (word() !== expected)
            refuse("expected_token", { expected });
        at += expected.length;
    };
    const string = () => {
        const quote = text[at];
        const start = at;
        at += 1;
        let out = "";
        for (;;) {
            const char = text[at];
            if (char === undefined)
                refuse("string_unclosed", {}, start);
            if (char === quote) {
                at += 1;
                return out;
            }
            if (quote !== "`" && char === "\n")
                refuse("string_unclosed", {}, start);
            if (quote === "`" && char === "$" && text[at + 1] === "{")
                refuse("template_expression", {}, at);
            if (char !== "\\") {
                out += char;
                at += 1;
                continue;
            }
            const next = text[at + 1];
            if (next === undefined)
                refuse("string_unclosed", {}, start);
            if (next === "\n") {
                at += 2;
            }
            else if (next === "x" || next === "u") {
                const braced = next === "u" && text[at + 2] === "{";
                const close = braced ? text.indexOf("}", at) : -1;
                const digits = braced ? text.slice(at + 3, close) : text.slice(at + 2, at + 2 + (next === "x" ? 2 : 4));
                if (!/^[0-9a-fA-F]+$/.test(digits) ||
                    (!braced && digits.length !== (next === "x" ? 2 : 4)) ||
                    (braced && close === -1)) {
                    refuse("escape_malformed", {}, at);
                }
                const code = Number.parseInt(digits, 16);
                if (code > 0x10ffff)
                    refuse("escape_malformed", {}, at);
                out += String.fromCodePoint(code);
                at += braced ? close + 1 - at : 2 + digits.length;
            }
            else {
                out += SIMPLE_ESCAPES[next] ?? next;
                at += 2;
            }
        }
    };
    const key = () => {
        const char = peek();
        if (char === '"' || char === "'")
            return string();
        if (char === "[")
            return refuse("computed_key");
        if (char === ".")
            return refuse("spread");
        NUMBER.lastIndex = at;
        const number = NUMBER.exec(text)?.[0];
        if (number !== undefined) {
            at += number.length;
            return String(Number(number));
        }
        const name = word();
        if (name === undefined)
            return refuse("expected_name", char === undefined ? {} : { found: char });
        at += name.length;
        const after = peek();
        if (after === "(" || (after !== ":" && /^(?:get|set|async|static)$/.test(name))) {
            refuse("method", { name }, at - name.length);
        }
        if (after !== ":")
            refuse("shorthand", { name }, at - name.length);
        return name;
    };
    const value = () => {
        const char = peek();
        if (char === undefined)
            return refuse("expected_value");
        if (char === "{") {
            at += 1;
            const result = {};
            for (;;) {
                if (peek() === "}") {
                    at += 1;
                    return result;
                }
                if (text.startsWith("...", at))
                    refuse("spread");
                const start = at;
                const name = key();
                if (name === "__proto__")
                    refuse("proto_key", {}, start);
                if (Object.hasOwn(result, name))
                    refuse("duplicate_key", { name }, start);
                eat(":");
                result[name] = value();
                if (peek() === ",")
                    at += 1;
                else if (peek() !== "}")
                    refuse("expected_token", { what: "`,` or `}`", ...here() });
            }
        }
        if (char === "[") {
            at += 1;
            const result = [];
            for (;;) {
                if (peek() === "]") {
                    at += 1;
                    return result;
                }
                if (text.startsWith("...", at))
                    refuse("spread");
                if (peek() === ",")
                    refuse("empty_slot");
                result.push(value());
                if (peek() === ",")
                    at += 1;
                else if (peek() !== "]")
                    refuse("expected_token", { what: "`,` or `]`", ...here() });
            }
        }
        if (char === '"' || char === "'" || char === "`")
            return string();
        NUMBER.lastIndex = at;
        const number = NUMBER.exec(text)?.[0];
        if (number !== undefined) {
            at += number.length;
            return Number(number);
        }
        const name = word();
        if (name === undefined)
            return refuse("not_data", { found: char });
        const start = at;
        at += name.length;
        if (name === "true")
            return true;
        if (name === "false")
            return false;
        if (name === "null")
            return null;
        const after = peek();
        if (after === "(")
            return refuse("call", { name }, start);
        if (after === ".")
            return refuse("access", { name }, start);
        return refuse("identifier", { name }, start);
    };
    // import { defineSchema } from "@monti-cms/core";
    const first = word();
    if (first !== "import") {
        if (first === undefined)
            return refuse("expected_import");
        return refuse("code_before", { name: first });
    }
    at += "import".length;
    eat("{");
    eatWord("defineSchema");
    eat("}");
    eatWord("from");
    const quote = peek();
    if (quote !== '"' && quote !== "'")
        refuse("expected_module");
    const moduleAt = at;
    if (string() !== SCHEMA_MODULE)
        refuse("foreign_module", {}, moduleAt);
    if (peek() === ";")
        at += 1;
    if (word() === "import")
        refuse("second_import");
    // export default defineSchema({ ... });
    const next = word();
    if (next !== undefined && next !== "export")
        refuse("code_before", { name: next });
    eatWord("export");
    eatWord("default");
    eatWord("defineSchema");
    eat("(");
    if (peek() !== "{")
        refuse("expected_schema_object", here());
    const result = value();
    eat(")");
    if (peek() === ";")
        at += 1;
    if (peek() !== undefined)
        refuse("code_after");
    return { value: result, comments };
}
const lineOf = (text, at) => {
    const before = text.slice(0, at);
    return { line: before.split("\n").length, column: at - (before.lastIndexOf("\n") + 1) + 1 };
};
/** Parses the text of a schema file that is a pure literal. A file that has code (or is not valid) is refused with a message that names the line. */
export function parseSchemaLiteral(text) {
    try {
        return { ok: true, ...read(text) };
    }
    catch (error) {
        if (!(error instanceof Refused))
            throw error;
        const { line, column } = lineOf(text, error.at);
        return {
            ok: false,
            message: `line ${line}: ${error.message}`,
            code: error.code,
            params: error.params,
            line,
            column,
        };
    }
}
