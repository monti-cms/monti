import type { ResolvedConfig } from "../config/resolved";
import type { StoredDocument } from "../mdx/stored-document";
import type { CmsImageSource } from "../mdx/types";
import type { MetadataOf } from "../schema/collection";
import type { RecordTranslations } from "../schema/derive";
import type { Collection } from "./collections";
import type { TranslationState } from "./translation/state";

/**
 * CMS domain types. Shared by the repository implementation, service and HTTP layers; depends on none of them.
 */

/** A place in a body: the block of the stored document (`blockId`), or for text that did not become a document, a line and column of that text. */
export type BodyPosition = {
	readonly blockId?: string;
	readonly line?: number;
	readonly column?: number;
};

export type Issue = {
	readonly code: string;
	/**
	 * Guidance in the site's display language. Built from the code and `params` with the `cms.core` dictionary (table checks), or
	 * carries the target's name (attribute name, address, parser error). The screen picks the text by code and appends `message`.
	 */
	readonly message?: string;
	/** Variant within the same code (`reason`) and the values that fill the message's placeholders. */
	readonly params?: Readonly<Record<string, string | number>>;
	/**
	 * Location of a body issue: the block of the stored document it is in (`blockId`). A body given as text that could not be read
	 * (`mdx_error`) has no block; it carries the line and column in that text instead.
	 */
	readonly position?: BodyPosition;
	/** Field path of a metadata issue. */
	readonly path?: string;
	readonly ordinal?: number;
};

export type { Collection };
/**
 * Kind of reference target. The collection of content (`entry`) is decided by the relation field definition.
 * Previously saved `category` and `tag` references are converted to `entry` on read (`normalizeReferenceKind`).
 */
export type ReferenceKind = "entry" | "media";

export const normalizeReferenceKind = (kind: string): ReferenceKind => (kind === "media" ? "media" : "entry");

export type ReferenceOccurrence =
	| { readonly type: "body"; readonly blockId?: string }
	| { readonly type: "metadata"; readonly path: string; readonly ordinal?: number };

/**
 * An occurrence as stored. Rows written before bodies were checked as documents hold `{type:"mdx", line, column, blockId?}` for a body
 * occurrence; it reads as `{type:"body", blockId?}` and is rewritten in the new form the next time the references are saved.
 * Returns `undefined` for a value that is not an occurrence.
 */
export const readReferenceOccurrence = (value: unknown): ReferenceOccurrence | undefined => {
	if (typeof value !== "object" || value === null) return undefined;
	const record = value as Record<string, unknown>;
	if (record.type === "body" || record.type === "mdx") {
		return typeof record.blockId === "string" ? { type: "body", blockId: record.blockId } : { type: "body" };
	}
	if (record.type === "metadata" && typeof record.path === "string") {
		return typeof record.ordinal === "number"
			? { type: "metadata", path: record.path, ordinal: record.ordinal }
			: { type: "metadata", path: record.path };
	}
	return undefined;
};

/** Whether a stored occurrence list still has an occurrence in the old shape. */
export const hasLegacyOccurrence = (value: unknown): boolean =>
	Array.isArray(value) && value.some((item) => (item as { type?: unknown } | null)?.type === "mdx");

/** The occurrences of a stored reference row, in the current shape. */
export const readReferenceOccurrences = (value: unknown): ReferenceOccurrence[] =>
	(Array.isArray(value) ? value : []).flatMap((item) => readReferenceOccurrence(item) ?? []);

export type Reference = {
	readonly kind: ReferenceKind;
	readonly targetId: string;
	readonly isStale: boolean;
	readonly occurrences: readonly ReferenceOccurrence[];
};

/** Stored metadata value. Only the per-locale values (`translations`) of a record collection are objects. */
export type MetadataValue =
	| string
	| readonly string[]
	| { readonly [locale: string]: { readonly [field: string]: string } };

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };

