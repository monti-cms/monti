import type { CmsFormat } from "@monti-cms/core/format";
import { createMdxFormat, type MdxFormatOptions } from "./format";

/**
 * The server side of the MDX package (`@monti-cms/mdx/server`): the `mdx` format as the server registers it. The plugin loads it lazily, so the MDX
 * parser stays out of the browser bundle (see `server.browser.ts`).
 */
export const createServerMdxFormat = (options: MdxFormatOptions = {}): CmsFormat<"mdx"> => createMdxFormat(options);
