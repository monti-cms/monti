import type { BlockProps } from "@monti-cms/core/render";
import { Children, type ReactNode } from "react";
import { style } from "./style";
import { wordsIn } from "./words";

/** The kinds of callout, in the order the admin offers them (GitHub's and Docusaurus's five). */
export const TONES = ["note", "tip", "info", "warning", "danger"] as const;
export type Tone = (typeof TONES)[number];

/** A kind the callout knows; anything else is a note. */
export const toneOf = (value: unknown): Tone => TONES.find((tone) => tone === value) ?? "note";

/** A callout: its title (or its kind's name) over the blocks it holds, in its kind's colour. One with only a title draws no empty body. */
function CalloutDrawing({ attrs, locale, children }: BlockProps & { children?: ReactNode }) {
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

/** Callout with its look (`style.ts`): React puts it into the page once, however many of the block there are. */
export function Callout(props: Parameters<typeof CalloutDrawing>[0]) {
	return (
		<>
			<style href="monti-block-callout" precedence="monti-blocks">
				{style}
			</style>
			<CalloutDrawing {...props} />
		</>
	);
}
