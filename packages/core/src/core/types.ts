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

export type Issue = {
	readonly code: string;
	/**
	 * Guidance in the site's display language. Built from the code and `params` with the `cms.core` dictionary (table checks), or
	 * carries the target's name (attribute name, address, parser error). The screen picks the text by code and appends `message`.
	 */
	readonly message?: string;
	/** Variant within the same code (`reason`) and the values that fill the message's placeholders. */
	readonly params?: Readonly<Record<string, string | number>>;
	/** Location of a body issue. */
	readonly position?: { readonly line: number; readonly column: number };
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
	| { readonly type: "mdx"; readonly line: number; readonly column: number }
	| { readonly type: "metadata"; readonly path: string; readonly ordinal?: number };

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
 * A body is given either as MDX or as a stored document (`StoredDocument` JSON), never both. Either way it is stored as both:
 * the document is the source and the MDX is written from it (see `bodyFromMdx`).
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
	readonly url: string;
	readonly position: { readonly line: number; readonly column: number };
};

export type ResolvedInternalLink = {
	readonly collection: Collection;
	readonly slug: string;
	readonly addressType: "current" | "alias" | "reservation" | "deleted" | "missing";
	readonly isPublished: boolean;
};

export type PreparedSnapshot = {
	readonly collection: Collection;
	readonly slug: string | null;
	readonly metadata: { readonly [key: string]: MetadataValue };
	/** The body as stored: written from `doc` when there is one, otherwise exactly as given. */
	readonly mdx: string;
	/** The stored document, the source of `mdx`. `null` when the body does not parse (or has front matter), which only a draft can be. */
	readonly doc: StoredDocument | null;
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
	targets: { id: string; isPublished: boolean; collection: string }[];
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
	readonly mdx: string;
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
