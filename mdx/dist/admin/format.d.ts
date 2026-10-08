import type { BrowserFormat } from "@monti-cms/admin";
import type { Site } from "@monti-cms/core/client";
import { type MdxFormatOptions } from "../format.js";
/** The browser side of the `mdx` format for `site`, reading and writing with the given syntax extensions (none: standard MDX). */
export declare const createMdxBrowserFormat: (site: Site, options?: MdxFormatOptions) => BrowserFormat;
