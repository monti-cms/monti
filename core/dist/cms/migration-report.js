/**
 * What `monti migrate` says about bodies that could not be read as documents and were kept exactly as they were. The steps report each body as it is found
 * (`UnreadableBody`); this turns the list into a few plain lines. The per-body lines stay available (`monti migrate --verbose`).
 */
/** The same body reported by several steps, as one: the facts any of them knew. */
export function mergeUnreadable(found, next) {
    const before = found.get(next.where);
    if (!before)
        return next;
    const reason = next.reason ?? before.reason;
    const detail = next.detail ?? before.detail;
    return {
        where: next.where,
        kind: next.kind,
        ...(reason === undefined ? {} : { reason }),
        ...(detail === undefined ? {} : { detail }),
        hasDirective: before.hasDirective || next.hasDirective,
    };
}
/** The reason in plain words. The reader's own message is kept for the ones that are not recognised. */
function reasonOf(body) {
    const text = `${body.reason ?? ""} ${body.detail ?? ""}`;
    if (/acorn|expression/i.test(text))
        return "a `{...}` was read as code but is not valid code";
    if (/front ?matter/i.test(text))
        return "the body starts with front matter (a --- block)";
    if (body.reason)
        return body.reason + (body.detail ? ` (${body.detail})` : "");
    return "the text could not be read";
}
const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
/** One body per line, for `--verbose`. */
export const unreadableLine = (body) => `  ${body.where} (${body.kind}): ${reasonOf(body)}`;
/**
 * The summary lines. `again`: the bodies were read a second time (`--reconvert-bodies`) and these are the ones that still cannot be, so the advice to turn on a
 * syntax and read them again is left out.
 */
export function describeUnreadable(found, options = {}) {
    if (found.length === 0)
        return [];
    const published = found.filter((body) => body.kind === "published").length;
    const drafts = found.filter((body) => body.kind === "draft").length;
    const templates = found.filter((body) => body.kind === "template").length;
    const parts = [
        published > 0 ? `${published} published` : undefined,
        drafts > 0 ? plural(drafts, "draft", "drafts") : undefined,
        templates > 0 ? plural(templates, "template", "templates") : undefined,
    ].filter((part) => part !== undefined);
    const lines = [
        `${plural(found.length, "body", "bodies")} (${parts.join(", ")}) could not be read and ${found.length === 1 ? "was" : "were"} kept exactly as ${found.length === 1 ? "it was" : "they were"} (nothing is lost). ` +
            "In the editor they show as plain source, and a published one shows as empty on the site until it is fixed.",
    ];
    const counts = new Map();
    for (const body of found)
        counts.set(reasonOf(body), (counts.get(reasonOf(body)) ?? 0) + 1);
    const [top, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
    if (top !== "the text could not be read" || counts.size > 1) {
        lines.push(`Most common reason: ${top}${found.length > 1 ? ` (${topCount} of ${found.length})` : ""}.`);
    }
    if (!options.again && found.some((body) => body.hasDirective)) {
        lines.push("Some of them use ::: blocks (callout, tabs, ...). Turn on the directive syntax, then read them again:", '  1. install @monti-cms/syntax-directive and use `mdx({ syntax: [directiveSyntax()] })` in monti.config.ts (import { directiveSyntax } from "@monti-cms/syntax-directive")', "  2. run `monti migrate --reconvert-bodies`");
    }
    else if (!options.again) {
        lines.push("After you change the setup so they can be read, `monti migrate --reconvert-bodies` reads them again. Or open each one in the admin editor and fix it there.");
    }
    else {
        lines.push("Open each one in the admin editor and fix it there.");
    }
    lines.push("`monti migrate --verbose` lists every one of them.");
    return lines;
}
