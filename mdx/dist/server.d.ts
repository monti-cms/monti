import type { Site } from "@monti-cms/core/client";
import type { CmsFormat, LegacyBodies } from "@monti-cms/core/format";
import { type MdxFormatOptions } from "./format.js";
/**
 * The server side of the MDX package (`@monti-cms/mdx/server`): the `mdx` format as the server registers it, with what the store migrations that predate
 * stored documents need of it.
 *
 * Old stores kept bodies as MDX text. Core still lists the migration steps for them (`0012_soft_line_endings`, `0013_stored_documents`,
 * `0015_code_annotations`) but does not parse MDX: those steps read and write the text through `legacyBodies` of this format, and ask for it only when a store
 * has a body to read. A fresh store, and a store already past those steps, never needs this module at migrate time.
 */
/** Reads and writes the MDX text of old bodies of `site`, with the given syntax extensions (the ones the site wrote them with). */
export declare const legacyBodies: (site: Site, options?: MdxFormatOptions) => LegacyBodies;
/** The `mdx` format for the server: the format of `@monti-cms/mdx/format`, plus the old-body reader the store migrations ask for. */
export declare const createServerMdxFormat: (options?: MdxFormatOptions) => CmsFormat<"mdx">;
