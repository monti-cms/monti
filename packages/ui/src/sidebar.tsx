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

const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
/** Where the width starts (232px, the same as the `w-monti-sidebar` token, which a loading placeholder uses), and the limits the person can drag it between. */
const SIDEBAR_WIDTH_DEFAULT = 232;
const SIDEBAR_WIDTH_MIN = 200;
const SIDEBAR_WIDTH_MAX = 400;
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarContextProps = {
	state: "expanded" | "collapsed";
	open: boolean;
	setOpen: (open: boolean) => void;
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
	defaultOpen = true,
	open: openProp,
	onOpenChange: setOpenProp,
	fixed = false,
	resizeKey = "sidebar",
	className,
	style,
	children,
	...props
}: React.ComponentProps<"div"> & {
	/** Names the remembered width of the sidebar (between 200px and 400px, 232px until it is dragged). */
	resizeKey?: string;
	defaultOpen?: boolean;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
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

	// This is the internal state of the sidebar.
	// We use openProp and setOpenProp for control from outside the component.
	const [_open, _setOpen] = React.useState(defaultOpen);
	const open = openProp ?? _open;
	React.useEffect(() => {
		if (openProp !== undefined) return;
		const saved = document.cookie
			.split("; ")
			.find((cookie) => cookie.startsWith(`${SIDEBAR_COOKIE_NAME}=`))
			?.split("=")[1];
		if (saved === "true" || saved === "false") _setOpen(saved === "true");
	}, [openProp]);
	const setOpen = React.useCallback(
		(value: boolean | ((value: boolean) => boolean)) => {
			const openState = typeof value === "function" ? value(open) : value;
			if (setOpenProp) {
				setOpenProp(openState);
			} else {
				_setOpen(openState);
			}

			// This sets the cookie to keep the sidebar state.
			document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
		},
		[setOpenProp, open],
	);

	// Helper to toggle the sidebar.
	const toggleSidebar = React.useCallback(() => {
		return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
	}, [isMobile, setOpen, setOpenMobile]);

	// Adds a keyboard shortcut to toggle the sidebar.
	React.useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				toggleSidebar();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [toggleSidebar]);

	// We add a state so that we can do data-state="expanded" or "collapsed".
	// This makes it easier to style the sidebar with Tailwind classes.
	const state = open ? "expanded" : "collapsed";

	const contextValue = React.useMemo<SidebarContextProps>(
		() => ({
			state,
			open,
			setOpen,
			isMobile,
			openMobile,
			setOpenMobile,
			toggleSidebar,
			resize,
		}),
		[state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar, resize],
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
 * The left navigation: the tool ground with a line down its right edge, a header with the site's name, the rows of the groups, and a footer. The
 * writer drags its edge to change the width. `collapsible="offcanvas"` (the default) lets the writer slide it away; `none` keeps it in the page
 * flow, always shown. On a narrow screen it is a drawer that opens from the left over a dimmed page (square, on the same ground, with a line on its
 * open edge, like the sheet).
 */
function Sidebar({
	collapsible = "offcanvas",
	className,
	children,
	dir,
	...props
}: React.ComponentProps<"div"> & {
	collapsible?: "offcanvas" | "none";
}) {
	const labels = useUiLabels();
	const { isMobile, state, openMobile, setOpenMobile, resize } = useSidebar();
	// The handle sits on the edge facing the page.
	const handle = (
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
	);

	if (collapsible === "none") {
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
				{children}
				{!isMobile && handle}
			</div>
		);
	}

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
						{children}
					</DrawerPrimitive.Popup>
				</DrawerPrimitive.Portal>
			</DrawerPrimitive.Root>
		);
	}

	return (
		<div
			className="group peer hidden text-monti-default md:block"
			data-state={state}
			data-collapsible={state === "collapsed" ? collapsible : ""}
			data-slot="sidebar"
		>
			{/* This is what handles the sidebar gap on desktop */}
			<div
				data-slot="sidebar-gap"
				className="relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear group-data-[collapsible=offcanvas]:w-0 group-data-resizing/sidebar-wrapper:transition-none"
			/>
			<div
				data-slot="sidebar-container"
				className={cn(
					"fixed inset-y-0 left-0 z-10 hidden h-svh w-(--sidebar-width) border-monti-default border-r transition-[left,width] duration-200 ease-linear group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)] group-data-resizing/sidebar-wrapper:transition-none md:flex",
					className,
				)}
				{...props}
			>
				<div data-sidebar="sidebar" data-slot="sidebar-inner" className={cn(RAIL, "size-full")}>
					{children}
				</div>
				{state === "expanded" && handle}
			</div>
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

function SidebarInset({
	fixed = false,
	className,
	...props
}: React.ComponentProps<"main"> & {
	/** Inside a `fixed` frame: the main area clips to the window, so its own panes scroll. */
	fixed?: boolean;
}) {
	return (
		<main
			data-slot="sidebar-inset"
			className={cn("relative flex w-full flex-1 flex-col bg-monti-page", fixed && "min-w-0 overflow-clip", className)}
			{...props}
		/>
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
function SidebarMenuBadge({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="sidebar-menu-badge"
			data-sidebar="menu-badge"
			className={cn(
				"ml-auto shrink-0 select-none font-mono font-normal text-monti-meta text-monti-subtle tabular-nums group-data-removed/menu-button:text-monti-faint",
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

/** A folder under a row: its name and, at the end, its count. The open one is ink and semibold. */
function SidebarMenuSubButton({
	render,
	isActive = false,
	className,
	...props
}: useRender.ComponentProps<"a"> & React.ComponentProps<"a"> & { isActive?: boolean }) {
	return useRender({
		defaultTagName: "a",
		props: mergeProps<"a">(
			{
				className: cn(
					"flex items-center justify-between gap-monti-8 py-[5px] pr-monti-10 no-underline outline-none hover:text-monti-default focus-visible:rounded-monti-sm focus-visible:ring-3 focus-visible:ring-monti-contrast/20 data-active:font-semibold data-active:text-monti-default",
					className,
				),
			},
			props,
		),
		render,
		state: { slot: "sidebar-menu-sub-button", sidebar: "menu-sub-button", active: isActive },
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
