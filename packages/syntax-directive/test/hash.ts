import { mdxContentHash } from "@monti-cms/core/testing";
import type { SyntaxExtension } from "@monti-cms/mdx";
import { legacyBodies } from "@monti-cms/mdx/server";

/** The content hash of MDX text read with the given syntax extensions (none: standard MDX), the way the store migrations compute it. */
export const hashOf = (
	metadata: Parameters<typeof mdxContentHash>[1],
	mdx: string,
	version: number,
	syntax?: readonly SyntaxExtension[],
) => mdxContentHash(legacyBodies(syntax ? { syntax } : {}), metadata, mdx, version);
