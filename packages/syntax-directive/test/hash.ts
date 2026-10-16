import type { Site } from "@monti-cms/core/site";
import { computeContentHash } from "@monti-cms/core/testing";
import type { SyntaxExtension } from "@monti-cms/mdx";
import { docOfMdx } from "@monti-cms/mdx/testing";

/** The content hash of MDX text read with the given syntax extensions (none: standard MDX), as a write would store it. */
export const hashOf = (
	site: Site,
	metadata: Parameters<typeof computeContentHash>[0],
	mdx: string,
	syntax?: readonly SyntaxExtension[],
) => computeContentHash(metadata, docOfMdx(site, mdx, syntax));
