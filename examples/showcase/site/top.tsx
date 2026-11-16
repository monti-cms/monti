import type { LanguageLink } from "@monti-cms/next";
import Link from "next/link";

/** The line at the top of every page of the site: its name, going to the first page, and its languages. */
export function Top({ home, links }: { home: string; links: LanguageLink[] }) {
	return (
		<nav className="top" aria-label="Site">
			<Link href={home}>Monti showcase</Link>
			<span>
				{links.map((link) => (
					<Link key={link.locale} href={link.href} lang={link.locale} aria-current={link.current ? "page" : undefined}>
						{link.name}
					</Link>
				))}
			</span>
		</nav>
	);
}
