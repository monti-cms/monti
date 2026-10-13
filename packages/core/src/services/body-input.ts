import type { StoredDocument } from "../doc/stored-document";

/** What a create or save request sends as the body: a stored document, or a text with its format. */
export interface BodyFields {
	readonly doc?: unknown;
	readonly body?: string;
	readonly format?: string;
}

/**
 * The body of a create or save request as the service takes it: the document sent, or the text with its format (the service reads it with that format), or
 * `fallback` when the request sends none (an empty body for a new entry, the current draft's document for a save). Whether both were sent is decided
 * by the request schema.
 */
export function bodyInputOf(
	fields: BodyFields,
	fallback: StoredDocument,
): { readonly doc: unknown } | { readonly body: string; readonly format: string | undefined } {
	if (fields.doc !== undefined) return { doc: fields.doc };
	if (fields.body !== undefined) return { body: fields.body, format: fields.format };
	return { doc: fallback };
}
