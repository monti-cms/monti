import type { Site } from "@monti-cms/core/client";
import { createFormatRegistry } from "@monti-cms/core/format";
import { prepareSnapshot as prepareCore } from "../../../core/src/core/snapshot";
import { testSite } from "../../../core/test/site";
import { mdxFormat } from "../format";

/**
 * Helpers of the tests that run core's snapshot preparation over MDX text. Core reads a text body through a registered format, so these tests register the
 * `mdx` format. They run against the shared test site, or against a site the test builds (`prepareSnapshotOf`).
 */

/** The first collection with a body of the site config the tests run with. */
export const contentCollection = testSite.DOCUMENT_COLLECTIONS[0] as string;

/** `prepareSnapshot` of `site` with the `mdx` format registered, so `format: "mdx"` bodies are read. */
export const prepareSnapshotOf =
	(site: Site) =>
	(value: Parameters<typeof prepareCore>[1], options: Parameters<typeof prepareCore>[2] = {}) =>
		prepareCore(site, value, {
			...options,
			import: { ...options.import, formats: createFormatRegistry([mdxFormat]) },
		});

/** `prepareSnapshot` of the test site with the `mdx` format registered. */
export const prepareSnapshot = prepareSnapshotOf(testSite);
