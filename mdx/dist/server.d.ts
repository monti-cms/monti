import type { CmsFormat } from "@monti-cms/core/format";
import { type MdxFormatOptions } from "./format.js";
/**
 * The server side of the MDX package (`@monti-cms/mdx/server`): the `mdx` format as the server registers it. The plugin loads it lazily, so the MDX
 * parser stays out of the browser bundle (see `server.browser.ts`).
 */
export declare const createServerMdxFormat: (options?: MdxFormatOptions) => CmsFormat<"mdx">;
