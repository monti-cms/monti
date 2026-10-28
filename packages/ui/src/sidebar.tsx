"use client";

import { Dialog as DrawerPrimitive } from "@base-ui/react/dialog";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { OpenPanelLeft } from "@carbon/icons-react";
import * as React from "react";
import { cn } from "./cn";
import { IconButton } from "./icon-button";
import { useUiLabels } from "./labels";
import { ResizeHandle, useResizableWidth } from "./resize-handle";
import { useIsMobile } from "./use-mobile";

/** Where the width starts (232px, the same as the `w-monti-sidebar` token, which a loading placeholder uses), and the limits the person can drag it between. */
const SIDEBAR_WIDTH_DEFAULT = 232;
const SIDEBAR_WIDTH_MIN = 200;
const SIDEBAR_WIDTH_MAX = 400;

type SidebarContextProps = {
	openMobile: boolean;
	setOpenMobile: (open: boolean) => void;
	isMobile: boolean;
	toggleSidebar: () => void;
	/** The desktop width, which the person can change by dragging the sidebar's edge. */
	resize: ReturnType<typeof useResizableWidth>;
};

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

function useSidebar() {
	const context = React.useContext(SidebarContext);
	if (!context) {
		throw new Error("useSidebar must be used within a SidebarProvider.");
	}

	return context;
}

function SidebarProvider({
	fixed = false,
	resizeKey = "sidebar",
	className,
	style,
	children,
	...props
}: React.ComponentProps<"div"> & {
	/** Names the remembered width of the sidebar (between 200px and 400px, 232px until it is dragged). */
	resizeKey?: string;
	/** The frame takes exactly the window and never scrolls, not even to bring a focused field into view; the panes inside scroll on their own (the admin's app frame). */
	fixed?: boolean;
}) {
	const isMobile = useIsMobile();
	const [openMobile, setOpenMobile] = React.useState(false);
	const resize = useResizableWidth({
		storageKey: resizeKey,
		defaultWidth: SIDEBAR_WIDTH_DEFAULT,
		min: SIDEBAR_WIDTH_MIN,
		max: SIDEBAR_WIDTH_MAX,
	});
	const toggleSidebar = React.useCallback(() => setOpenMobile((open) => !open), []);

	const contextValue = React.useMemo<SidebarContextProps>(
		() => ({ isMobile, openMobile, setOpenMobile, toggleSidebar, resize }),
		[isMobile, openMobile, toggleSidebar, resize],
	);

	return (
		<SidebarContext.Provider value={contextValue}>
			<div
				data-slot="sidebar-wrapper"
				// The width follows the pointer while it is dragged, and does not animate from the default to the remembered one on load.
				data-resizing={resize.resizing || !resize.settled ? "" : undefined}
				style={{ "--sidebar-width": `${resize.width}px`, ...style } as React.CSSProperties}
				className={cn("group/sidebar-wrapper flex min-h-svh w-full", fixed && "h-svh overflow-clip", className)}
				{...props}
			>
				{children}
			</div>
		</SidebarContext.Provider>
	);
}

/** The rail as the design draws it: the tool ground, 20px above, 14px at the sides, 16px below, rows 2px apart. */
const RAIL = "flex flex-col gap-monti-2 bg-monti-tool px-[14px] pt-monti-20 pb-monti-16 text-monti-default";

/**
 * The left navigation: a `nav` on the tool ground with a line down its right edge, a header with the site's name, the rows of the groups, and a
 * footer. It stays beside the page; the writer drags its edge to change the width. On a narrow screen it is a drawer that opens from the left over a
 * dimmed page (square, on the same ground, with a line on its open edge, like the sheet). `label` names it for screen readers.
 */
