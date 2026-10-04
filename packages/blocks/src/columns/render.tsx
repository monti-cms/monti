import { Children, type CSSProperties, isValidElement, type PropsWithChildren } from "react";
import { columnsGridTemplate, parseColumnWidths } from "./layout";

/** 단 나누기. 좁은 화면에서는 위아래로 쌓고, 넓은 화면에서는 `widths` 비율(없으면 똑같이)로 나란히 놓는다. */
export function Columns({ widths, children }: PropsWithChildren<{ widths?: string }>) {
	const count = Children.toArray(children).filter(isValidElement).length;
	const style = { "--cms-columns": columnsGridTemplate(parseColumnWidths(widths, count), count) } as CSSProperties;
	return (
		<div className="cms-block-columns" style={style}>
			{children}
		</div>
	);
}

/** 한 단. 조각(fragment)이 아니라 요소 하나라 단 안의 문단마다 따로 칸이 되지 않는다. */
export function Column({ children }: PropsWithChildren) {
	return <div className="cms-block-column">{children}</div>;
}

/** 단 나누기의 공개 컴포넌트(`@monti-cms/core/render`가 부른다). */
export default () => ({ Columns, Column });
