import { defineValidator } from "./action.js";
import { validatorMessages } from "./validators.messages.js";
/**
 * Code checks used by the default actions. They can also be put in site actions as they are.
 *
 * ```ts
 * aiAction({ ..., checks: [{ kind: "pattern", pattern: "^[a-z-]+$" }, uniqueSlug] })
 * ```
 *
 * The site config imports this file, so core modules that read the site config (code blocks, MDX reading) are loaded when a check runs.
 */
/** Drops addresses (slugs) already used by other items of the same collection and language. Not checked if the run does not know the collection. */
export const uniqueSlug = defineValidator({
    name: "unique-slug",
    label: (site) => site.createTranslator(validatorMessages)("uniqueSlug.label"),
    run: async (value, context) => {
        if (!context.collection)
            return true;
        const slug = value.trim();
        const taken = await context.content.slugsInUse({
            collection: context.collection,
            locale: context.locale,
            slugs: [slug],
            ...(context.entryId ? { excludeEntryId: context.entryId } : {}),
        });
        return !taken.has(slug);
    },
});
/**
 * Only keeps candidates that are a valid regex and match at least once in the code input (`input`, or `code` if absent). Attaches the number of matches next to the candidate.
 * `rule` is the name and scope of the code rule used for matching.
 */
export const regexRuns = (input = "code", rule = {}) => defineValidator({
    name: "regex-runs",
    label: (site) => site.createTranslator(validatorMessages)("regexRuns.label"),
    run: async (value, context) => {
        const { checkPattern, ruleMatches } = await import("@monti-cms/core/code-block");
        if (checkPattern(value, "g"))
            return false;
        const code = context.input[input];
        const count = ruleMatches({
            id: "check",
            scope: rule.scope ?? "document",
            name: rule.name ?? "fold",
            pattern: value,
            flags: "g",
            attrs: {},
        }, typeof code === "string" ? code : "").length;
        return count > 0
            ? { detail: context.site.createTranslator(validatorMessages)("regexRuns.detail", { count }) }
            : false;
    },
});
/** Only keeps MDX results with the same skeleton (elements, links, code, attributes) as the source input (`input`). Used for translation. */
export const sameStructure = (input) => defineValidator({
    name: "same-structure",
    label: (site) => site.createTranslator(validatorMessages)("sameStructure.label"),
    run: async (value, context) => {
        const source = context.input[input];
        if (typeof source !== "string")
            return true;
        const { compareMdxStructure, configuredSyntax } = await import("@monti-cms/mdx/format");
        const verdict = compareMdxStructure(context.site, source, value, configuredSyntax(context.site));
        return verdict.ok ? true : verdict.reason;
    },
});
