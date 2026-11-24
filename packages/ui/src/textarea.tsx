"use client";

import * as React from "react";
import { cn } from "./cn";
import { FIELD_ACTION, FIELD_ACTION_BUTTON, FIELD_HOVER, FIELD_INSET } from "./hover";
import { IconButtonContext } from "./icon-button";
import { useProposalDescription } from "./proposal-cue";

/**
 * Several lines, drawn like `Input`: an underline, never a box. `proposal` marks text the assistant wrote and nobody has touched. `action` is a
 * control at the end of the first line (a button that makes the text again from the body); the underline then runs under it too. `rows` is the
 * fewest lines it shows: it grows with its text past them.
 */
function Textarea({
	className,
	size = "default",
	mono = false,
	proposal = false,
	tall = false,
	action,
	rows,
	clamp,
	style,
	...props
}: React.ComponentProps<"textarea"> & {
	/** `sm` writes at the note size, for compact panels; `default` at the reading size on a phone and body size above. */
	size?: "sm" | "md" | "default";
	/** Fixed-width letters for code and source text. */
	mono?: boolean;
	/** The assistant wrote this text and nobody has touched it yet. Turn it off when the text is edited. */
	proposal?: boolean;
	/** Two lines high (52px) while it is empty or short, then it grows: the help text of a field. */
	tall?: boolean;
	/** A control at the end of the first line. */
	action?: React.ReactNode;
	/**
	 * 쉴 때 보이는 줄의 수: 글이 더 길면 그 줄까지만 보이고 마지막 줄 끝이 "…"로 잘린다. 포커스가 오면(누르면) 다 펼쳐진다
	 * (속성 패널의 긴 요약, 시안 v5 `panel-extreme.html`, 2026-11-24).
	 */
	clamp?: number;
}) {
	const [text, setText] = React.useState(String(props.value ?? props.defaultValue ?? ""));
	const shown = props.value === undefined ? text : String(props.value);
	const sizeText =
		size === "sm"
			? "text-monti-note"
			: size === "md"
				? "text-monti-reading md:text-monti-body"
				: "text-monti-reading md:text-monti-prose";
	// 쉴 때 높이: 줄 `clamp`개와 위아래 여백, 밑줄 1px(아래 크기별 여백과 같다).
	const clampPad = size === "sm" ? 7 : size === "md" ? 12 : 9;
	const textarea = (
		<textarea
			data-slot="textarea"
			data-size={size}
			data-proposal={proposal || undefined}
			aria-description={useProposalDescription(proposal)}
			className={cn(
				cn(
					!action && !props.readOnly && FIELD_HOVER,
					// A read-only one is a value to read, as `Input readOnly`: nothing to type, so no tint and the rule stays as it is with the focus.
					!props.readOnly && "focus-visible:border-monti-contrast",
					"field-sizing-content flex w-full resize-none rounded-none border-0 border-transparent border-b bg-transparent text-monti-default outline-none transition-colors placeholder:text-monti-faint disabled:pointer-events-none disabled:cursor-default disabled:opacity-45 aria-invalid:border-monti-danger data-proposal:border-monti-proposal data-proposal:border-b-[1.5px] data-proposal:text-monti-proposal",
					!action && FIELD_INSET,
				),
				// The design system's textarea sets lines 1.6 times its size; the type role's own line height comes first, so the rule follows it.
				// One line stands as high as an `Input` of its size (28px small, 32px otherwise); more lines grow it downward.
				size === "sm"
					? "min-h-monti-control-sm py-[3px] text-monti-note"
					: size === "md"
						? // 패널의 값(속성 패널): 입력 칸 `md`와 같은 14/20 글자, 한 줄이 32px(위아래 5.5와 밑줄 1: 글자가 `Input`의 글자와 같은 높이에 선다).
							"min-h-monti-control-md py-[5.5px] text-monti-reading md:text-monti-body"
						: "min-h-monti-control-md py-monti-4 text-monti-reading md:text-monti-prose",
				// What is typed is a value, in mono; the placeholder is words, and stays in the sans face (tokens.md).
				mono && "font-mono placeholder:font-sans",
				tall && "min-h-[52px]",
				// 잘린 동안 글자는 위에 겹친 잘린 글(…)이 보이고, 칸은 그 줄 수만큼의 높이를 넘지 않는다.
				clamp &&
					"max-h-(--textarea-clamp) overflow-hidden text-transparent focus:max-h-none focus:overflow-y-auto focus:text-monti-default data-proposal:focus:text-monti-proposal",
				// With an action the line around it draws the rule, so the box keeps the height less that 1px.
				action &&
					cn(
						"min-w-0 flex-1 border-b-0 data-proposal:border-b-0",
						size === "sm"
							? "min-h-[calc(var(--monti-height-control-sm)-1px)]"
							: size === "md"
								? "min-h-[calc(var(--monti-height-control-md)-1px)]"
								: "min-h-[calc(var(--monti-height-control-md)-1px)]",
					),
				className,
			)}
			rows={rows}
			// The box grows with its text (`field-sizing`), so `rows` alone sets no height: it holds that many lines of 1.6 and its padding.
			style={
				{
					...(rows === undefined
						? {}
						: {
								minHeight: `max(calc(var(--monti-height-control-${size === "sm" ? "sm" : size === "md" ? "md" : "lg"}) - ${action ? 1 : 0}px), calc(${rows} * 1.6em + ${size === "sm" ? 7 : size === "md" ? 9 : 13}px))`,
							}),
					...(clamp ? { "--textarea-clamp": `calc(${clamp}lh + ${clampPad}px)` } : {}),
					...style,
				} as React.CSSProperties
			}
			{...props}
			onChange={(event) => {
				setText(event.currentTarget.value);
				props.onChange?.(event);
			}}
		/>
	);
	const clamped = clamp ? (
		<div data-slot="textarea-clamp" className="group/clamp relative w-full min-w-0">
			{textarea}
			{/* 쉴 때만 보이는 잘린 글: 칸의 글자와 같은 자리 · 크기로 겹치고, 포커스가 오면 사라져 칸의 글이 다 보인다. */}
			<div
				aria-hidden
				className={cn(
					"pointer-events-none absolute inset-x-0 top-0 text-monti-default group-focus-within/clamp:invisible",
					FIELD_INSET,
					sizeText,
					size === "sm" ? "py-[3px]" : size === "md" ? "py-[5.5px]" : "py-monti-4",
					mono && "font-mono",
					props.disabled && "opacity-45",
				)}
			>
				{/* 자르는 상자에는 여백이 없다: 여백이 있으면 잘린 뒤의 줄이 그 여백에 비친다. */}
				<div
					className="overflow-hidden"
					style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: clamp }}
				>
					{shown}
				</div>
			</div>
		</div>
	) : (
		textarea
	);
	if (!action) return clamped;
	return (
		<div
			data-slot="textarea-line"
			className={cn(
				cn(
					FIELD_HOVER,
					"flex w-full min-w-0 border-transparent border-b transition-colors focus-within:border-monti-contrast has-[[aria-invalid=true]]:border-monti-danger has-data-proposal:border-monti-proposal has-data-proposal:border-b-[1.5px]",
					FIELD_INSET,
				),
				"items-start",
			)}
		>
			{clamped}
			{/* A 32px button over a 28px or 32px line reaches past it above and below, as at a small `Input`, and does not grow the line. */}
			<span className={cn(FIELD_ACTION, "mt-monti-4")}>
				<IconButtonContext value={FIELD_ACTION_BUTTON[size === "sm" ? "sm" : "md"]}>{action}</IconButtonContext>
			</span>
		</div>
	);
}

export { Textarea };
