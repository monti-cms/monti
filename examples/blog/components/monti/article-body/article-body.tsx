import {
	CmsContent,
	type CmsContentEntry,
	type CmsContentSource,
	type DocumentComponents,
	type DocumentTocItem,
	type TocRange,
	tableOfContents,
} from "@monti-cms/core/render";
import type { ReactNode } from "react";

export interface ArticleBodyProps {
	/** The CMS instance the entry was read from (your `cms`): its site decides the blocks and the code settings the body is drawn with. */
	cms: CmsContentSource;
	/** An entry of the read API (`cms.read.getEntry`). Its `doc` is drawn, its `refs` give the images and files, its `locale` the language. */
	entry: CmsContentEntry;
	/** Public components of the site's blocks (see `DocumentComponents`). */
	components?: DocumentComponents;
	/** Where the table of contents goes: above the text, or `false` for none. Default `"top"`. */
	toc?: "top" | false;
	/** The heading levels to list. Default `h2` and `h3`. */
	tocRange?: TocRange;
	/** Label of the table of contents, for screen readers. Default "Table of contents". */
	tocLabel?: string;
	/** Class names of the text column (the `prose` classes need the `@tailwindcss/typography` plugin). */
	className?: string;
	/** Draws one table of contents entry. Default: a link, indented by `depth`. */
	renderTocItem?: (item: DocumentTocItem) => ReactNode;
}

const defaultTocItem = (item: DocumentTocItem) => <a href={item.href}>{item.value}</a>;

/**
 * The body of a public article: the stored document drawn by `CmsContent`, with a table of contents built by `tableOfContents`. A server
 * component, so the page ships no editor code. It is source you own: change the markup and the classes freely.
 */
export async function ArticleBody({
	cms,
	entry,
	components,
	toc = "top",
	tocRange,
	tocLabel = "Table of contents",
	className = "prose dark:prose-invert max-w-none",
	renderTocItem = defaultTocItem,
}: ArticleBodyProps) {
	const items = toc === false ? [] : tableOfContents(entry.doc, tocRange);
	return (
		<>
			{items.length > 0 ? (
				<nav aria-label={tocLabel} className="mb-8 text-sm">
					<ul>
						{items.map((item) => (
							<li key={item.href} style={{ marginLeft: item.depth * 12 }}>
								{renderTocItem(item)}
							</li>
						))}
					</ul>
				</nav>
			) : null}
			<article className={className}>
				<CmsContent cms={cms} entry={entry} components={components} />
			</article>
		</>
	);
}
