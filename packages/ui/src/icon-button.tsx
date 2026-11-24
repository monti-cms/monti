"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import {
	type CSSProperties,
	createContext,
	isValidElement,
	type ReactElement,
	type ReactNode,
	useContext,
} from "react";
import { cn } from "./cn";
import { ChevronDown, Close, OverflowMenuHorizontal, Spark } from "./icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/** The look of a round icon button, for parts that render their own button (a combobox's open and clear buttons). */
export const ICON_BUTTON =
	"inline-flex size-monti-control-md shrink-0 items-center justify-center rounded-monti-full in-data-[shape=square]:rounded-monti-md border-0 bg-transparent p-0 text-monti-muted outline-none transition-colors not-disabled:hover:bg-monti-selected not-disabled:hover:text-monti-default not-disabled:active:bg-monti-current focus-visible:ring-2 focus-visible:ring-monti-contrast/60 cursor-pointer disabled:pointer-events-none disabled:opacity-45 aria-expanded:bg-monti-selected aria-expanded:text-monti-default aria-pressed:bg-monti-selected aria-pressed:text-monti-default monti-dark:aria-pressed:not-focus-visible:ring-1 monti-dark:aria-pressed:not-focus-visible:ring-inset monti-dark:aria-pressed:not-focus-visible:ring-monti-emphasis data-[tone=quiet]:text-monti-faint data-[tone=proposal]:text-monti-proposal data-[tone=proposal]:not-disabled:hover:text-monti-proposal data-[tone=danger]:text-monti-danger data-[tone=danger]:not-disabled:hover:bg-monti-danger-muted data-[tone=danger]:not-disabled:hover:text-monti-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

/** The black round icon button: its ground stays black, a step lighter under the pointer and while pressed, and it dims when off. */
const ICON_BUTTON_PRIMARY =
	"bg-monti-emphasis text-monti-on-emphasis not-disabled:hover:bg-monti-emphasis/90 not-disabled:hover:text-monti-on-emphasis not-disabled:active:bg-monti-emphasis/80 disabled:opacity-45";

/**
 * What a part that holds icon buttons it does not draw tells them: their size and tone (a field's end control is one size under the field; a message's
 * actions are small and quiet). A button's own prop wins.
 */
export const IconButtonContext = createContext<{
	size?: "md" | "sm" | "xs";
	tone?: "danger" | "quiet" | "proposal";
	edge?: "end";
}>({});

/**
 * 끝에 서는 아이콘의 잉크가 상자 끝에서 얼마나 안에서 끝나는지, 아이콘 크기에 대한 비율(그 모양의 경로 끝에서 잰 값: ✦ 2.25/24, ⋯ 6/32, × 8/32, 갈매기
 * 3/16). 여기 없는 아이콘은 상자 끝을 끝선에 둔다.
 */
const GLYPH_END_INSET = new Map<unknown, number>([
	[Spark, 2.25 / 24],
	[OverflowMenuHorizontal, 6 / 32],
	[Close, 8 / 32],
	[ChevronDown, 3 / 16],
]);

/** 크기별 상자와 그 안의 아이콘(px). */
const BOX = { md: [32, 16], sm: [28, 16], xs: [24, 14] } as const;

/**
 * `edge="end"`인 버튼이 끝선 밖으로 내미는 폭: 상자의 안쪽 여백과 아이콘 안의 빈 곳. 이만큼 내밀면 보이는 아이콘의 끝이 그 줄의 끝선(선과 버튼 상자의 끝)에
 * 선다. 누르는 자리는 그대로 상자 전체다.
 */
export function glyphEndPull(size: keyof typeof BOX, icon: ReactNode): number {
	const [box, glyph] = BOX[size];
	const inset = isValidElement(icon) ? (GLYPH_END_INSET.get(icon.type) ?? 0) : 0;
	// 반 픽셀로 맞춘다: 그 사이에 서면 브라우저가 아이콘을 화면 픽셀에 붙이며 끝이 반 픽셀 넘어간다(24px ⋯의 7.625 → 7.5).
	return Math.round(((box - glyph) / 2 + glyph * inset) * 2) / 2;
}

