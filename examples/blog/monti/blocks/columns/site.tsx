import type { BlockProps } from "@monti-cms/core/render";
import type { CSSProperties, ReactNode } from "react";
import { columnsGridTemplate, parseColumnWidths } from "./layout";
import { style } from "./style";

/** Columns: side by side by `widths` (equal when it is not there or does not fit), stacked on a narrow screen. */
function ColumnsDrawing({ block, attrs, children }: BlockProps & { children?: ReactNode }) {
	const count = (block.children ?? []).filter((child) => child.type === "column").length;
	const style = {
		"--monti-columns": columnsGridTemplate(parseColumnWidths(attrs.widths, count), count),
	} as CSSProperties;
	return (
		<div className="monti-block-columns" style={style}>
			{children}
		</div>
	);
}

/** One column: one element, so each block in it is not a cell of its own. */
function ColumnDrawing({ children }: BlockProps & { children?: ReactNode }) {
	return <div className="monti-block-column">{children}</div>;
}

/** Columns with its look (`style.ts`): React puts it into the page once, however many of the block there are. */
export function Columns(props: Parameters<typeof ColumnsDrawing>[0]) {
	return (
		<>
			<style href="monti-block-columns" precedence="monti-blocks">
				{style}
			</style>
			<ColumnsDrawing {...props} />
		</>
	);
}

/** Column with its look (`style.ts`): React puts it into the page once, however many of the block there are. */
export function Column(props: Parameters<typeof ColumnDrawing>[0]) {
	return (
		<>
			<style href="monti-block-columns" precedence="monti-blocks">
				{style}
			</style>
			<ColumnDrawing {...props} />
		</>
	);
}
