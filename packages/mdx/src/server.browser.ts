import type { Site } from "@monti-cms/core/client";
import type { CmsFormat, LegacyBodies } from "@monti-cms/core/format";
import type { MdxFormatOptions } from "./format";

/**
 * `@monti-cms/mdx/server` for the browser bundle. The site config is also read in the browser, and `plugin.ts` imports the server side lazily;
 * this entry point replaces it so the MDX parser and the migration code are not sent to the browser (the `browser` condition of package.json `exports`).
 * Both functions exist only so the export names match; the server side never runs in the browser.
 */
const serverOnly = (name: string): never => {
	throw new Error(`@monti-cms/mdx/server: ${name} runs on the server only.`);
};

export const legacyBodies = (_site: Site, _options: MdxFormatOptions = {}): LegacyBodies => serverOnly("legacyBodies");

export const createServerMdxFormat = (_options: MdxFormatOptions = {}): CmsFormat<"mdx"> =>
	serverOnly("createServerMdxFormat");