type SCHEMAS = ResolvedConfig["collections"];
/** An item collection keeps per-locale names in `translations`. */
type WithRecordTranslations<S, M> = S extends { readonly kind: "item" } ? M & { translations?: RecordTranslations } : M;
/** Collection metadata. Built from the definitions in the site config (`cms.config.ts`). */
export type MetadataFor<C extends Collection> = WithRecordTranslations<SCHEMAS[C], MetadataOf<SCHEMAS[C]>>;

/**
 * A body is given either as MDX text or as a stored document (`StoredDocument` JSON), never both. The document is what is checked, hashed and
 * stored; text is read into a document first (a text that cannot be read is kept as an `unparsed` node).
 */
type BodyInput = { mdx: string; doc?: undefined } | { doc: unknown; mdx?: undefined };

type InputFor<C extends Collection, M> = BodyInput & {
	collection: C;
	slug: string | null;
	metadata: M;
	folderId?: string | null;
	/** Translation state of a translation. If omitted, the stored value is kept. A source accepts only `null`. */
	translation?: TranslationState | null;
};

export type ServiceInput = { [C in Collection]: InputFor<C, MetadataFor<C>> }[Collection];

export type SaveDraftInput = ServiceInput & { expectedVersion: number };

export type InternalLinkSource = {
	/** The collection a link points to (a collection with `path`). */
	readonly collection: Collection;
	readonly slug: string;
	/** The language of the address, when it has the locale prefix of the site's URLs. Absent: the default language. */
	readonly locale?: string;
	readonly url: string;
	readonly position: BodyPosition;
};

export type ResolvedInternalLink = {
	readonly collection: Collection;
	readonly slug: string;
	readonly locale?: string;
	readonly addressType: "current" | "alias" | "reservation" | "deleted" | "missing";
	readonly isPublished: boolean;
};

export type PreparedSnapshot = {
	readonly collection: Collection;
	readonly slug: string | null;
	readonly metadata: { readonly [key: string]: MetadataValue };
	/**
	 * The stored document, the source of the body. A body that could not become a document is a document of one `unparsed` node,
	 * which only a draft can be (`unparsed_body` blocks publishing).
	 */
	readonly doc: StoredDocument;
	readonly schemaVersion: number;
	readonly contentHash: string;
	readonly references: readonly Reference[];
	/** Issues that block publishing. They do not block draft saves. */
	readonly issues: readonly Issue[];
	/** Notices that do not block publishing (such as block attributes not in the definition). */
	readonly warnings?: readonly Issue[];
	readonly internalLinks?: readonly InternalLinkSource[];
	/** Body image sources and positions. Used by pre-publish validation to build non-blocking warnings. */
	readonly imageSources: readonly CmsImageSource[];
	/** Translation state of a translation. `undefined` keeps the stored value. Not included in the content hash. */
	readonly translation?: TranslationState | null;
};

export type ResolvedTargets = {
	targets: {
		id: string;
		isPublished: boolean;
		collection: string;
		/** Whether it is a source entry (its id is a translation group id). A link by id can only point to one. Unset: not checked. */
		isSource?: boolean;
	}[];
	/**
	 * The pre-publish image warnings look at the media status.
	 * `status` and `storageKey` are optional — if the caller does not fill them, only those warnings are skipped (nothing is blocked).
	 */
	media: { id: string; status?: string; storageKey?: string | null }[];
	internalLinks?: ResolvedInternalLink[];
	/**
	 * For a translation publish, the source's status. A translation checks only per-locale required values, and the source holding the shared values must be public.
	 */
	translation?: { sourcePublished: boolean };
};

export type WorkingCopy = {
	readonly collection: Collection;
	readonly slug: string | null;
	readonly metadata: { readonly [key: string]: unknown };
	/** The MDX column, written from `doc` (it goes when the MDX package is split out). */
	readonly mdx: string;
	readonly doc: StoredDocument;
	readonly version: number;
	readonly folderId: string | null;
	/** Content locale and translation group ID. For a source, the group ID is its own ID. */
	readonly locale?: string;
	readonly translationGroupId?: string;
};

export class ServiceError extends Error {
	constructor(
		public readonly code: string,
		public readonly issues?: readonly Issue[],
	) {
		super(code);
		this.name = "ServiceError";
	}
}
