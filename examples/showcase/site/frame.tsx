import { PreviewBar } from "@monti-cms/next";
import Link from "next/link";
import type { ReactNode } from "react";
import "../app/site.css";
import { reader } from "@/lib/monti";
import { home } from "./paths";

/**
 * The frame of every page of the site, in one language: the document's language, the site's styles (under `.site`, so they do not reach the
 * admin's page), a line of the site's languages and the preview's line. The admin's page has a frame of its own.
 */
export function SiteFrame({ lang, children }: { lang: string; children: ReactNode }) {
	return (
		<html lang={lang}>
			<body>
				<div className="site">
					<nav className="top">
						<Link href={home(lang)}>Monti showcase</Link>
						<span>
							{reader.locales().list.map((locale) => (
								<Link
									key={locale.code}
									href={home(locale.code)}
									aria-current={locale.code === lang ? "page" : undefined}
								>
									{locale.name}
								</Link>
							))}
						</span>
					</nav>
					<main>{children}</main>
				</div>
				{/* One line while a preview is open, with the way out of it. */}
				<PreviewBar labels={{ preview: "미리보기", exit: "끝내기" }} />
			</body>
		</html>
	);
}
