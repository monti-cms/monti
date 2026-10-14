/**
 * What every check of the config reports: a list of issues, each with the path of the value it is about. One mechanism for the code config, the schema file,
 * blocks, plugins and the admin's forms, so a caller reads `.issues` instead of parsing a message.
 */
/** A config that is not valid. `message` lists every problem with its path. */
export class ConfigError extends Error {
    issues;
    /** What the issues are about, as the message names it (`monti.config.ts`, `monti.schema.ts`). */
    source;
    constructor(source, issues) {
        super(`${source} is not valid:\n${issues.map((issue) => `  ${issue.path || "(root)"}: ${issue.message}`).join("\n")}\nFix: correct the lines above; \`monti doctor\` checks the files again.`);
        this.name = "ConfigError";
        this.source = source;
        this.issues = issues;
    }
}
/** Name of the config file in messages. */
export const CONFIG_SOURCE = "monti.config.ts";
/** Name of the schema file in messages. */
export const SCHEMA_SOURCE_NAME = "monti.schema.ts";
/** A {@link ConfigError} for one problem of the config file (what a lazy check throws once the value is used). */
export const configError = (path, code, message) => new ConfigError(CONFIG_SOURCE, [{ path, code, message }]);
/** Throws a {@link ConfigError} when there are issues. */
export function throwIssues(source, issues) {
    if (issues.length > 0)
        throw new ConfigError(source, issues);
}
const IDENTIFIER = /^[A-Za-z_$][\w$-]*$/;
/** Adds segments to a path: names joined by `.`, indexes as `[0]`, and a name that is not an identifier as `["it"]`. */
export function pathOf(base, ...segments) {
    return segments.reduce((out, key) => {
        if (typeof key === "number")
            return `${out}[${key}]`;
        const name = String(key);
        if (IDENTIFIER.test(name))
            return out ? `${out}.${name}` : name;
        return `${out}[${JSON.stringify(name)}]`;
    }, base);
}
/** Collects issues while a check walks a value. */
export class IssueList {
    issues = [];
    add(path, code, message) {
        this.issues.push({ path, code, message });
    }
    /** Adds issues another check found (they keep their paths). */
    // biome-ignore lint/suspicious/noConfusingVoidType: takes what a check hook returns, and a hook may return nothing
    addAll(issues) {
        if (issues)
            this.issues.push(...issues);
    }
}
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** The edit distance of two short names (insert, delete, replace), for "did you mean". */
function distance(a, b) {
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
        const row = [i];
        for (let j = 1; j <= b.length; j += 1) {
            row[j] = Math.min((previous[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        previous = row;
    }
    return previous[b.length] ?? 0;
}
/** The known name closest to a misspelt one, when it is close enough to be a typo. */
export function closestName(name, known) {
    let best;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of known) {
        const gap = distance(name.toLowerCase(), candidate.toLowerCase());
        if (gap < bestDistance) {
            best = candidate;
            bestDistance = gap;
        }
    }
    return best !== undefined && bestDistance <= Math.max(1, Math.floor(Math.max(name.length, best.length) / 3))
        ? best
        : undefined;
}
/** The message for a key the format does not have, with the closest known key when there is one. */
export function unknownKeyMessage(key, known) {
    const near = closestName(key, known);
    return near ? `is not an option; did you mean "${near}"?` : `is not an option (known: ${known.join(", ")})`;
}
/** Reports the keys of `value` that are not in `known` (an object only; other values are the shape check's to report). */
export function checkKnownKeys(list, path, value, known) {
    if (!isRecord(value))
        return;
    for (const key of Object.keys(value)) {
        if (!known.includes(key))
            list.add(pathOf(path, key), "unknown-key", unknownKeyMessage(key, known));
    }
}
