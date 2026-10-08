/**
 * Shiki code notation (`// [!code ++]`) → Monti code annotation comments (`// @line plus`).
 *
 * Reading only: the notation is removed from the code and the equivalent Monti annotation lines are put above the lines it affects.
 * Monti's parser then reads them like any other annotation, and the body is always written back in Monti's notation.
 *
 * What counts as notation is a `[!code …]` marker in a **trailing comment** of the language's comment syntax (found outside quotes),
 * the same place Shiki's transformers look. A comment that holds only the notation is removed with its line and applies to the next code line;
 * a trailing one applies to its own line. `[!code …:N]` extends it over N code lines.
 */
import { formatAnnotationComment, resolveCommentSyntax } from "@monti-cms/mdx";
/** Languages whose comments Monti reads as `//` but that also use another form. Shiki accepts every form in every language; this reads the ones that exist. */
const HASH_LANGS = new Set([
    "sh",
    "shell",
    "shellscript",
    "zsh",
    "ruby",
    "rb",
    "perl",
    "r",
    "dockerfile",
    "makefile",
    "powershell",
    "ps1",
    "elixir",
    "nginx",
    "graphql",
]);
const DASH_LANGS = new Set(["lua", "haskell", "hs"]);
const MARKUP_LANGS = new Set(["html", "xml", "svg", "vue", "svelte", "astro", "markdown", "md"]);
/**
 * Comment forms a Shiki notation is read from in a language: the form Monti's own annotations use there, plus the other forms the language has.
 * Every `//` language also reads the block form (slash, star, text, star, slash).
 */
