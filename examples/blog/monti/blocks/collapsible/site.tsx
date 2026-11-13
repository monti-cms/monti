import type { BlockProps } from "@monti-cms/core/render";
import type { ReactNode } from "react";
import { style } from "./style";
import { wordsIn } from "./words";

/** A collapsible: a `<details>`, so it opens without a script. It starts open when `defaultOpen` says so. */
function CollapsibleDrawing({ attrs, locale, children }: BlockProps & { children?: ReactNode }) {
	const title = typeof attrs.title === "string" && attrs.title.trim() !== "" ? attrs.title.trim() : wordsIn(locale);
	return (
		<details className="monti-block-collapsible" open={attrs.defaultOpen === true || undefined}>
			<summary className="monti-block-collapsible-summary">{title}</summary>
			<div className="monti-block-collapsible-body">{children}</div>
		</details>
	);
}

/** Collapsible with its look (`style.ts`): React puts it into the page once, however many of the block there are. */
export function Collapsible(props: Parameters<typeof CollapsibleDrawing>[0]) {
	return (
		<>
			<style href="monti-block-collapsible" precedence="monti-blocks">
				{style}
			</style>
			<CollapsibleDrawing {...props} />
		</>
	);
}
