"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";
import { cn } from "../lib/utils";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/**
 * 아이콘만 있는 버튼. `label`이 스크린 리더 이름이자 마우스를 올리면 뜨는 설명이다(둘이 늘 같다).
 * `pressed`를 주면 켜고 끄는 버튼이 되어 켜진 동안 배경이 깔린다.
 * 메뉴·팝오버를 여는 버튼이면 `trigger`로 감싼다: `trigger={(button) => <PopoverTrigger render={button} />}`.
 */
export function IconButton({
	label,
	pressed,
	destructive,
	side = "top",
	size = "icon-sm",
	variant = "ghost",
	className,
	trigger,
	children,
	...props
}: Omit<ComponentProps<typeof Button>, "aria-label" | "aria-pressed" | "children"> & {
	label: string;
	pressed?: boolean;
	destructive?: boolean;
	side?: "top" | "bottom" | "left" | "right";
	trigger?: (button: ReactElement) => ReactElement;
	children: ReactNode;
}) {
	const button = (
		<Button
			type="button"
			variant={variant}
			size={size}
			aria-label={label}
			aria-pressed={pressed}
			className={cn(
				"aria-pressed:bg-cms-accent aria-pressed:text-cms-accent-foreground",
				destructive && "text-cms-destructive hover:bg-cms-destructive/10 hover:text-cms-destructive",
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
