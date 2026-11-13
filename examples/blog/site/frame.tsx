import { PreviewBar } from "@monti-cms/next";
import type { ReactNode } from "react";
import "../app/site.css";
import "../monti/blocks/blocks.css";

/**
 * The frame of every page of the site, in one language: the document's language, the site's styles (under `.site`, so they do not reach the
 * admin's page) and the preview's line. The admin's page has a frame of its own.
 */
export function SiteFrame({ lang, children }: { lang: string; children: ReactNode }) {
	return (
		<html lang={lang}>
			<body>
				<main className="site">{children}</main>
				{/* One line while a preview is open, with the way out of it. */}
				<PreviewBar labels={{ preview: "미리보기", exit: "끝내기" }} />
			</body>
		</html>
	);
}
