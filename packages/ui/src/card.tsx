import type * as React from "react";
import { cn } from "./cn";
import { type LayoutProps, layoutVariants, splitLayout } from "./layout";

function Card({ className, size = "default", ...props }: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
	return (
		<div
			data-slot="card"
			data-size={size}
			className={cn(
				"group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-monti-lg border border-monti-muted bg-monti-page py-(--card-spacing) text-monti-body text-monti-default [--card-spacing:--spacing(6)] has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(4)] *:[img:first-child]:rounded-t-monti-lg *:[img:last-child]:rounded-b-monti-lg",
				className,
			)}
			{...props}
		/>
	);
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-header"
			className={cn(
				"group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-monti-lg px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
				className,
			)}
			{...props}
		/>
	);
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="card-title" className={cn("text-monti-title", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="card-description" className={cn("text-monti-body text-monti-muted", className)} {...props} />;
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-action"
			className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
			{...props}
		/>
	);
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div data-slot="card-content" className={cn("flex flex-col gap-3 px-(--card-spacing)", className)} {...props} />
	);
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-footer"
			className={cn(
				"flex items-center rounded-b-monti-lg px-(--card-spacing) [.border-t]:pt-(--card-spacing)",
				className,
			)}
			{...props}
		/>
	);
}

/** The plain bordered surface for a section of a screen: a list, a form group, a table. Lay out its content yourself; `Card` is for titled cards. */
/** A resting surface: a card with a hairline border. Takes the layout options (padding, overflow, size) of `Box`. */
function Panel({ className, ...props }: React.ComponentProps<"div"> & LayoutProps) {
	const [layout, rest] = splitLayout(props);
	return (
		<div
			data-slot="panel"
			className={cn(
				"rounded-monti-lg border border-monti-muted bg-monti-page text-monti-default",
				layoutVariants(layout),
				className,
			)}
			{...rest}
		/>
	);
}

export { Card, Panel, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
