import type { BlockDefinition } from "../blocks/define";
import type { StoredDocument } from "../doc/stored-document";

/**
 * Formats. A format is a notation a stored document can be written as (and, when it can, read from): MDX, Markdown with Hugo front matter,
 * plain text. The stored document is the only source of a body; a format only converts. Core owns identity and storage: it resolves the entries and
 * media a document points to before `export`, and it validates, normalises and stores what `import` returns, so a format cannot bypass a core rule.
 *
 * Both directions are pure functions of their arguments: they never read the database, the network or the site config, so a format can run on the
 * server and in the browser alike.
 *
 * Plugins add formats through `CmsPlugin.formats`; a site picks one with the `format` option of the read and write APIs.
 */

/** A finding about a text, in the shape of a core `Issue`, so the admin shows it with the same messages. */
export interface FormatIssue {
	readonly code: string;
	readonly message?: string;
	readonly params?: Readonly<Record<string, string | number>>;
	/** Where it is in the text that was imported (1-based). */
	readonly position?: { readonly line: number; readonly column: number };
	/** For a warning about a block of the imported document: the index of its top-level block in `doc.content`. Core turns it into the block's id. */
	readonly blockIndex?: number;
}

/** The body blocks the site uses, as a format sees them. */
export interface BlockCatalog {
	/** Every block the site uses (core blocks, blocks added by plugins, and the site config's `blocks`). */
	readonly list: readonly BlockDefinition[];
	/** Block by its name (the definition's `name`). */
	readonly byName: (name: string) => BlockDefinition | undefined;
	/** Block by its public renderer name (the definition's `component`). */
	readonly byComponent: (component: string) => BlockDefinition | undefined;
}

/** What a format may rely on, in both directions. */
export interface FormatContext {
	/** Language of the body. */
	readonly locale: string;
	/** The body blocks the site uses (names, kinds, attributes). */
	readonly blocks: BlockCatalog;
	/** Names of the code block line effects the site uses. */
	readonly codeLineEffects: ReadonlySet<string>;
}

/** Where an internal link points: the address of the target as the reader of this document sees it. */
export interface FormatLink {
	/** The public path of the target (with the locale prefix of the language it was picked in). */
	readonly url: string;
	readonly title: string | null;
	/** Language of the version `url` is the address of. */
	readonly locale: string;
}

/** A media item a document points to. */
export interface FormatMedia {
	/** Public URL of the file. */
	readonly url: string;
	readonly width?: number;
	readonly height?: number;
	readonly filename: string;
	readonly mimeType: string | null;
	readonly byteSize: number | null;
}

/**
 * What the text is for. `read`: a consumer reads it (a site, a feed, another tool), so it needs addresses that work outside the database and no database ids.
 * `sync`: it will be imported again (git-sync, a backup), so a two-way format keeps whatever it needs to round-trip, such as the id of an unresolved link.
 */
export type FormatPurpose = "read" | "sync";

export interface FormatExportContext extends FormatContext {
	readonly purpose: FormatPurpose;
	/**
	 * The current address of the entry an internal link points to (core resolved every link of the document before calling `export`, so this is synchronous).
	 * `null`: the target is gone, not published, or has no public path.
	 */
	link(entryId: string): FormatLink | null;
	/** The public URL and file info of a media item of the document. `null`: it is not ready or does not exist. */
	media(mediaId: string): FormatMedia | null;
	/** Reports something that could not be written as the document says (an unresolved link or media). It never fails the export; the API returns it as a warning. */
	report(issue: FormatIssue): void;
}

export interface FormatImportContext extends FormatContext {
	/** The entry the text is written to, when it already exists. */
	readonly entryId?: string;
}

export type FormatImportResult =
	| {
			readonly ok: true;
			/**
			 * The document the text says. Block ids are ignored (core gives every block one, pairing it with the body the text replaces), and so is the version
			 * (core lifts it). Links are plain `href`s and images are `src` or `mediaId` as the text says: core turns the address of an internal link into the
			 * entry's id, and the URL of a registered media file into its id.
			 */
			readonly doc: StoredDocument;
			/** Things the document does not keep as written. They do not block anything. */
			readonly warnings?: readonly FormatIssue[];
	  }
	| { readonly ok: false; readonly issues: readonly FormatIssue[] };

/**
 * What the store migrations that predate stored documents (`0012_soft_line_endings`, `0013_stored_documents`, `0015_code_annotations`) need of the format the
 * bodies of that time were written in. Bodies were stored as MDX text then, so only the `mdx` format has it: a store that still has to run those steps
 * needs a plugin that provides it (`@monti-cms/mdx`), and a store that does not never calls it.
 */
export interface LegacyBodies {
	/** The text with every soft line ending inside a paragraph made explicit (`0012`). `skipped`: the text is left as it is. */
	insertSoftBreaks(
		text: string,
	):
		| { readonly status: "unchanged" }
		| { readonly status: "changed"; readonly text: string }
		| { readonly status: "skipped"; readonly reason: string; readonly detail?: string };
	/**
	 * A body from its text (`0013`): the text as the format writes it now, and its document, or no document when the text does not read, has front matter
	 * or would not read back the same. Blocks inherit the ids of `options.previous` where they pair up.
	 */
	read(
		text: string,
		options?: { readonly previous?: StoredDocument | null },
	): { readonly text: string; readonly doc: StoredDocument | null };
	/** A body from its document, through the text the document is written as (`0015`): the same result as `read` of that text, with the document's block ids kept. */
	write(
		doc: StoredDocument,
		options?: { readonly previous?: StoredDocument | null },
	): { readonly text: string; readonly doc: StoredDocument | null };
	/** The document of a text, for the hash and search text of a body that is still text (`0010` to `0015`): `unparsed` for a text that does not read. */
	documentOf(text: string): StoredDocument;
}

export interface CmsFormat<Name extends string = string> {
	/** The value of the `format` option, for example `mdx`. Lowercase letters, digits and hyphens. */
	readonly name: Name;
	readonly label: string;
	readonly mimeType: string;
	/** File extension without the dot (`mdx`), for exported files. */
	readonly extension: string;
	/** Document → text. It must not throw for a node it does not know: write what can be read back, or `ctx.report` it. */
	export(doc: StoredDocument, ctx: FormatExportContext): string | Promise<string>;
	/** Text → document. Absent: the format is one-way (it can only be written, never read back). */
	import?(text: string, ctx: FormatImportContext): FormatImportResult | Promise<FormatImportResult>;
	/** Reads and writes the text that old stores kept bodies in. Only the `mdx` format has it; see {@link LegacyBodies}. */
	readonly legacyBodies?: LegacyBodies;
}

const FORMAT_NAME = /^[a-z][a-z0-9-]*$/;

export function assertFormatName(name: string): void {
	if (!FORMAT_NAME.test(name)) throw new Error(`cms format: invalid name "${name}"`);
}

/** Declares a format. It returns the value as it is, so the literal type of `name` is kept. */
export const defineFormat = <const F extends CmsFormat>(format: F): F => {
	assertFormatName(format.name);
	return format;
};

/** What `/v1/meta` reports about a format. */
export interface FormatInfo {
	readonly name: string;
	readonly label: string;
	readonly mimeType: string;
	readonly extension: string;
	/** Whether text in this format can be written to the CMS (`import` exists). */
	readonly canImport: boolean;
}
