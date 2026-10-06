import "@monti-cms/core/client";
import { createFormatRegistry } from "@monti-cms/core/format";
import { type Collection, DOCUMENT_COLLECTIONS } from "../../../core/src/core/collections";
import { prepareSnapshot as prepareCore } from "../../../core/src/core/snapshot";
import { mdxFormat } from "../format";

/**
 * Helpers of the tests that run core's snapshot preparation over MDX text. Core reads a text body through a registered format, so these tests register the
 * `mdx` format. (The first import makes sure the configured blocks are loaded before the core modules that read them.)
 */

/** The first collection with a body of the site config the tests run with. */
export const contentCollection = DOCUMENT_COLLECTIONS[0] as Collection;

/** `prepareSnapshot` with the `mdx` format registered, so `format: "mdx"` bodies are read. */
export const prepareSnapshot = (
	value: Parameters<typeof prepareCore>[0],
	options: Parameters<typeof prepareCore>[1] = {},
) => prepareCore(value, { ...options, import: { ...options.import, formats: createFormatRegistry([mdxFormat]) } });
