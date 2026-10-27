"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

function Tabs({
	className,
	orientation = "horizontal",
	fill = false,
	...props
}: TabsPrimitive.Root.Props & {
	/** Takes the height left on the page, with no gap under the tab bar (a screen whose tabs are its sections). */
	fill?: boolean;
}) {
	return (
		<TabsPrimitive.Root
			data-slot="tabs"
			data-orientation={orientation}
			className={cn(
				"group/tabs flex data-[orientation=horizontal]:flex-col",
				fill ? "min-h-0 flex-1 gap-0" : "gap-2",
				className,
			)}
			{...props}
		/>
	);
}

const tabsListVariants = cva(
	"group/tabs-list inline-flex w-fit items-center justify-center rounded-monti-md p-[3px] text-monti-muted group-data-[orientation=horizontal]/tabs:h-monti-icon group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none data-[variant=line]:p-0",
	{
		variants: {
			variant: {
				default: "border border-monti-muted bg-monti-tool",
				line: "gap-4 bg-transparent",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function TabsList({
	className,
	variant = "default",
	...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			data-variant={variant}
			className={cn(tabsListVariants({ variant }), className)}
			{...props}
		/>
	);
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
	return (
		<TabsPrimitive.Tab
			data-slot="tabs-trigger"
			className={cn(
				"relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-monti-sm border border-transparent px-2 py-1 monti-dark:text-monti-muted text-monti-label text-monti-muted transition-all hover:text-monti-default monti-dark:hover:text-monti-default focus-visible:border-monti-contrast focus-visible:outline-1 focus-visible:outline-monti-contrast focus-visible:ring-[3px] focus-visible:ring-monti-contrast/20 disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-[orientation=vertical]/tabs:w-full group-data-[variant=line]/tabs-list:flex-none group-data-[orientation=vertical]/tabs:justify-start group-data-[variant=line]/tabs-list:px-0 group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				"group-data-[variant=line]/tabs-list:bg-transparent monti-dark:group-data-[variant=line]/tabs-list:data-active:border-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent monti-dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
				"data-active:border-monti-muted monti-dark:data-active:border-monti-default data-active:bg-monti-page data-active:font-medium data-active:text-monti-default monti-dark:data-active:text-monti-default",
				"after:absolute after:bg-monti-emphasis after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=horizontal]/tabs:after:bottom-[-1px] group-data-[orientation=horizontal]/tabs:after:h-[1.5px] group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
				className,
			)}
			{...props}
		/>
	);
}

function TabsContent({
	className,
	fill = false,
	scroll = false,
	...props
}: TabsPrimitive.Panel.Props & {
	/** Takes the height left under the tabs, as a column (a pane with its own list or editor). */
	fill?: boolean;
	/** Scrolls inside instead of growing the page. */
	scroll?: boolean;
}) {
	return (
		<TabsPrimitive.Panel
			data-slot="tabs-content"
			className={cn(
				"flex-1 text-monti-body outline-none",
				fill && "flex min-h-0 flex-col",
				scroll && "min-h-0 overflow-auto",
				className,
			)}
			{...props}
		/>
	);
}

/** A bar of line tabs under a header, edge to edge with a bottom border (inside a panel or a sheet). */
const TAB_INSET = { page: "px-monti-32", panel: "px-monti-24", none: "" } as const;

/**
 * The underline tab bar across a page or a panel: the one look for switching views (a screen's sections, a list's filters, a panel's parts).
 * `inset` lines its first tab up with the content's side padding. Works without panels too: a filter is a value and `onValueChange`.
 */
function PageTabs({
	className,
	inset = "page",
	...props
}: Omit<TabsPrimitive.List.Props, "variant"> & { inset?: keyof typeof TAB_INSET }) {
	return (
		<TabsList
			variant="line"
			className={cn("h-10 w-full shrink-0 justify-start gap-monti-16 border-b", TAB_INSET[inset], className)}
			{...props}
		/>
	);
}

/** The line tabs that sit at the top of a page or a screen's main area. */

export { Tabs, TabsList, TabsTrigger, TabsContent, PageTabs, tabsListVariants };