function Sidebar({
	label,
	className,
	children,
	dir,
	...props
}: React.ComponentProps<"div"> & {
	label: string;
}) {
	const labels = useUiLabels();
	const { isMobile, openMobile, setOpenMobile, resize } = useSidebar();
	const rows = (
		<nav aria-label={label} data-slot="sidebar-nav" className="flex min-h-0 flex-1 flex-col gap-monti-2">
			{children}
		</nav>
	);

	if (isMobile) {
		return (
			<DrawerPrimitive.Root open={openMobile} onOpenChange={setOpenMobile} {...props}>
				<DrawerPrimitive.Portal>
					<DrawerPrimitive.Backdrop className="fixed inset-0 z-50 bg-monti-backdrop transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
					<DrawerPrimitive.Popup
						dir={dir}
						data-sidebar="sidebar"
						data-slot="sidebar"
						data-mobile="true"
						className={cn(
							RAIL,
							"fixed inset-y-0 left-0 z-50 h-full w-monti-sidebar max-w-full border-monti-emphasis border-r outline-none transition duration-200 ease-in-out data-ending-style:-translate-x-10 data-starting-style:-translate-x-10 data-ending-style:opacity-0 data-starting-style:opacity-0",
						)}
					>
						<DrawerPrimitive.Title className="sr-only">{labels.sidebarTitle}</DrawerPrimitive.Title>
						<DrawerPrimitive.Description className="sr-only">{labels.sidebarDescription}</DrawerPrimitive.Description>
						{rows}
					</DrawerPrimitive.Popup>
				</DrawerPrimitive.Portal>
			</DrawerPrimitive.Root>
		);
	}

	return (
		<div
			data-slot="sidebar"
			className={cn(
				RAIL,
				"relative w-(--sidebar-width) shrink-0 self-stretch border-monti-default border-r",
				className,
			)}
			{...props}
		>
			{rows}
			<ResizeHandle
				value={resize.width}
				min={resize.min}
				max={resize.max}
				onChange={resize.setWidth}
				onReset={resize.reset}
				label={labels.sidebarResize}
				edge="end"
				resizing={resize.resizing}
			/>
		</div>
	);
}

function SidebarTrigger({
	className,
	onClick,
	...props
}: Omit<React.ComponentProps<typeof IconButton>, "label" | "children">) {
	const labels = useUiLabels();
	const { toggleSidebar } = useSidebar();

	return (
		<IconButton
			data-sidebar="trigger"
			data-slot="sidebar-trigger"
			label={labels.sidebarToggle}
			className={cn(className)}
			onClick={(event) => {
				onClick?.(event);
				toggleSidebar();
			}}
			{...props}
		>
			<OpenPanelLeft />
		</IconButton>
	);
}

/**
 * The page beside the rail. `corner` is what sits in its top-right corner, 12px from both edges (the assistant's button); the page's own header keeps
 * clear of it. On a narrow screen, where the rail is a drawer, a bar above the page holds the button that opens it, with the corner at its end.
 */
function SidebarInset({
	fixed = false,
	corner,
	className,
	children,
	...props
}: React.ComponentProps<"main"> & {
	/** Inside a `fixed` frame: the main area clips to the window, so its own panes scroll. */
	fixed?: boolean;
	corner?: React.ReactNode;
}) {
	const { isMobile } = useSidebar();
	return (
		<main
			data-slot="sidebar-inset"
			className={cn("relative flex w-full flex-1 flex-col bg-monti-page", fixed && "min-w-0 overflow-clip", className)}
			{...props}
		>
			{isMobile ? (
				<div className="flex h-monti-header shrink-0 items-center justify-between px-monti-12">
					<SidebarTrigger />
					{corner}
				</div>
			) : (
				corner && <div className="absolute top-monti-12 right-monti-12 z-4">{corner}</div>
			)}
			{children}
		</main>
	);
}

/** The site's name (and what sits beside it), 6px in from the rows' edge and 20px above them. */
function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-header"
			data-sidebar="header"
			className={cn("flex items-center gap-monti-12 px-monti-6 pb-monti-20", className)}
			{...props}
		/>
	);
}

/** The group at the bottom (trash, tools, settings): under a line, pushed to the end of the rail. */
function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-footer"
			data-sidebar="footer"
			className={cn("mt-auto flex flex-col gap-monti-2 border-monti-default border-t pt-monti-12", className)}
			{...props}
		/>
	);
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-content"
			data-sidebar="content"
			className={cn("no-scrollbar flex min-h-0 flex-1 flex-col gap-monti-2 overflow-auto", className)}
			{...props}
		/>
	);
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-group"
			data-sidebar="group"
			className={cn("relative flex w-full min-w-0 flex-col", className)}
			{...props}
		/>
	);
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-group-content"
			data-sidebar="group-content"
			className={cn("flex w-full flex-col gap-monti-2", className)}
			{...props}
		/>
	);
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
	return (
		<ul
			data-slot="sidebar-menu"
			data-sidebar="menu"
			className={cn("m-0 flex w-full min-w-0 list-none flex-col gap-monti-2 p-0", className)}
			{...props}
		/>
	);
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
	return (
		<li
			data-slot="sidebar-menu-item"
			data-sidebar="menu-item"
			className={cn("group/menu-item relative", className)}
			{...props}
		/>
	);
}

