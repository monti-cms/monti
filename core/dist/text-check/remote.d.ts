import { type TextChecker, type TextCheckerOptions } from "./types.js";
export interface RemoteTextCheckerOptions extends Omit<TextCheckerOptions, "check"> {
    /** Check route of the site (e.g. `/api/text-check`). Takes `{ segments }` as JSON and returns `{ issues }`. */
    readonly url: string;
    /** Extra headers to send. Do not put the API key here (it would be exposed to the browser). The server route holds the key. */
    readonly headers?: Readonly<Record<string, string>>;
}
/**
 * A checker that goes through the site's server route. APIs that need a key (Bareun, LanguageTool etc.) are called from the server route,
 * and the browser sends only paragraphs through this checker. The server route is built with `textCheckRoute` from `@monti-cms/core/plugin/server`.
 */
export declare function remoteTextChecker({ url, headers, ...options }: RemoteTextCheckerOptions): TextChecker;
