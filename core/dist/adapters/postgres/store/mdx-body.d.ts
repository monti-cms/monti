import type { JsonValue } from "../../../core/types.js";
import type { FormatRegistry } from "../../../format/registry.js";
import type { LegacyBodies } from "../../../format/types.js";
import type { Site } from "../../../site/index.js";
/**
 * The bodies of old stores are MDX text (the `mdx` column), and the store migrations that predate stored documents (`0010` to `0015`) work from that text.
 * They do not parse it themselves: the `mdx` format that `@monti-cms/mdx` supplies does (`CmsFormat.legacyBodies`). Core only keeps the step names and the SQL.
 *
 * The package is asked for lazily, when a step has a body to read. A fresh store has none, and a store already past those steps never runs them, so
 * neither needs the package at migrate time. A store that does need it and has none gets the error below.
 */
export declare const MDX_REQUIRED_MESSAGE: string;
/** The old-body reader of the site's `mdx` format. It throws `MDX_REQUIRED_MESSAGE` when it is first used and there is no such format. */
export declare const legacyBodiesOf: (formats: FormatRegistry, site: Site) => LegacyBodies;
/**
 * Hash and search text of a body given as text, for the store migrations that predate stored documents: they work from the text a row holds. The document of the
 * text is whatever the format reads it as, and text that does not read is hashed as it is. New code works from documents and never calls these.
 */
export declare const mdxContentHash: (bodies: LegacyBodies, metadata: JsonValue, mdx: string) => string;
export declare const mdxSearchText: (site: Site, bodies: LegacyBodies, mdx: string) => string;
