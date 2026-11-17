"use client";

import { type DocumentViewProps, defineAdminPlugin, useRead } from "@monti-cms/admin";
import { CodeBlock } from "@monti-cms/ui";
import { mdxWords } from "./messages";
import { toMdx } from "./write";

/** The body as the MDX it would be written as, with the title as front matter: it follows what is typed. A picture is named by its library file. */
function MdxView({ doc, title }: DocumentViewProps) {
	// The site's blocks written as fenced code (a formula as ```math, doc 18), from the site's catalog.
	const catalog = useRead<{ blocks: { type: string; fence: { language: string; attr: string } | null }[] }>(
		"blocks.catalog",
		{},
	);
	const fences = Object.fromEntries(
		(catalog.data?.blocks ?? []).flatMap((block) => (block.fence ? [[block.type, block.fence]] : [])),
	);
	return <CodeBlock>{toMdx(doc, { values: title ? { title } : {}, fences })}</CodeBlock>;
}

/**
 * The MDX plugin's half in the browser: "View as MDX" in the editors' ⋯ (doc 14, the document tools). Hand it to the admin page:
 * `<AdminPage plugins={[mdxAdmin]} />`.
 */
export const mdxAdmin = defineAdminPlugin({
	name: "mdx",
	documentViews: [{ id: "source", label: { en: mdxWords.en.view, ko: mdxWords.ko.view }, View: MdxView }],
});
