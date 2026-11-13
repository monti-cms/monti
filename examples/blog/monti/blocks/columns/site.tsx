import type { BlockProps } from "@monti-cms/core/render";
import type { CSSProperties, ReactNode } from "react";
import { columnsGridTemplate, parseColumnWidths } from "./layout";

/** Columns: side by side by `widths` (equal when it is not there or does not fit), stacked on a narrow screen. */
export function Columns({ block, attrs, children }: BlockProps & { children?: ReactNode }) {
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
export function Column({ children }: BlockProps & { children?: ReactNode }) {
	return <div className="monti-block-column">{children}</div>;
}
