import type { DocumentComponentsContext, LooseDocumentComponents, MarkBlockProps } from "@monti-cms/core/render";
import type { PropsWithChildren } from "react";
import { cleanTextColor, textColorProps } from "./colors";
import type { colorBlock } from "./definition";

/** Text color and text background color (`:color[text]{fg bg …}`). Non-hex values are dropped, and with no color only the text is rendered. */
export function Color({ children, ...attrs }: PropsWithChildren<Record<string, unknown>>) {
	const { className, style, ...data } = textColorProps(cleanTextColor(attrs));
	return (
		<span className={className} style={style} {...data}>
			{children}
		</span>
	);
}

/** Public components for text color in the JSON renderer (`renderDocument`): the mark `color`. */
export const documentComponents = (_context: DocumentComponentsContext): LooseDocumentComponents => ({
	marks: {
		color: ({ children, ctx: _ctx, ...attrs }: MarkBlockProps<typeof colorBlock>) => (
			<Color {...attrs}>{children}</Color>
		),
	},
});
