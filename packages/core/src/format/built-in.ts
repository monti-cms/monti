import { mdxFormat } from "./mdx";
import { createFormatRegistry, type FormatRegistry } from "./registry";
import type { CmsFormat } from "./types";

/** The formats core brings itself. A CMS instance adds the formats of its plugins to them. */
export const BUILT_IN_FORMAT_LIST: readonly CmsFormat[] = [mdxFormat];

export const BUILT_IN_FORMATS: FormatRegistry = createFormatRegistry(BUILT_IN_FORMAT_LIST);
