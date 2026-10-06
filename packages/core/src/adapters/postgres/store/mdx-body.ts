import { documentText, SEARCH_TEXT } from "../../../core/body-text";
import { computeContentHash } from "../../../core/content-hash";
import type { JsonValue } from "../../../core/types";
import type { FormatRegistry } from "../../../format/registry";
import type { LegacyBodies } from "../../../format/types";

/**
 * The bodies of old stores are MDX text (the `mdx` column), and the store migrations that predate stored documents (`0010` to `0015`) work from that text.
 * They do not parse it themselves: the `mdx` format that `@monti-cms/mdx` supplies does (`CmsFormat.legacyBodies`). Core only keeps the step names and the SQL.
 *
 * The package is asked for lazily, when a step has a body to read. A fresh store has none, and a store already past those steps never runs them, so
 * neither needs the package at migrate time. A store that does need it and has none gets the error below.
 */

export const MDX_REQUIRED_MESSAGE =
	"This database still holds bodies stored as MDX text, and upgrading it needs the MDX format: install @monti-cms/mdx and add mdx() to the plugins of the site config to upgrade this database.";

/** The old-body reader of the site's `mdx` format. It throws `MDX_REQUIRED_MESSAGE` when it is first used and there is no such format. */
export const legacyBodiesOf = (formats: FormatRegistry): LegacyBodies => {
	const provided = (): LegacyBodies => {
		const bodies = formats.get("mdx")?.legacyBodies;
		if (!bodies) throw new Error(MDX_REQUIRED_MESSAGE);
		return bodies;
	};
	return {
		insertSoftBreaks: (text) => provided().insertSoftBreaks(text),
		read: (text, options) => provided().read(text, options),
		write: (doc, options) => provided().write(doc, options),
		documentOf: (text) => provided().documentOf(text),
	};
};

/**
 * Hash and search text of a body given as text, for the store migrations that predate stored documents: they work from the text a row holds. The document of the
 * text is whatever the format reads it as, and text that does not read is hashed as it is. New code works from documents and never calls these.
 */
export const mdxContentHash = (bodies: LegacyBodies, metadata: JsonValue, mdx: string, schemaVersion = 1): string =>
	computeContentHash(metadata, bodies.documentOf(mdx), schemaVersion);

export const mdxSearchText = (bodies: LegacyBodies, mdx: string): string =>
	documentText(bodies.documentOf(mdx), SEARCH_TEXT);
