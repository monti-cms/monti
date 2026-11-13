import type { BlockProps } from "@monti-cms/core/render";
import { Children, type ReactNode } from "react";

/** The kinds of callout, in the order the admin offers them (GitHub's and Docusaurus's five). */
export const TONES = ["note", "tip", "info", "warning", "danger"] as const;
export type Tone = (typeof TONES)[number];

/** A callout with no title is titled by its kind, in the entry's language (English when the site gives none). The site's own words: change them. */
const WORDS: Record<string, Record<Tone, string>> = {
	en: { note: "Note", tip: "Tip", info: "Info", warning: "Warning", danger: "Danger" },
	ko: { note: "노트", tip: "팁", info: "정보", warning: "경고", danger: "위험" },
	ja: { note: "ノート", tip: "ヒント", info: "情報", warning: "警告", danger: "危険" },
};
const wordsIn = (locale?: string) => WORDS[(locale ?? "").toLowerCase().split(/[-_]/)[0] ?? ""] ?? WORDS.en;

/** A kind the callout knows; anything else is a note. */
export const toneOf = (value: unknown): Tone => TONES.find((tone) => tone === value) ?? "note";

/** A callout: its title (or its kind's name) over the blocks it holds, in its kind's colour. One with only a title draws no empty body. */
export function Callout({ attrs, locale, children }: BlockProps & { children?: ReactNode }) {
	const tone = toneOf(attrs.tone);
	const title =
		typeof attrs.title === "string" && attrs.title.trim() !== "" ? attrs.title.trim() : wordsIn(locale)[tone];
	return (
		<div className="monti-block-callout" data-tone={tone} role="note">
			<div className="monti-block-callout-title">{title}</div>
			{Children.count(children) > 0 ? <div className="monti-block-callout-body">{children}</div> : null}
		</div>
	);
}
