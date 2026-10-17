/**
 * What every check of the config reports: a list of issues, each with the path of the value it is about. One mechanism for the code config, the schema file,
 * blocks, plugins and the admin's forms, so a caller reads `.issues` instead of parsing a message.
 */
/** One problem in a config, with the path of the value. */
export interface ConfigIssue {
    /** Path from the root, e.g. `collections.post.fields.title.role` or `locales[1].code`. Empty for the root. */
    readonly path: string;
    /** What is wrong with the value at `path`, and the way forward when there is one. Starts lower-case and has no final period. */
    readonly message: string;
    /** A short stable name of the rule (`unknown-key`, `duplicate`, ...), for code that reacts to a kind of problem. */
    readonly code: string;
}
/** A config that is not valid. `message` lists every problem with its path. */
export declare class ConfigError extends Error {
    readonly issues: readonly ConfigIssue[];
    /** What the issues are about, as the message names it (`monti.config.ts`, `monti.schema.ts`). */
    readonly source: string;
    constructor(source: string, issues: readonly ConfigIssue[]);
}
/** Name of the config file in messages. */
export declare const CONFIG_SOURCE = "monti.config.ts";
/** Name of the schema file in messages. */
export declare const SCHEMA_SOURCE_NAME = "monti.schema.ts";
/** A {@link ConfigError} for one problem of the config file (what a lazy check throws once the value is used). */
export declare const configError: (path: string, code: string, message: string) => ConfigError;
/** Throws a {@link ConfigError} when there are issues. */
export declare function throwIssues(source: string, issues: readonly ConfigIssue[]): void;
/** Adds segments to a path: names joined by `.`, indexes as `[0]`, and a name that is not an identifier as `["it"]`. */
export declare function pathOf(base: string, ...segments: readonly (string | number | symbol)[]): string;
/** Collects issues while a check walks a value. */
export declare class IssueList {
    readonly issues: ConfigIssue[];
    add(path: string, code: string, message: string): void;
    /** Adds issues another check found (they keep their paths). */
    addAll(issues: readonly ConfigIssue[] | void): void;
}
/** The known name closest to a misspelt one, when it is close enough to be a typo. */
export declare function closestName(name: string, known: readonly string[]): string | undefined;
/** The message for a key the format does not have, with the closest known key when there is one. */
export declare function unknownKeyMessage(key: string, known: readonly string[]): string;
/** Reports the keys of `value` that are not in `known` (an object only; other values are the shape check's to report). */
export declare function checkKnownKeys(list: IssueList, path: string, value: unknown, known: readonly string[]): void;
