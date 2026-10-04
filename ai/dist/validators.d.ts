import type { CodeRule } from "@monti-cms/core/code-block";
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
export declare const uniqueSlug: import("./action.js").AiValidator;
/** The shape of the code rule that `regexRuns` runs the regex against. If absent, it is the fold rule of the whole document (`document`). */
export interface RegexRunsRule {
    readonly name?: CodeRule["name"];
    readonly scope?: CodeRule["scope"];
}
/**
 * Only keeps candidates that are a valid regex and match at least once in the code input (`input`, or `code` if absent). Attaches the number of matches next to the candidate.
 * `rule` is the name and scope of the code rule used for matching.
 */
export declare const regexRuns: (input?: string, rule?: RegexRunsRule) => import("./action.js").AiValidator;
/** Only keeps MDX results with the same skeleton (elements, links, code, attributes) as the source input (`input`). Used for translation. */
export declare const sameStructure: (input: string) => import("./action.js").AiValidator;
