import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../lib/utils";

/**
 * 관리자 화면 알림 상자. `default`는 안내, `danger`는 불러오기 실패 같은 오류다.
 * 본문 블록(콜아웃 등)의 모양은 각 블록이 따로 정한다.
 */
export const alertVariants = cva(
	[
		"relative w-full rounded-lg border px-4 py-3 text-sm",
		"[&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
	].join(" "),
	{
		variants: {
			layout: {
				grid: "grid grid-cols-[calc(var(--spacing)*4)_1fr] gap-x-3 gap-y-1 items-start",
				stack: "block",
			},
			variant: {
				default: "border-cms-border bg-cms-card text-cms-card-foreground",
				danger: [
					"bg-red-50 text-red-900 border-red-200 [&>svg]:text-red-700",
					"cms-dark:bg-red-400/25 cms-dark:text-red-50 cms-dark:border-red-300/70 cms-dark:[&>svg]:text-red-100",
				].join(" "),
			},
		},
		defaultVariants: {
			layout: "grid",
			variant: "default",
		},
	},
);

function Alert({
	className,
	layout,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div data-slot="alert" role="alert" className={cn(alertVariants({ layout, variant }), className)} {...props} />
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-title"
			className={cn("col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight", className)}
			{...props}
		/>
	);
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-description"
			className={cn(
				"col-start-2 grid justify-items-start gap-1 text-cms-muted-foreground text-sm [&_p]:leading-relaxed",
				className,
			)}
			{...props}
		/>
	);
}

export { Alert, AlertTitle, AlertDescription };
