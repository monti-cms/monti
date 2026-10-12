/**
 * The two edits `monti init` makes to files the app owns: wrap the export of `next.config` in `withCms(...)`, and put `suppressHydrationWarning` on the `<html>` of the
 * root layout. Both work on the text of the file and decide first whether they can do it safely: a file whose shape is not one of the few simple ones is not touched, and
 * the result says why, so the step can be listed for the person to do by hand. Nothing here reads or writes a file.
 */
import { ignoresEnvLocal } from "./init-detect.js";
export const NEXT_CONFIG_IMPORT = 'import { withCms } from "@monti-cms/nextjs/config";';
/** The index after the string, template literal or comment that starts at `index`; `index` itself when nothing of the kind starts there. */
function skipLiteral(text, index) {
    const ch = text[index];
    if (ch === "/" && text[index + 1] === "/") {
        const end = text.indexOf("\n", index);
        return end === -1 ? text.length : end;
    }
    if (ch === "/" && text[index + 1] === "*") {
        const end = text.indexOf("*/", index + 2);
        return end === -1 ? text.length : end + 2;
    }
    if (ch === '"' || ch === "'") {
        let i = index + 1;
        while (i < text.length && text[i] !== ch && text[i] !== "\n")
            i += text[i] === "\\" ? 2 : 1;
        return i + 1;
    }
    if (ch === "`") {
        let i = index + 1;
        while (i < text.length && text[i] !== "`") {
            if (text[i] === "\\")
                i += 2;
            else if (text[i] === "$" && text[i + 1] === "{") {
                const close = matchingClose(text, i + 1);
                i = close === -1 ? text.length : close + 1;
            }
            else
                i += 1;
        }
        return i + 1;
    }
    return index;
}
/** The index of the bracket that closes the one at `open` (`(`, `[` or `{`), or `-1` when there is none. */
function matchingClose(text, open) {
    const pairs = { "(": ")", "[": "]", "{": "}" };
    const stack = [];
    for (let i = open; i < text.length;) {
        const skipped = skipLiteral(text, i);
        if (skipped !== i) {
            i = skipped;
            continue;
        }
        const ch = text[i];
        if (pairs[ch])
            stack.push(pairs[ch]);
        else if (ch === ")" || ch === "]" || ch === "}") {
            if (stack.pop() !== ch)
                return -1;
            if (stack.length === 0)
                return i;
        }
        i += 1;
    }
    return -1;
}
/** `text` without the blank space, semicolon and comments at its end. */
function withoutTrailingNoise(text) {
    let out = text;
    for (;;) {
        const next = out
            .replace(/\s+$/, "")
            .replace(/;$/, "")
            .replace(/\/\/[^\n]*$/, "")
            .replace(/\/\*[\s\S]*?\*\/$/, "");
        if (next === out)
            return out;
        out = next;
    }
}
/** Where the import line goes: after the last `import` statement at the start of a line (multi-line ones included), else below the comments the file starts with. */
function importInsertPoint(text) {
    let end = -1;
    const statement = /^import(?:\s[^;'"]*?\sfrom\s*|\s*)["'][^"']+["'][^\S\n]*;?[^\S\n]*$/gm;
    for (const match of text.matchAll(statement))
        end = Math.max(end, match.index + match[0].length);
    if (end >= 0)
        return end;
    // No import yet: below the comments and blank lines the file starts with (a `// @ts-check`, a license header), so they stay first.
    let at = 0;
    for (;;) {
        const lead = /^(?:[^\S\n]*\n)*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/[^\S\n]*)(?:\n|$)/.exec(text.slice(at));
        if (!lead)
            break;
        at += lead[0].length;
    }
    return at === 0 ? -1 : at - 1;
}
/** The text with the import line added after the last import (or at the top). */
function withImport(text) {
    const at = importInsertPoint(text);
    if (at < 0)
        return `${NEXT_CONFIG_IMPORT}\n${text}`;
    return `${text.slice(0, at)}\n${NEXT_CONFIG_IMPORT}${text.slice(at)}`;
}
const EXPORT_DEFAULT = /^export\s+default\s+/gm;
/**
 * Wraps the default export of a `next.config` file in `withCms(...)` and adds the import. It knows three shapes of the export, as long as it is the last thing in the
 * file: an identifier (`export default nextConfig`), an object (`export default { ... }`) and a call (`export default defineConfig({ ... })`). Anything else (a function,
 * `module.exports`, a `satisfies` or `as` suffix, more than one default export) is left alone and the reason is returned.
 */
export function wrapNextConfig(file, text) {
    if (text.includes("withCms"))
        return { status: "present" };
    const exports = [...text.matchAll(EXPORT_DEFAULT)];
    if (exports.length === 0 && /\bmodule\.exports\b/.test(text)) {
        return {
            status: "manual",
            reason: `${file} uses module.exports (CommonJS), which cannot import withCms; change it to \`export default\` (or rename the file to next.config.mjs)`,
        };
    }
    if (exports.length !== 1) {
        return {
            status: "manual",
            reason: `${file} has ${exports.length === 0 ? "no" : "more than one"} \`export default\` that init could wrap`,
        };
    }
    const found = exports[0];
    const start = (found.index ?? 0) + found[0].length;
    const expression = withoutTrailingNoise(text.slice(start));
    const wrapped = () => ({
        status: "edit",
        text: withImport(`${text.slice(0, start)}withCms(${expression})${text.slice(start + expression.length)}`),
        change: "wrapped the export in withCms(), added the import from @monti-cms/nextjs/config",
    });
    const unsupported = (what) => ({
        status: "manual",
        reason: `the export of ${file} is ${what}, which init does not wrap by itself`,
    });
    if (/^[A-Za-z_$][\w$]*$/.test(expression))
        return wrapped();
    if (expression.startsWith("{")) {
        return matchingClose(expression, 0) === expression.length - 1
            ? wrapped()
            : unsupported("an object followed by more code (such as `satisfies` or `as`)");
    }
    const call = /^[A-Za-z_$][\w$.]*\(/.exec(expression);
    if (call) {
        return matchingClose(expression, call[0].length - 1) === expression.length - 1
            ? wrapped()
            : unsupported("a call followed by more code");
    }
    return unsupported("a function or another kind of expression");
}
const HTML_TAG = /<html\b([^>]*?)(\s*)(\/?)>/;
/**
 * Adds `suppressHydrationWarning` to the `<html>` tag of a root layout, after its other attributes. A layout that has it already is left as it is; a layout without an
 * `<html>` tag, with a tag init cannot read to its end (a `>` inside an attribute expression), or with `suppressHydrationWarning={false}`, is not touched.
 */
export function addSuppressHydrationWarning(file, text) {
    const match = HTML_TAG.exec(text);
    if (!match) {
        return { status: "manual", reason: `${file} has no <html> tag (the root layout may be somewhere else)` };
    }
    const attributes = match[1] ?? "";
    const opens = (attributes.match(/\{/g) ?? []).length;
    const closes = (attributes.match(/\}/g) ?? []).length;
    if (opens !== closes)
        return { status: "manual", reason: `init could not read the <html> tag of ${file} to its end` };
    if (/\bsuppressHydrationWarning\b/.test(attributes)) {
        return /\bsuppressHydrationWarning\s*=\s*\{\s*false\s*\}/.test(attributes)
            ? {
                status: "manual",
                reason: `<html> in ${file} sets suppressHydrationWarning={false}; set it to true`,
            }
            : { status: "present" };
    }
    const at = (match.index ?? 0) + "<html".length + attributes.length;
    return {
        status: "edit",
        text: `${text.slice(0, at)} suppressHydrationWarning${text.slice(at)}`,
        change: "added suppressHydrationWarning to <html>",
    };
}
/** Lines of a `.gitignore` that cover the `.monti/` folder (where `monti migrate` writes its logs). */
const MONTI_FOLDER_LINES = [
    ".monti",
    ".monti/",
    "/.monti",
    "/.monti/",
    ".monti/*",
    ".monti/**",
    "/.monti/*",
    "/.monti/**",
];
/**
 * Adds what Monti needs kept out of git to the text of a `.gitignore` (`undefined`: there is none, so it is created): `.env.local` (it holds the secrets) and
 * `.monti/` (where `monti migrate` writes its logs). A line that already covers one is left alone; with both covered nothing changes.
 */
export function ignoreForMonti(text) {
    const lines = (text ?? "").split(/\r?\n/).map((line) => line.trim());
    const missing = [
        ...(ignoresEnvLocal(text ?? "") ? [] : [{ line: ".env.local", why: "it holds your secrets" }]),
        ...(lines.some((line) => MONTI_FOLDER_LINES.includes(line))
            ? []
            : [{ line: ".monti/", why: "monti migrate writes its logs there" }]),
    ];
    if (missing.length === 0)
        return { status: "present" };
    const eol = text?.includes("\r\n") ? "\r\n" : "\n";
    const separator = text === undefined || text === "" || text.endsWith("\n") ? "" : eol;
    const what = missing.map((item) => `${item.line} (${item.why})`).join(" and ");
    return {
        status: "edit",
        text: `${text ?? ""}${separator}${missing.map((item) => item.line).join(eol)}${eol}`,
        change: text === undefined ? `created it with ${what}` : `added ${what}`,
    };
}
