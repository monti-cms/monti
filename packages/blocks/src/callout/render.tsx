import type { BlockProps, DocumentComponentsContext, LooseDocumentComponents } from "@monti-cms/core/render";
import { Children, type PropsWithChildren } from "react";
import { type BlockLabels, blockLabels } from "../shared/labels";
import type { calloutBlock } from "./definition";
import type { CalloutVariant } from "./style";

const VARIANTS: readonly CalloutVariant[] = ["note", "tip", "info", "warning", "danger"];

const titleOf = (variant: CalloutVariant, labels: BlockLabels) =>
	({
		note: labels.calloutNote,
		tip: labels.calloutTip,
		info: labels.calloutInfo,
		warning: labels.calloutWarning,
		danger: labels.calloutDanger,
	})[variant];

/** Callout. Wraps the title and body in a box with an accent color per `variant`. An unknown variant falls back to note; a missing title falls back to the variant name. */
export function Callout({
	variant,
	title,
	labels = blockLabels(),
	children,
}: PropsWithChildren<{ variant?: string; title?: string; labels?: BlockLabels }>) {
	const kind = VARIANTS.find((item) => item === variant) ?? "note";
	return (
		<div className="cms-block-callout" data-variant={kind} role="note">
			<div className="cms-block-callout-title">{title?.trim() || titleOf(kind, labels)}</div>
			{/* A callout with only a title does not render an empty body slot. */}
			{Children.count(children) > 0 ? <div className="cms-block-callout-body">{children}</div> : null}
		</div>
	);
}

/** Public components for the callout in the JSON renderer (`renderDocument`): the block `callout`, with its attributes as props. */
export const documentComponents = ({ locale }: DocumentComponentsContext): LooseDocumentComponents => {
	const labels = blockLabels(locale);
	return {
		blocks: {
			callout: ({ variant, title, children }: BlockProps<typeof calloutBlock>) => (
				<Callout variant={variant} title={title} labels={labels}>
					{children}
				</Callout>
			),
		},
	};
};
