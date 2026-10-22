"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

function Tabs({ className, orientation = "horizontal", ...props }: TabsPrimitive.Root.Props) {
	return (
		<TabsPrimitive.Root
			data-slot="tabs"
			data-orientation={orientation}
			className={cn("group/tabs flex gap-2 data-[orientation=horizontal]:flex-col", className)}
			{...props}
		/>
	);
}

const tabsListVariants = cva(
	"group/tabs-list inline-flex w-fit items-center justify-center rounded-md p-[3px] text-monti-muted group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
	{
		variants: {
			variant: {
				default: "bg-monti-neutral",
				line: "gap-1 bg-transparent",
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
				"relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border border-transparent px-2 py-1 monti-dark:text-monti-muted text-monti-label text-monti-muted transition-all hover:text-monti-default monti-dark:hover:text-monti-default focus-visible:border-monti-focus focus-visible:outline-1 focus-visible:outline-monti-focus focus-visible:ring-[3px] focus-visible:ring-monti-focus-soft disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
				"group-data-[variant=line]/tabs-list:bg-transparent monti-dark:group-data-[variant=line]/tabs-list:data-active:border-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent monti-dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
				"monti-dark:data-active:border-monti-default data-active:bg-monti-page data-active:text-monti-default monti-dark:data-active:text-monti-default",
				"after:absolute after:bg-monti-accent-emphasis after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
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
function LineTabs({ className, ...props }: Omit<TabsPrimitive.List.Props, "variant">) {
	return (
		<TabsList
			variant="line"
			className={cn("h-10 w-full shrink-0 justify-start gap-4 border-b", className)}
			{...props}
		/>
	);
}

/** The line tabs that sit at the top of a page or a screen's main area. */
function PageTabs({ className, ...props }: Omit<TabsPrimitive.List.Props, "variant">) {
	return <LineTabs className={cn("px-4", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent, LineTabs, PageTabs, tabsListVariants };
