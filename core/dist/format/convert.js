import { MAX_TEXT_BYTES } from "../core/limits.js";
import { ServiceError } from "../core/types.js";
import { assignBlockIds, withoutBlockIds } from "../doc/block-ids.js";
import { canonicalDocument, readStoredDocument, unparsedDocument } from "../doc/stored-document.js";
import { siteFormatContext } from "./context.js";
import { unknownFormatError } from "./unknown.js";
/**
 * The seam between core and the formats. Core calls a format only through these two functions: they build the context a format may rely on, check what
 * comes back, and turn a failure into the one error contract of the APIs (`unknown_format`, `format_not_importable`, `format_import_failed`,
 * `format_export_failed`).
 */
const issueOf = (issue) => ({
    code: issue.code,
    ...(issue.message === undefined ? {} : { message: issue.message }),
    ...(issue.params === undefined ? {} : { params: issue.params }),
    ...(issue.position === undefined ? {} : { position: issue.position }),
});
/**
 * Reads a text in a format into a document. The format returns the document without caring about ids; here every block gets one (inheriting from
 * `previous`). A text the format rejects (`ok: false`) is not lost: it becomes the document of one `unparsed` node holding the text as given, with the
 * format's findings as `issues`. A format that is unknown or one-way, or that throws, fails the write.
 */
export async function importText(site, registry, name, text, options) {
    const format = registry.get(name);
    if (!format)
        throw unknownFormatError(name, registry);
    if (!format.import) {
        throw new ServiceError("format_not_importable", [
            { code: "format_not_importable", message: name, params: { format: name } },
        ]);
    }
    if (Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES)
        throw new ServiceError("body_too_large");
    const context = {
        ...siteFormatContext(site, options.locale),
        ...(options.entryId ? { entryId: options.entryId } : {}),
    };
    let result;
    try {
        result = await format.import(text, context);
    }
    catch (error) {
        console.error(`[cms] format "${name}" failed to import`, error);
        throw new ServiceError("format_import_failed", [
            { code: "format_import_failed", message: name, params: { format: name } },
        ]);
    }
    if (!result.ok) {
        if (options.strict)
            throw new ServiceError("format_import_failed", result.issues.map(issueOf));
        return { doc: unparsedDocument(text, options.previous, name), issues: result.issues.map(issueOf), warnings: [] };
    }
    // What a plugin returns is checked like a document from the API: its shape, its version, and the canonical form every body is stored in.
    const read = readStoredDocument(result.doc, site);
    if (!read) {
        console.error(`[cms] format "${name}" returned something that is not a stored document`);
        throw new ServiceError("format_import_failed", [
            { code: "format_import_failed", message: name, params: { format: name } },
        ]);
    }
    const canonical = canonicalDocument(site, read);
    const content = assignBlockIds(withoutBlockIds(canonical.content), [options.previous?.content]);
    const warnings = (result.warnings ?? []).map((warning) => {
        const blockId = warning.blockIndex === undefined ? undefined : content[warning.blockIndex]?.id;
        return {
            ...issueOf(warning),
            ...(blockId === undefined ? {} : { path: "body", position: { blockId } }),
        };
    });
    return { doc: { ...canonical, content }, issues: [], warnings };
}
const lookup = (source, key) => (source instanceof Map ? source.get(key) : source[key]) ?? null;
/** Writes a document as text in a format. The warnings are what the format reported (an unresolved link or media). */
export async function exportText(site, registry, name, doc, options) {
    const format = registry.get(name);
    if (!format)
        throw unknownFormatError(name, registry);
    const warnings = [];
    const context = {
        ...siteFormatContext(site, options.locale),
        purpose: options.purpose,
        link: (entryId) => lookup(options.refs.links, entryId),
        media: (mediaId) => lookup(options.refs.media, mediaId),
        report: (issue) => warnings.push(issueOf(issue)),
    };
    try {
        return { text: await format.export(doc, context), warnings };
    }
    catch (error) {
        console.error(`[cms] format "${name}" failed to export`, error);
        throw new ServiceError("format_export_failed", [
            { code: "format_export_failed", message: name, params: { format: name } },
        ]);
    }
}
