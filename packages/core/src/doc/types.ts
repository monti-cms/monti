export type CmsJsonValue = string | number | boolean | null | CmsJsonValue[] | { [key: string]: CmsJsonValue };

export type CmsMark = {
	type: string;
	attrs?: Record<string, CmsJsonValue>;
};

export type CmsNode = {
	type: string;
	/** Block id, unique within the document (`block-ids.ts`). Only blocks of a stored document carry one; never written to a text format. */
	id?: string;
	/**
	 * In a translation, the id of the source block this block was made from (`block-ids.ts`). Like `id`, it is never written to a text format and is not
	 * part of the content hash; the translation screen pairs blocks by it.
	 */
	sourceId?: string;
	attrs?: Record<string, CmsJsonValue>;
	content?: CmsNode[];
	marks?: CmsMark[];
	text?: string;
};

/**
 * Image source used in the body. **Pure fact with no DB meaning** — whether `mediaId` actually points to
 * a media row and whether that row is `ready` is decided by the pre-publish check.
 */
export type CmsImageSource = {
	/** Registered media reference. Mutually exclusive with `src`. */
	readonly mediaId?: string;
	/** External address. */
	readonly src?: string;
	readonly position: { readonly blockId?: string };
};