export const readableCommentSyntaxes = (lang) => {
    const name = lang.trim().toLowerCase();
    const base = resolveCommentSyntax(lang);
    const found = [base];
    const add = (syntax) => {
        if (!found.some((item) => item.prefix === syntax.prefix && item.postfix === syntax.postfix))
            found.push(syntax);
    };
    if (HASH_LANGS.has(name))
        add({ prefix: "#", postfix: "" });
    if (DASH_LANGS.has(name))
        add({ prefix: "--", postfix: "" });
    if (MARKUP_LANGS.has(name))
        add({ prefix: "<!--", postfix: "-->" });
    if (base.prefix === "//")
        add({ prefix: "/*", postfix: "*/" });
    return found;
};
/** Position of every `prefix` outside quotes (`"`, `'` and `` ` ``, with backslash escapes; a string that spans lines is not tracked). */
const findOutsideQuotes = (line, prefix, trackQuotes, stopAtFirst) => {
    const found = [];
    let quote = "";
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (quote) {
            if (char === "\\")
                index += 1;
            else if (char === quote)
                quote = "";
            continue;
        }
        if (trackQuotes && (char === '"' || char === "'" || char === "`")) {
            quote = char;
            continue;
        }
        if (line.startsWith(prefix, index)) {
            found.push(index);
            if (stopAtFirst)
                break;
        }
    }
    return found;
};
/** The trailing comment of a line in one comment form. A line comment runs to the end of the line; a block comment must end the line. */
const trailingComment = (line, syntax) => {
    const { prefix, postfix } = syntax;
    const end = line.trimEnd().length;
    const markup = prefix === "<!--";
    const starts = findOutsideQuotes(line, prefix, !markup, !postfix);
    if (!postfix) {
        const start = starts[0];
        return start === undefined ? undefined : { start, prefix, postfix, body: line.slice(start + prefix.length) };
    }
    if (!line.slice(0, end).endsWith(postfix))
        return undefined;
    for (const start of starts.reverse()) {
        const bodyEnd = end - postfix.length;
        if (start + prefix.length > bodyEnd)
            continue;
        const body = line.slice(start + prefix.length, bodyEnd);
        if (!body.includes(postfix))
            return { start, prefix, postfix, body };
    }
    return undefined;
};
/** The comment that ends the line: of all comment forms, the one that starts last. */
const findTrailingComment = (line, syntaxes) => {
    let best;
    for (const syntax of syntaxes) {
        const comment = trailingComment(line, syntax);
        if (comment && (!best || comment.start > best.start))
            best = comment;
    }
    return best;
};
const LINE_EFFECTS = {
    "++": "plus",
    "--": "minus",
    highlight: "highlight",
    hl: "highlight",
    error: "error",
    warning: "warning",
};
/** `[!code ++]`, `[!code hl:3]`, `[!code word:foo:2]`, with the whitespace before it. The kinds and the count are the ones Shiki's transformers read. */
const NOTATION = /\s*\[!code (?:(\+\+|--|highlight|hl|focus|error|warning|info)|word:((?:\\.|[^:\]])+))(?::(\d+))?\]/gi;
/** Takes the notations out of a comment body. A notation that cannot be converted (`info` without an `info` effect, `word` when off) stays in the body. */
const extractNotations = (body, settings) => {
    const notations = [];
    const rest = body.replace(NOTATION, (match, name, word, count) => {
        const amount = count === undefined ? undefined : Number(count);
        if (name !== undefined) {
            const key = name.toLowerCase();
            const effect = key === "focus"
                ? settings.lineEffects.has("focus")
                    ? "focus"
                    : "highlight"
                : key === "info"
                    ? settings.lineEffects.has("info")
                        ? "info"
                        : undefined
                    : LINE_EFFECTS[key];
            if (!effect)
                return match;
            notations.push({ kind: "line", effect, count: amount ?? 1 });
            return "";
        }
        if (word === undefined || settings.word === false)
            return match;
        notations.push({ kind: "word", word: word.replace(/\\(.)/g, "$1"), count: amount });
        return "";
    });
    return { rest, notations };
};
const MONTI_ANNOTATION = /^@(?:char|line|document)\s+[A-Za-z_]/;
const isMontiAnnotation = (line, syntax) => {
    const prefix = syntax.prefix.trim();
    const postfix = syntax.postfix.trim();
    let body = line.trim();
    if (prefix) {
        if (!body.startsWith(prefix))
            return false;
        body = body.slice(prefix.length).trimStart();
    }
    if (postfix) {
        if (!body.endsWith(postfix))
            return false;
        body = body.slice(0, body.length - postfix.length).trimEnd();
    }
    return MONTI_ANNOTATION.test(body);
};
const readRow = (line, syntaxes, annotationSyntax, settings) => {
    if (isMontiAnnotation(line, annotationSyntax))
        return { kind: "annotation", text: line };
    const comment = line.includes("[!code") ? findTrailingComment(line, syntaxes) : undefined;
    if (!comment)
        return { kind: "code", text: line, own: [], next: [] };
    const { rest, notations } = extractNotations(comment.body, settings);
    if (notations.length === 0)
        return { kind: "code", text: line, own: [], next: [] };
    const before = line.slice(0, comment.start);
    const alone = before.trim() === "";
    const empty = rest.trim() === "";
    if (alone && empty)
        return { kind: "notation", notations };
    const text = empty ? before.trimEnd() : `${before}${comment.prefix}${rest}${comment.postfix}`.trimEnd();
    return alone ? { kind: "code", text, own: [], next: notations } : { kind: "code", text, own: notations, next: [] };
};
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
/** Annotation comment bodies for one notation that applies from code line `start` (0-based, among the code lines). `put(index, body)` adds one above code line `index`. */
const annotate = (notation, start, total, word, put) => {
    if (notation.kind === "line") {
        const length = Math.min(notation.count, total - start);
        if (length <= 0)
            return;
        put(start, length === 1 ? `@line ${notation.effect}` : `@line ${notation.effect} {${start}-${start + length - 1}}`);
        return;
    }
    if (word === false)
        return;
    const rule = `${word} {re:/${escapeRegExp(notation.word)}/g}`;
    // Without a count Shiki highlights the word in every line from here to the end: from the first line that is the whole code.
    if (notation.count === undefined && start === 0) {
        put(0, `@document ${rule}`);
        return;
    }
    const end = notation.count === undefined ? total : Math.min(start + notation.count, total);
    for (let index = start; index < end; index += 1)
        put(index, `@char ${rule}`);
};
/** Converts the Shiki notation in the value of a code node of language `lang`. Code without notation is returned as it is. */
export const convertShikiNotation = (value, lang, settings) => {
    if (!value.includes("[!code"))
        return value;
    const language = lang?.trim() || "text";
    const annotationSyntax = resolveCommentSyntax(language);
    const syntaxes = readableCommentSyntaxes(language);
    const rows = value.split("\n").map((line) => readRow(line, syntaxes, annotationSyntax, settings));
    if (rows.every((row) => row.kind !== "notation" && (row.kind !== "code" || (!row.own.length && !row.next.length))))
        return value;
    // Indices count code lines only (not annotation lines and not removed notation lines), as `@line name {a-b}` does.
    const total = rows.filter((row) => row.kind === "code").length;
    const above = new Map();
    const put = (index, body) => above.set(index, [...(above.get(index) ?? []), body]);
    let pending = [];
    let index = 0;
    for (const row of rows) {
        if (row.kind === "notation")
            pending.push(...row.notations);
        if (row.kind !== "code")
            continue;
        for (const notation of [...pending, ...row.own])
            annotate(notation, index, total, settings.word, put);
        pending = row.next;
        index += 1;
    }
    const output = [];
    index = 0;
    for (const row of rows) {
        if (row.kind === "annotation")
            output.push(row.text);
        if (row.kind !== "code")
            continue;
        const indent = row.text.match(/^[\t ]*/)?.[0] ?? "";
        for (const body of above.get(index) ?? [])
            output.push(`${indent}${formatAnnotationComment(annotationSyntax, body)}`);
        output.push(row.text);
        index += 1;
    }
    return output.join("\n");
};
