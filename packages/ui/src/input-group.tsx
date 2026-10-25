"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { Input } from "./input";
import { Textarea } from "./textarea";

function InputGroup({
	className,
	size = "default",
	...props
}: React.ComponentProps<"div"> & { size?: "sm" | "default" }) {
	return (
		<div
			data-slot="input-group"
			role="group"
			className={cn(
				"group/input-group relative flex w-full min-w-0 items-center rounded-md border border-monti-default bg-monti-surface shadow-monti-control outline-none transition-[color,border-color,box-shadow] in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 hover:border-monti-emphasis has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-start]]:h-auto has-[>textarea]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:flex-col has-[[data-slot=input-group-control]:focus-visible]:border-monti-focus has-[[data-slot][aria-invalid=true]]:border-monti-danger has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-monti-focus-soft has-[[data-slot][aria-invalid=true]]:ring-3 has-[[data-slot][aria-invalid=true]]:ring-monti-danger monti-dark:has-[[data-slot][aria-invalid=true]]:ring-monti-danger has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-start]]:[&>input]:pl-1.5",
				size === "sm" ? "h-control-sm" : "h-control",
				className,
			)}
			{...props}
		/>
	);
}

const inputGroupAddonVariants = cva(
	"flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-monti-label text-monti-muted select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-sm [&>svg:not([class*='size-'])]:size-4",
	{
		variants: {
			align: {
				"inline-start": "order-first pl-2 has-[>button]:pl-[3px] has-[>kbd]:ml-[-0.15rem]",
				"inline-end": "order-last pr-2 has-[>button]:pr-[3px] has-[>kbd]:mr-[-0.15rem]",
				"block-start":
					"order-first w-full justify-start px-2.5 pt-2 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2",
				"block-end": "order-last w-full justify-start px-2.5 pb-2 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2",
			},
		},
		defaultVariants: {
			align: "inline-start",
		},
	},
);

function InputGroupAddon({
	className,
	align = "inline-start",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
	return (
		<div
			role="group"
			data-slot="input-group-addon"
			data-align={align}
			className={cn(inputGroupAddonVariants({ align }), className)}
			onClick={(e) => {
				if ((e.target as HTMLElement).closest("button")) {
					return;
				}
				e.currentTarget.parentElement?.querySelector("input")?.focus();
			}}
			{...props}
		/>
	);
}

/**
 * A button inside the field: always shorter than the 36px field, so it sits inset with the same 4px gap above, below and at the end
 * (the addon's end padding). `xs` 24px for an icon-sized action, `sm` 28px for a word like "Search".
 */
const inputGroupButtonVariants = cva("flex items-center gap-2 text-monti-label shadow-none", {
	variants: {
		size: {
			xs: "h-6 gap-1 rounded-sm px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
			sm: "h-7 gap-1.5 rounded-md px-2.5 [&>svg:not([class*='size-'])]:size-4",
			"icon-xs": "size-6 rounded-sm p-0 has-[>svg]:p-0",
			"icon-sm": "size-7 rounded-md p-0 has-[>svg]:p-0",
		},
	},
	defaultVariants: {
		size: "xs",
	},
});

function InputGroupButton({
	className,
	type = "button",
	variant = "ghost",
	size = "xs",
	...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "type"> &
	VariantProps<typeof inputGroupButtonVariants> & {
		type?: "button" | "submit" | "reset";
	}) {
	return (
		<Button
			type={type}
			data-size={size}
			variant={variant}
			className={cn(inputGroupButtonVariants({ size }), className)}
			{...props}
		/>
	);
}

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"flex items-center gap-2 text-monti-body text-monti-muted [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
				className,
			)}
			{...props}
		/>
	);
}

function InputGroupInput({ className, ...props }: React.ComponentProps<typeof Input>) {
	return (
		<Input
			data-slot="input-group-control"
			className={cn(
				"flex-1 rounded-none border-0 bg-transparent monti-dark:bg-transparent shadow-none ring-0 focus-visible:ring-0 aria-invalid:ring-0",
				// Effectively stops background color changes, so the autofill background does not paint only the inner input and clash with the group's border and buttons
				// (the input stays transparent and shows the group background). Text color also uses the theme color.
				"autofill:[-webkit-text-fill-color:var(--monti-fg-default)] autofill:[transition:background-color_100000s_ease-in-out_0s]",
				className,
			)}
			{...props}
		/>
	);
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<Textarea
			data-slot="input-group-control"
			className={cn(
				"flex-1 resize-none rounded-none border-0 bg-transparent monti-dark:bg-transparent py-2 shadow-none ring-0 focus-visible:ring-0 aria-invalid:ring-0",
				className,
			)}
			{...props}
		/>
	);
}

export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupInput, InputGroupTextarea };
