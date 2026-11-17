import type { MarkProps } from "@monti-cms/core/render";
import type { ReactNode } from "react";
import { style } from "./style";

/** The colours by name, in the order the admin offers them. Each name's light and dark shade is in `color.css`: change them there. */
export const COLORS = ["gray", "red", "orange", "yellow", "green", "blue", "purple", "pink"] as const;
const named = (value: unknown) => COLORS.find((color) => color === value);

/** Coloured words (`:color[words]{color="red" background="yellow"}`): the colour by its name, so a theme or a dark page changes every one at once. */
function ColorMarkDrawing({ mark, children }: MarkProps & { children?: ReactNode }) {
	const color = named(mark.color);
	const background = named(mark.background);
	if (!color && !background) return <>{children}</>;
	return (
		<span className="monti-color" data-color={color} data-background={background}>
			{children}
		</span>
	);
}

/** ColorMark with its look (`style.ts`): React puts it into the page once, however many of the block there are. */
export function ColorMark(props: Parameters<typeof ColorMarkDrawing>[0]) {
	return (
		<>
			<style href="monti-block-color" precedence="monti-blocks">
				{style}
			</style>
			<ColorMarkDrawing {...props} />
		</>
	);
}
