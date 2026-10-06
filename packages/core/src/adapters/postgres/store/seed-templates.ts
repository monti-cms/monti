import type { SeedTemplate } from "../../../config/define";
import { DEFAULT_LOCALE } from "../../../core/locales";
import { importText } from "../../../format/convert";
import type { FormatRegistry } from "../../../format/registry";
import { assignBlockIds } from "../../../mdx/block-ids";
import { canonicalDocument, readStoredDocument, type StoredDocument } from "../../../mdx/stored-document";

/**
 * The document a seed template of the site config is stored as. A template given as a document is checked like any stored document; one given as text
 * is read by its format, which must be one of the instance's formats (a plugin provides it). A seed that cannot become a document is a mistake in the
 * config, so it stops the migration with a message that names the template (unlike stored data, which always migrates).
 */
export async function seedTemplateDocument(template: SeedTemplate, formats: FormatRegistry): Promise<StoredDocument> {
	const label = `cms.config: seed template "${template.name}"`;
	if ("doc" in template && template.doc !== undefined) {
		const doc = readStoredDocument(template.doc);
		if (!doc) throw new Error(`${label} is not a stored document`);
		const canonical = canonicalDocument(doc);
		return { ...canonical, content: assignBlockIds(canonical.content, []) };
	}
	const { body, format } = template as { body: string; format: string };
	if (!formats.get(format)) {
		throw new Error(
			`${label} is written in the format "${format}", which no installed plugin provides${format === "mdx" ? " (install @monti-cms/mdx)" : ""}`,
		);
	}
	const imported = await importText(formats, format, body, { locale: DEFAULT_LOCALE }).catch((error: unknown) => {
		throw new Error(
			`${label} could not be read as "${format}": ${error instanceof Error ? error.message : String(error)}`,
		);
	});
	if (imported.issues.length > 0) {
		throw new Error(
			`${label} could not be read as "${format}": ${imported.issues.map((issue) => issue.message ?? issue.code).join("; ")}`,
		);
	}
	return imported.doc;
}
