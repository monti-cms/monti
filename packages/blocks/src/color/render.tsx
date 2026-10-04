import type { PropsWithChildren } from "react";
import { cleanTextColor, textColorProps } from "./colors";

/** 글자색·글자 배경색(`:color[글]{fg bg …}`). 헥스가 아닌 값은 버리고, 색이 없으면 글만 그린다. */
export function Color({ children, ...attrs }: PropsWithChildren<Record<string, unknown>>) {
	const { className, style, ...data } = textColorProps(cleanTextColor(attrs));
	return (
		<span className={className} style={style} {...data}>
			{children}
		</span>
	);
}

/** 글자색의 공개 컴포넌트(`@monti-cms/core/render`가 부른다). 색은 `styles.css`의 `.cms-color`가 테마에 맞춰 고른다. */
export default () => ({ Color });
