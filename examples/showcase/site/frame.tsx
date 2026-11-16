import { CodeTools, homePath, languageLinks, PreviewBar } from "@monti-cms/next";
import "@monti-cms/core/render.css";
import type { SiteTranslation } from "@monti-cms/core";
import type { ReactNode } from "react";
import "../app/site.css";
import { reader } from "@/lib/monti";
import { NotFoundTop } from "./not-found-top";
import { Top } from "./top";

/**
 * The document of every page of the site, in one language: the document's language, the site's styles (under `.site`, so they do not reach
 * the admin's page) and the preview's line. The admin's page has a frame of its own.
 */
export function SiteFrame({ lang, children }: { lang: string; children: ReactNode }) {
	return (
		<html lang={lang}>
			<body>
				{children}
				{/* The code blocks' copy button, folded words and code links. */}
				<CodeTools labels={{ back: "글로 돌아가기" }} />
				{/* One line while a preview is open, with the way out of it. */}
				<PreviewBar labels={{ preview: "미리보기", exit: "끝내기" }} />
			</body>
		</html>
	);
}

/**
 * A page of the site: the top line, then what the page shows. The page draws the top line, not the layout: only the page knows which entry
 * it shows, and each language's link goes to that entry in that language (`translations`), or to the language's first page when it is not
 * there in it.
 */
export function SitePage({
	locale,
	path,
	translations,
	children,
}: {
	locale: string;
	/** The page's own address, where its own language's link goes. */
	path?: string | null;
	translations?: SiteTranslation[];
	children: ReactNode;
}) {
	const locales = reader.locales();
	return (
		<div className="site">
			<Top home={homePath(locales, locale)} links={languageLinks(locales, { locale, path, translations })} />
			<main>{children}</main>
		</div>
	);
}

/** The page of an address with nothing at it (`not-found.tsx`): the same top line, so a visitor can go on from there. */
export function NotFound() {
	const locales = reader.locales();
	return (
		<div className="site">
			<NotFoundTop
				source={locales.source}
				homes={locales.list.map(({ code, name }) => ({ locale: code, name, href: homePath(locales, code) }))}
			/>
			<main>
				<h1>Page not found</h1>
			</main>
		</div>
	);
}
