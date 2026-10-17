import { type BlockProps, defineRender } from "@monti-cms/core/render";
import { Children, type CSSProperties, isValidElement, type PropsWithChildren } from "react";
import type { columnBlock, columnsBlock } from "./definition";
import { columnsGridTemplate, parseColumnWidths } from "./layout";

/** Columns. Stacked vertically on narrow screens, and side by side on wide screens using the `widths` ratios (equal if absent). */
export function Columns({ widths, children, count }: PropsWithChildren<{ widths?: string; count?: number }>) {
	const columns = count ?? Children.toArray(children).filter(isValidElement).length;
	const style = {
		"--monti-columns": columnsGridTemplate(parseColumnWidths(widths, columns), columns),
	} as CSSProperties;
	return (
		<div className="monti-block-columns" style={style}>
			{children}
		</div>
	);
}

/** One column. It is a single element rather than a fragment, so each paragraph inside does not become its own cell. */
export function Column({ children }: PropsWithChildren) {
	return <div className="monti-block-column">{children}</div>;
}

/** Public components for columns in the JSON renderer (`renderDocument`): the blocks `columns` and `column`. The columns are counted from the stored `column` nodes. */
export default defineRender({
	blocks: {
		columns: ({ widths, items, children }: BlockProps<typeof columnsBlock>) => (
			<Columns widths={widths} count={items.filter((item) => item.node.type === "column").length}>
				{children}
			</Columns>
		),
		column: ({ children }: BlockProps<typeof columnBlock>) => <Column>{children}</Column>,
	},
});
