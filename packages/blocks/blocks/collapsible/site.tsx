import type { BlockProps } from "@monti-cms/core/render";
import type { ReactNode } from "react";

/** The title of a collapsible with none, in the entry's language (English when the site gives none). The site's own words: change them. */
const WORDS: Record<string, string> = { en: "Show more", ko: "펼치기", ja: "開く" };
const wordsIn = (locale?: string) => WORDS[(locale ?? "").toLowerCase().split(/[-_]/)[0] ?? ""] ?? WORDS.en;

/** A collapsible: a `<details>`, so it opens without a script. It starts open when `defaultOpen` says so. */
export function Collapsible({ attrs, locale, children }: BlockProps & { children?: ReactNode }) {
	const title = typeof attrs.title === "string" && attrs.title.trim() !== "" ? attrs.title.trim() : wordsIn(locale);
	return (
		<details className="monti-block-collapsible" open={attrs.defaultOpen === true || undefined}>
			<summary className="monti-block-collapsible-summary">{title}</summary>
			<div className="monti-block-collapsible-body">{children}</div>
		</details>
	);
}