/**
 * A round icon button, 32px (round on the page ground, `radius-md` inside a square surface, `radius-sm` at `xs`, the size that sits inside a field or a row): the header's more (⋯), properties and assistant, a panel's close. `label` is both the screen reader name and the
 * tooltip shown on hover (the two are always the same). With `pressed` it is a toggle and keeps the selected ground while on (in dark also a 1px inset line, so the on state reads). `tone="danger"` is for
 * a button that deletes or removes something: the icon is red and its hover background the red wash. `tone="quiet"` is the faint ink until pointed at,
 * for small buttons beside words that should not compete with them (a message's actions, a queued message).
 * For a button that opens a menu or popover, wrap it with `trigger`: `trigger={(button) => <PopoverTrigger render={button} />}`.
 * `variant="primary"` is the black round one that sends (the assistant's box, a note's reply), one per surface like the black pill; `size="sm"`
 * is 28px.
 *
 * `edge="end"`(또는 {@link IconButtonContext}의 같은 값)는 페이지에서 줄을 끝내는 버튼(머리 줄의 ✦, 행의 ⋯, 패널의 ×)이다: 상자가 안쪽 여백과 아이콘 안의
 * 빈 곳만큼 그 줄의 끝선 밖으로 나가, 보이는 아이콘의 끝이 선과 다른 상자들이 끝나는 선에 선다(소유자 결정, 2026-11-24). 누르는 자리는 같은 상자다.
 */
export function IconButton({
	label,
	pressed,
	tone: ownTone,
	variant = "ghost",
	size: ownSize,
	side = "top",
	className,
	trigger,
	children,
	type = "button",
	edge: ownEdge,
	style,
	...props
}: Omit<ButtonPrimitive.Props, "aria-label" | "aria-pressed" | "children" | "style"> & {
	label: string;
	pressed?: boolean;
	/**
	 * `danger` for a button that deletes or removes something; `quiet` for faint ink until pointed at; `proposal` for the assistant's ✦ that fills a
	 * field (blue, the color the assistant alone uses).
	 */
	tone?: "danger" | "quiet" | "proposal";
	/** `ghost` (no ground until pointed at) or `primary` (black, the one action that sends). */
	variant?: "ghost" | "primary";
	/** `md` 32px, `sm` 28px, `xs` 24px. */
	size?: "md" | "sm" | "xs";
	side?: "top" | "bottom" | "left" | "right";
	trigger?: (button: ReactElement) => ReactElement;
	/** `end`: 줄을 끝내는 버튼. 상자가 아니라 보이는 아이콘의 끝이 줄의 끝선에 선다. */
	edge?: "end";
	style?: CSSProperties;
	children: ReactNode;
}) {
	const outer = useContext(IconButtonContext);
	const size = ownSize ?? outer.size ?? "md";
	const tone = ownTone ?? outer.tone;
	const edge = ownEdge ?? outer.edge;
	const button = (
		<ButtonPrimitive
			data-slot="icon-button"
			type={type}
			aria-label={label}
			aria-pressed={pressed}
			data-tone={tone}
			data-variant={variant}
			data-edge={edge}
			// 끝선 밖으로 내미는 폭(`glyphEndPull`): 표의 끝 칸처럼 버튼을 직접 그리지 않는 부품도 `data-edge` 없이 이 값을 읽는다.
			style={{ "--monti-glyph-pull": `${glyphEndPull(size, children)}px`, ...style } as CSSProperties}
			className={cn(
				ICON_BUTTON,
				variant === "primary" && ICON_BUTTON_PRIMARY,
				size === "sm" && "size-monti-control-sm",
				size === "xs" &&
					"size-monti-control-xs in-data-[shape=square]:rounded-monti-sm rounded-monti-sm [&_svg:not([class*='size-'])]:size-3.5",
				"data-[edge=end]:-me-(--monti-glyph-pull)",
				className,
			)}
			{...props}
		/>
	);
	return (
		<Tooltip>
			<TooltipTrigger render={trigger ? trigger(button) : button}>{children}</TooltipTrigger>
			<TooltipContent side={side}>{label}</TooltipContent>
		</Tooltip>
	);
}
