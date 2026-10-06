import { MAX_TEXT_BYTES } from "../core/limits";
import { type Issue, ServiceError } from "../core/types";
import { assignBlockIds, withoutBlockIds } from "../mdx/block-ids";
import { canonicalDocument, readStoredDocument, type StoredDocument, unparsedDocument } from "../mdx/stored-document";
import { builtInFormatContext } from "./mdx";
import type { FormatRegistry } from "./registry";
import type {
	FormatExportContext,
	FormatImportContext,
	FormatIssue,
	FormatLink,
	FormatMedia,
	FormatPurpose,
} from "./types";

/**
 * The seam between core and the formats. Core calls a format only through these two functions: they build the context a format may rely on, check what
 * comes back, and turn a failure into the one error contract of the APIs (`unknown_format`, `format_not_importable`, `format_import_failed`,
 * `format_export_failed`).
 */

const issueOf = (issue: FormatIssue): Issue => ({
	code: issue.code,
	...(issue.message === undefined ? {} : { message: issue.message }),
	...(issue.params === undefined ? {} : { params: issue.params }),
	...(issue.position === undefined ? {} : { position: issue.position }),
});

/** A text that was read into a document: the document, and what was found about the text. */
export interface ImportedText {
	readonly doc: StoredDocument;
	/** Why the text could not be read: it is kept as an `unparsed` node of the document, which a draft can hold and `unparsed_body` blocks publishing. */
	readonly issues: Issue[];
	/** Things the document does not keep as written. */
	readonly warnings: Issue[];
}

export interface ImportOptions {
	readonly locale: string;
	/** The entry the text is written to, when it exists. */
	readonly entryId?: string;
	/** The body the text replaces. The blocks of the result inherit its block ids where they pair up. */
	readonly previous?: StoredDocument | null;
	/**
	 * What to do with a text the format rejects. By default it is kept as an `unparsed` document (a draft can hold it). With `strict` it fails the write with
	 * `format_import_failed` and the format's findings as `issues`, for a place that cannot hold such a text.
	 */
	readonly strict?: boolean;
}

/**
 * Reads a text in a format into a document. The format returns the document without caring about ids; here every block gets one (inheriting from
 * `previous`). A text the format rejects (`ok: false`) is not lost: it becomes the document of one `unparsed` node holding the text as given, with the
 * format's findings as `issues`. A format that is unknown or one-way, or that throws, fails the write.
 */
export async function importText(
	registry: FormatRegistry,
	name: string,
	text: string,
	options: ImportOptions,
): Promise<ImportedText> {
	const format = registry.get(name);
	if (!format)
		throw new ServiceError("unknown_format", [{ code: "unknown_format", message: name, params: { format: name } }]);
	if (!format.import) {
		throw new ServiceError("format_not_importable", [
			{ code: "format_not_importable", message: name, params: { format: name } },
		]);
	}
	if (Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES) throw new ServiceError("body_too_large");
	const context: FormatImportContext = {
		...builtInFormatContext(options.locale),
		...(options.entryId ? { entryId: options.entryId } : {}),
	};
	let result: Awaited<ReturnType<NonNullable<typeof format.import>>>;
	try {
		result = await format.import(text, context);
	} catch (error) {
		console.error(`[cms] format "${name}" failed to import`, error);
		throw new ServiceError("format_import_failed", [
			{ code: "format_import_failed", message: name, params: { format: name } },
		]);
	}
	if (!result.ok) {
		if (options.strict) throw new ServiceError("format_import_failed", result.issues.map(issueOf));
		return { doc: unparsedDocument(text, options.previous, name), issues: result.issues.map(issueOf), warnings: [] };
	}
	// What a plugin returns is checked like a document from the API: its shape, its version, and the canonical form every body is stored in.
	const read = readStoredDocument(result.doc);
	if (!read) {
		console.error(`[cms] format "${name}" returned something that is not a stored document`);
		throw new ServiceError("format_import_failed", [
			{ code: "format_import_failed", message: name, params: { format: name } },
		]);
	}
	const canonical = canonicalDocument(read);
	const content = assignBlockIds(withoutBlockIds(canonical.content), [options.previous?.content]);
	const warnings: Issue[] = (result.warnings ?? []).map((warning) => {
		const blockId = warning.blockIndex === undefined ? undefined : content[warning.blockIndex]?.id;
		return {
			...issueOf(warning),
			...(blockId === undefined ? {} : { path: "body", position: { blockId } }),
		};
	});
	return { doc: { ...canonical, content }, issues: [], warnings };
}

/** What the document points to, resolved before a format writes it (so the format's lookups are synchronous). */
export interface ExportRefs {
	/** Entry id (translation group id) → where the link goes. An id that is not here is unresolved. */
	readonly links: ReadonlyMap<string, FormatLink> | Readonly<Record<string, FormatLink | undefined>>;
	/** Media id → the public URL and file info. An id that is not here is unresolved. */
	readonly media: ReadonlyMap<string, FormatMedia> | Readonly<Record<string, FormatMedia | undefined>>;
}

const lookup = <T>(source: ReadonlyMap<string, T> | Readonly<Record<string, T | undefined>>, key: string): T | null =>
	(source instanceof Map ? source.get(key) : (source as Readonly<Record<string, T | undefined>>)[key]) ?? null;

export interface ExportOptions {
	readonly locale: string;
	readonly purpose: FormatPurpose;
	readonly refs: ExportRefs;
}

/** Writes a document as text in a format. The warnings are what the format reported (an unresolved link or media). */
export async function exportText(
	registry: FormatRegistry,
	name: string,
	doc: StoredDocument,
	options: ExportOptions,
): Promise<{ text: string; warnings: Issue[] }> {
	const format = registry.get(name);
	if (!format)
		throw new ServiceError("unknown_format", [{ code: "unknown_format", message: name, params: { format: name } }]);
	const warnings: Issue[] = [];
	const context: FormatExportContext = {
		...builtInFormatContext(options.locale),
		purpose: options.purpose,
		link: (entryId) => lookup(options.refs.links, entryId),
		media: (mediaId) => lookup(options.refs.media, mediaId),
		report: (issue) => warnings.push(issueOf(issue)),
	};
	try {
		return { text: await format.export(doc, context), warnings };
	} catch (error) {
		console.error(`[cms] format "${name}" failed to export`, error);
		throw new ServiceError("format_export_failed", [
			{ code: "format_export_failed", message: name, params: { format: name } },
		]);
	}
}
