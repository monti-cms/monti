/**
 * The two edits `monti init` makes to files the app owns: wrap the export of `next.config` in `withCms(...)`, and put `suppressHydrationWarning` on the `<html>` of the
 * root layout. Both work on the text of the file and decide first whether they can do it safely: a file whose shape is not one of the few simple ones is not touched, and
 * the result says why, so the step can be listed for the person to do by hand. Nothing here reads or writes a file.
 */
import { findHtmlTag, gitignoreCoverage, importsWithCms, suppressHydrationState, usesWithCms } from "./next-app.js";
import { matchingClose, skipLiteral } from "./source-text.js";
export const NEXT_CONFIG_IMPORT = 'import { withCms } from "@monti-cms/nextjs/config";';
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
    if (importsWithCms(text))
        return text;
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
    if (usesWithCms(text))
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
/**
 * Adds `suppressHydrationWarning` to the `<html>` tag of a root layout, after its other attributes. A layout that has it already is left as it is; a layout without an
 * `<html>` tag, with a tag init cannot read to its end (a `>` inside an attribute expression), or with `suppressHydrationWarning={false}`, is not touched.
 */
export function addSuppressHydrationWarning(file, text) {
    const tag = findHtmlTag(text);
    if (!tag) {
        return { status: "manual", reason: `${file} has no <html> tag (the root layout may be somewhere else)` };
    }
    const { attributes } = tag;
    const opens = (attributes.match(/\{/g) ?? []).length;
    const closes = (attributes.match(/\}/g) ?? []).length;
    if (opens !== closes)
        return { status: "manual", reason: `init could not read the <html> tag of ${file} to its end` };
    const state = suppressHydrationState(attributes);
    if (state === "off") {
        return { status: "manual", reason: `<html> in ${file} sets suppressHydrationWarning={false}; set it to true` };
    }
    if (state === "on")
        return { status: "present" };
    return {
        status: "edit",
        text: `${text.slice(0, tag.start)}${htmlTagWith(text, tag, "suppressHydrationWarning")}${text.slice(tag.end)}`,
        change: "added suppressHydrationWarning to <html>",
    };
}
/** Lines are kept within this width, the default of Prettier and Biome. */
const LINE_WIDTH = 80;
/** The attributes of a tag as separate pieces (`lang="en"`, `className={...}`), or `undefined` when they cannot be told apart safely. */
function splitAttributes(attributes) {
    const parts = [];
    let current = "";
    for (let i = 0; i < attributes.length;) {
        const ch = attributes[i];
        if (/\s/.test(ch)) {
            if (current)
                parts.push(current);
            current = "";
            i += 1;
            continue;
        }
        const end = ch === "{" ? matchingClose(attributes, i) + 1 : skipLiteral(attributes, i);
        if (ch === "{" && end === 0)
            return undefined;
        const next = end > i ? end : i + 1;
        current += attributes.slice(i, next);
        i = next;
    }
    if (current)
        parts.push(current);
    return parts;
}
/**
 * The `<html>` tag with `attribute` added after the others, written the way the file writes it: a tag that is already on several lines gets the attribute on a line of
 * its own, a tag that stays within the line width stays on one line, and a tag that would become too long is broken up one attribute per line.
 */
function htmlTagWith(text, tag, attribute) {
    const open = text.slice(tag.start, tag.start + "<html".length);
    const lineStart = text.lastIndexOf("\n", tag.start - 1) + 1;
    const indent = /^[ \t]*/.exec(text.slice(lineStart))?.[0] ?? "";
    const lineEnd = text.indexOf("\n", tag.end);
    const after = text.slice(tag.end, lineEnd === -1 ? text.length : lineEnd);
    const single = `${open}${tag.attributes} ${attribute}${tag.gap}${tag.closer}`;
    if (tag.attributes.includes("\n")) {
        // Already one attribute per line: the new one goes on the line after the last, indented like the others.
        const lastIndent = /\n([ \t]*)\S[^\n]*$/.exec(tag.attributes)?.[1] ?? `${indent}  `;
        return `${open}${tag.attributes}\n${lastIndent}${attribute}${tag.gap}${tag.closer}`;
    }
    if (indent.length + single.length + after.length <= LINE_WIDTH)
        return single;
    const parts = splitAttributes(tag.attributes);
    if (!parts)
        return single;
    const unit = /^\t/m.test(text) ? "\t" : "  ";
    const inner = `${indent}${unit}`;
    return `${open}\n${[...parts, attribute].map((part) => `${inner}${part}`).join("\n")}\n${indent}${tag.closer}`;
}
/**
 * Adds what Monti needs kept out of git to the text of a `.gitignore` (`undefined`: there is none, so it is created): `.env.local` (it holds the secrets) and
 * `.monti/` (where `monti db:migrate` writes its logs). A line that already covers one is left alone; with both covered nothing changes.
 */
export function ignoreForMonti(text) {
    const covered = gitignoreCoverage(text ?? "");
    const missing = [
        ...(covered.envLocal ? [] : [{ line: ".env.local", why: "it holds your secrets" }]),
        ...(covered.montiFolder ? [] : [{ line: ".monti/", why: "monti db:migrate writes its logs there" }]),
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
