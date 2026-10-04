import type { PropsWithChildren } from "react";
import { type BlockLabels, blockLabels } from "../shared/labels";

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

type ComponentProps = Parameters<typeof Collapsible>[0];

/** Public component for the collapsible (called by `@monti-cms/core/render`). */
export default ({ locale }: { locale?: string }) => {
	const labels = blockLabels(locale);
	return { Collapsible: (props: ComponentProps) => <Collapsible {...props} labels={labels} /> };
};
