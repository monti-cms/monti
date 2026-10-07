import type { Site } from "@monti-cms/core/client";
import { mdxContentHash } from "@monti-cms/core/testing";
import type { SyntaxExtension } from "@monti-cms/mdx";
import { legacyBodies } from "@monti-cms/mdx/server";

/** The content hash of MDX text read with the given syntax extensions (none: standard MDX), the way the store migrations compute it. */
export const hashOf = (
	site: Site,
	metadata: Parameters<typeof mdxContentHash>[1],
	mdx: string,
	syntax?: readonly SyntaxExtension[],
) => mdxContentHash(legacyBodies(site, syntax ? { syntax } : {}), metadata, mdx);
