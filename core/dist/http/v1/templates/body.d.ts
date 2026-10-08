import type { Cms } from "../../../cms/index.js";
import { type StoredDocument } from "../../../doc/stored-document.js";
/**
 * The body of a template request as a document, or `undefined` when the request carries none. A text is read by its format (a text the format rejects
 * fails the request with `format_import_failed` and the format's findings: a template has no place to keep text that is not a document). Like any imported
 * body, the result goes through core's normalisation, so links and media are by id. A document is checked by the store, which also gives its blocks ids.
 */
export declare function templateBodyOf(cms: Cms, input: {
    readonly doc?: unknown;
    readonly body?: string;
    readonly format?: string;
}, previous?: StoredDocument | null): Promise<unknown>;
/**
 * Templates as the API returns them. With a `format`, each also carries `body`: its document as text in that format, written to be imported again
 * (`sync`: links by path, an unresolved link keeps its id). An unknown format fails the request.
 */
export declare function templatesJson<T extends {
    readonly doc: StoredDocument;
}>(cms: Cms, templates: readonly T[], format: string | undefined): Promise<(T & {
    body?: string;
})[]>;
