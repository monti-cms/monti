import { type BlockProps, defineRender } from "@monti-cms/core/render";
import type { PropsWithChildren } from "react";
import { type BlockLabels, blockLabels } from "../shared/labels";
import type { collapsibleBlock } from "./definition";

/** Collapsible. Expands when the title is clicked (it is a `<details>`, so no script is needed). With no title, the default text in the site language is used. */
export function Collapsible({
	title,
	defaultOpen,
	labels = blockLabels(),
	children,
}: PropsWithChildren<{ title?: string; defaultOpen?: boolean; labels?: BlockLabels }>) {
	return (
		<details className="cms-block-collapsible" open={defaultOpen || undefined}>
			<summary className="cms-block-collapsible-summary">{title?.trim() || labels.collapsibleFallback}</summary>
			<div className="cms-block-collapsible-body">{children}</div>
		</details>
	);
}

/** Public components for the collapsible in the JSON renderer (`renderDocument`). */
export default defineRender({
	blocks: {
		collapsible: ({ title, defaultOpen, children, ctx }: BlockProps<typeof collapsibleBlock>) => (
			<Collapsible title={title} defaultOpen={defaultOpen} labels={blockLabels(ctx.locale)}>
				{children}
			</Collapsible>
		),
	},
});