/**
 * One row of the rail: 36px, an icon, the name, and at the end a count ({@link SidebarMenuBadge}). The open one is on the selected ground and
 * semibold; there is no bar beside it. Pointing at any other row gives it the muted ground, which is paler than the selected one, so a row
 * that is only pointed at is never taken for the open one. `removed` is a row the writer took out in the schema (struck through and faint).
 * Put a `ChangeDot` after the name for an unsaved change; it sits 6px from it.
 */
function SidebarMenuButton({
	render,
	isActive = false,
	removed = false,
	className,
	...props
}: useRender.ComponentProps<"button"> &
	React.ComponentProps<"button"> & {
		isActive?: boolean;
		removed?: boolean;
	}) {
	return useRender({
		defaultTagName: "button",
		props: mergeProps<"button">(
			{
				className: cn(
					"peer/menu-button group/menu-button flex h-9 w-full min-w-0 items-center gap-monti-10 rounded-monti-md border-0 bg-transparent px-monti-10 text-left text-monti-body text-monti-default no-underline outline-none group-has-data-[sidebar=menu-action]/menu-item:pr-monti-32 hover:bg-monti-muted focus-visible:ring-3 focus-visible:ring-monti-contrast/20 disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 data-active:bg-monti-selected data-active:font-semibold data-removed:text-monti-faint data-removed:line-through [&>[data-slot=change-dot]]:-ml-monti-4 [&>span:not([data-slot])]:min-w-0 [&>span:not([data-slot])]:truncate [&_svg]:size-4 [&_svg]:shrink-0",
					className,
				),
			},
			props,
		),
		render,
		state: {
			slot: "sidebar-menu-button",
			sidebar: "menu-button",
			active: isActive,
			removed,
		},
	});
}

/** The count at the end of a row: mono, small and quiet, in the flow of the row, so a long name is cut before it. */
function SidebarMenuBadge({
	tone = "default",
	className,
	...props
}: React.ComponentProps<"span"> & {
	/** `warning` for a count that needs attention (failed deliveries). */
	tone?: "default" | "warning";
}) {
	return (
		<span
			data-slot="sidebar-menu-badge"
			data-sidebar="menu-badge"
			className={cn(
				"ml-auto shrink-0 select-none font-mono font-normal text-monti-meta tabular-nums group-data-removed/menu-button:text-monti-faint",
				tone === "warning" ? "text-monti-warning" : "text-monti-subtle",
				className,
			)}
			{...props}
		/>
	);
}

/** The folders under an open row: 36px in from the edge, 13px muted. Rows are {@link SidebarMenuSubButton}s. */
function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
	return (
		<ul
			data-slot="sidebar-menu-sub"
			data-sidebar="menu-sub"
			className={cn(
				"m-0 flex list-none flex-col pt-monti-2 pr-0 pb-monti-6 pl-9 text-monti-muted text-monti-note",
				className,
			)}
			{...props}
		/>
	);
}

const SUB_DEPTH = ["", "pl-[14px]", "pl-7", "pl-[42px]"] as const;

/**
 * A folder under a row: its name and, at the end, its count. The open one is ink and semibold. `depth` indents a folder inside another by 14px a
 * level; `dropTarget` is the ring while entries are dragged over it. A link by default; `render={<button type="button" />}` makes it a button.
 */
function SidebarMenuSubButton({
	render,
	isActive = false,
	depth = 0,
	dropTarget = false,
	className,
	...props
}: useRender.ComponentProps<"a"> &
	React.ComponentProps<"a"> & { isActive?: boolean; depth?: 0 | 1 | 2 | 3; dropTarget?: boolean }) {
	return useRender({
		defaultTagName: "a",
		props: mergeProps<"a">(
			{
				className: cn(
					"flex w-full cursor-pointer items-center justify-between gap-monti-8 border-0 bg-transparent py-[5px] pr-monti-10 text-left no-underline outline-none hover:text-monti-default focus-visible:rounded-monti-sm focus-visible:ring-3 focus-visible:ring-monti-contrast/20 data-active:font-semibold data-active:text-monti-default data-drop-target:rounded-monti-sm data-drop-target:ring-2 data-drop-target:ring-monti-contrast [&>span:not([data-slot])]:min-w-0 [&>span:not([data-slot])]:truncate",
					SUB_DEPTH[depth],
					className,
				),
			},
			props,
		),
		render,
		state: { slot: "sidebar-menu-sub-button", sidebar: "menu-sub-button", active: isActive, dropTarget },
	});
}

export {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarProvider,
	SidebarTrigger,
	useSidebar,
};
