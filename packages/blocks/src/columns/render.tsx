import { Children, type CSSProperties, isValidElement, type PropsWithChildren } from "react";
import { columnsGridTemplate, parseColumnWidths } from "./layout";

/** Columns. Stacked vertically on narrow screens, and side by side on wide screens using the `widths` ratios (equal if absent). */
export function Columns({ widths, children }: PropsWithChildren<{ widths?: string }>) {
	const count = Children.toArray(children).filter(isValidElement).length;
	const style = { "--cms-columns": columnsGridTemplate(parseColumnWidths(widths, count), count) } as CSSProperties;
	return (
		<div className="cms-block-columns" style={style}>
			{children}
		</div>
	);
}

/** One column. It is a single element rather than a fragment, so each paragraph inside does not become its own cell. */
export function Column({ children }: PropsWithChildren) {
	return <div className="cms-block-column">{children}</div>;
}

/** Public component for columns (called by `@monti-cms/core/render`). */
export default () => ({ Columns, Column });
