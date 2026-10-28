"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Dialog as DrawerPrimitive } from "@base-ui/react/dialog";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Asleep, Light, OpenPanelLeft, Screen, SidePanelClose, SidePanelOpen } from "@carbon/icons-react";
import * as React from "react";
import { ChangeDot } from "./change-dot";
import { cn } from "./cn";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "./dropdown-menu";
import { ICON_BUTTON, IconButton } from "./icon-button";
import { useUiLabels } from "./labels";
import { ResizeHandle, useResizableWidth } from "./resize-handle";
import { Segmented } from "./segmented";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { useIsMobile } from "./use-mobile";

/** Where the width starts (232px, the same as the `w-monti-sidebar` token, which a loading placeholder uses), and the limits the person can drag it between. */
const SIDEBAR_WIDTH_DEFAULT = 232;
const SIDEBAR_WIDTH_MIN = 200;
const SIDEBAR_WIDTH_MAX = 400;

const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarContextProps = {
	/** Folded to the icon rail (desktop only; never while the sidebar is a drawer). */
	rail: boolean;
	setRail: (rail: boolean) => void;
	toggleRail: () => void;
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
	rail: railProp,
	onRailChange,
	className,
	style,
	children,
	...props
}: React.ComponentProps<"div"> & {
	/** Whether the sidebar is folded to its icons. Give it with `onRailChange` to keep the state outside (the admin remembers it in the browser). */
	rail?: boolean;
	onRailChange?: (rail: boolean) => void;
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

	const [ownRail, setOwnRail] = React.useState(false);
	const folded = (railProp ?? ownRail) && !isMobile;
	const setRail = React.useCallback(
		(next: boolean) => {
			setOwnRail(next);
			onRailChange?.(next);
		},
		[onRailChange],
	);
	const toggleRail = React.useCallback(() => setRail(!folded), [setRail, folded]);

	// ⌘B (Ctrl+B) folds and unfolds the sidebar, where it is a sidebar and not a drawer.
	React.useEffect(() => {
		if (isMobile) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (
				event.key !== SIDEBAR_KEYBOARD_SHORTCUT ||
				!(event.metaKey || event.ctrlKey) ||
				event.altKey ||
				event.shiftKey
			)
				return;
			event.preventDefault();
			toggleRail();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isMobile, toggleRail]);

	const contextValue = React.useMemo<SidebarContextProps>(
		() => ({ rail: folded, setRail, toggleRail, isMobile, openMobile, setOpenMobile, toggleSidebar, resize }),
		[folded, setRail, toggleRail, isMobile, openMobile, toggleSidebar, resize],
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

/** The rail as the design draws it: the tool ground, 20px above, 14px at the sides (6px folded, so the 36px rows fill the 48px rail), 16px below, rows 2px apart. */
const RAIL =
	"flex flex-col gap-monti-2 bg-monti-tool px-[14px] pt-monti-20 pb-monti-16 text-monti-default data-rail:px-[6px]";

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
	const { isMobile, openMobile, setOpenMobile, resize, rail } = useSidebar();
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
			data-rail={rail ? "" : undefined}
			className={cn(
				RAIL,
				"group/rail relative shrink-0 self-stretch border-monti-default border-r",
				rail ? "w-monti-rail" : "w-(--sidebar-width)",
				className,
			)}
			{...props}
		>
			{rows}
			{!rail && (
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
			)}
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
 * clear of it, and a panel docked at the right edge covers it. On a narrow screen, where the rail is a drawer, a bar above the page holds the button that opens it, with the corner at its end.
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
				corner && <div className="absolute top-monti-12 right-monti-12 z-10">{corner}</div>
			)}
			{children}
		</main>
	);
}

/**
 * The head row, 32px: the site's name (cut with an ellipsis when it is long) and the fold button ({@link SidebarRailToggle}). Folded, the row holds the
 * unfold button alone.
 */
function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-header"
			data-sidebar="header"
			className={cn(
				"mb-monti-16 flex h-monti-icon-button shrink-0 items-center gap-monti-4 pr-0 pl-monti-6 group-data-[rail]/rail:px-0",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * The fold button of the head row: folds the sidebar to its icons, or unfolds it. Its name and its tooltip say which; the tooltip shows ⌘B, which
 * does the same. Nothing while the sidebar is a drawer (a narrow screen opens it with the button of the page).
 */
function SidebarRailToggle({ className, ...props }: Omit<ButtonPrimitive.Props, "aria-label" | "children">) {
	const labels = useUiLabels();
	const { rail, toggleRail, isMobile } = useSidebar();
	if (isMobile) return null;
	const label = rail ? labels.sidebarUnfold : labels.sidebarFold;
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<ButtonPrimitive
						data-slot="sidebar-rail-toggle"
						type="button"
						aria-label={label}
						className={cn(ICON_BUTTON, "text-monti-subtle", className)}
						onClick={toggleRail}
						{...props}
					/>
				}
			>
				{rail ? <SidePanelOpen /> : <SidePanelClose />}
			</TooltipTrigger>
			<TooltipContent side={rail ? "right" : "bottom"} shortcut="⌘B">
				{label}
			</TooltipContent>
		</Tooltip>
	);
}

/** The last row of the sidebar, under the bottom group: the screen mode ({@link SidebarScreenMode}). */
function SidebarFoot({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-foot"
			data-sidebar="foot"
			className={cn("flex px-[2px] pt-monti-8 group-data-[rail]/rail:px-0", className)}
			{...props}
		/>
	);
}

/** The screen modes in the order they are offered. */
const SCREEN_MODES = ["system", "light", "dark"] as const;
type ScreenMode = (typeof SCREEN_MODES)[number];
const SCREEN_MODE_ICONS = { system: Screen, light: Light, dark: Asleep } as const;

/**
 * The screen mode in the last row: three icon cells (system, light, dark) across the rail's width, the current one pressed, so one press changes it. Folded, the rail has no
 * room for three, so one icon button shows the current mode and opens the three in a menu upward, a ✓ on the current one. `labels` names the control
 * and each mode.
 */
function SidebarScreenMode({
	value,
	onValueChange,
	labels,
	defaultOpen,
}: {
	value: ScreenMode;
	onValueChange: (mode: ScreenMode) => void;
	labels: { label: string } & Record<ScreenMode, string>;
	/** Opens the folded menu at first (for a story). */
	defaultOpen?: boolean;
}) {
	const { rail } = useSidebar();
	if (!rail) {
		return (
			<div className="min-w-0 flex-1">
				<Segmented
					aria-label={labels.label}
					tone="tool"
					value={value}
					onValueChange={onValueChange}
					options={SCREEN_MODES.map((mode) => {
						const Icon = SCREEN_MODE_ICONS[mode];
						return { value: mode, label: <Icon aria-hidden />, "aria-label": labels[mode] };
					})}
				/>
			</div>
		);
	}
	const Icon = SCREEN_MODE_ICONS[value];
	return (
		<DropdownMenu defaultOpen={defaultOpen}>
			<IconButton label={labels.label} side="right" trigger={(button) => <DropdownMenuTrigger render={button} />}>
				<Icon aria-hidden />
			</IconButton>
			<DropdownMenuContent side="top" align="start">
				<DropdownMenuRadioGroup value={value} onValueChange={(next) => onValueChange(next as ScreenMode)}>
					{SCREEN_MODES.map((mode) => (
						<DropdownMenuRadioItem key={mode} value={mode}>
							{labels[mode]}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
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
 * One row of the rail: 36px, an icon, the name, and at the end a count ({@link SidebarMenuBadge}). The open one is on the current ground (one step
 * darker than the selected one) and semibold; there is no bar beside it. Pointing at any other row gives it the selected ground, which is paler than the
 * current one, so a row that is only pointed at is never taken for the open one. `removed` is a row the writer took out in the schema (struck through and faint).
 * Put a `ChangeDot` after the name for an unsaved change; it sits 6px from it.
 */
function SidebarMenuButton({
	render,
	isActive = false,
	removed = false,
	tooltip,
	railDot,
	className,
	children,
	...props
}: useRender.ComponentProps<"button"> &
	React.ComponentProps<"button"> & {
		isActive?: boolean;
		removed?: boolean;
		/** What the row says when the sidebar is folded to its icons (its name and count, "Tools 1"): a tooltip on the icon. */
		tooltip?: string;
		/** Folded, the count cannot show: a dot on the icon takes its place when there is something to look at. The text names it for screen readers. */
		railDot?: string;
	}) {
	const { rail } = useSidebar();
	const row = useRender({
		defaultTagName: "button",
		props: mergeProps<"button">(
			{
				className: cn(
					"peer/menu-button group/menu-button flex h-9 w-full min-w-0 items-center gap-monti-10 rounded-monti-md border-0 bg-transparent px-monti-10 text-left text-monti-body text-monti-default no-underline outline-none group-has-data-[sidebar=menu-action]/menu-item:pr-monti-32 hover:bg-monti-selected focus-visible:ring-3 focus-visible:ring-monti-contrast/20 disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 data-active:bg-monti-current data-active:font-semibold data-removed:text-monti-faint data-removed:line-through group-data-[rail]/rail:relative group-data-[rail]/rail:w-9 group-data-[rail]/rail:[&>[data-slot=sidebar-menu-badge]]:hidden group-data-[rail]/rail:[&>span:not([data-slot])]:hidden [&>[data-slot=change-dot]]:-ml-monti-4 [&>span:not([data-slot])]:min-w-0 [&>span:not([data-slot])]:truncate [&_svg]:size-4 [&_svg]:shrink-0",
					className,
				),
				children: (
					<>
						{children}
						{rail && railDot && <ChangeDot label={railDot} className="absolute top-[7px] right-[7px] m-0" />}
					</>
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
	if (!rail || !tooltip) return row;
	return (
		<Tooltip>
			<TooltipTrigger render={row} />
			<TooltipContent side="right">{tooltip}</TooltipContent>
		</Tooltip>
	);
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

/** The folders under an open row, 13px muted. Each row keeps its own 36px in from the edge, so its hover ground spans the whole row. Rows are {@link SidebarMenuSubButton}s. */
function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
	return (
		<ul
			data-slot="sidebar-menu-sub"
			data-sidebar="menu-sub"
			className={cn(
				"m-0 flex list-none flex-col pt-monti-2 pr-0 pb-monti-6 pl-0 text-monti-muted text-monti-note group-data-[rail]/rail:hidden",
				className,
			)}
			{...props}
		/>
	);
}

const SUB_DEPTH = ["pl-9", "pl-[50px]", "pl-16", "pl-[78px]"] as const;

/**
 * A folder under a row: its name and, at the end, its count. The open one is ink and semibold, with no ground of its own; pointing at one gives it
 * the selected ground. A row starts 36px in from the edge, and `depth` indents a folder inside another by 14px a level; `dropTarget` is the ring while entries are dragged over it. A link by default; `render={<button type="button" />}` makes it a button.
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
					"flex w-full cursor-pointer items-center justify-between gap-monti-8 rounded-monti-md border-0 bg-transparent py-[5px] pr-monti-10 text-left no-underline outline-none hover:bg-monti-selected hover:text-monti-default focus-visible:ring-3 focus-visible:ring-monti-contrast/20 data-active:font-semibold data-active:text-monti-default data-droptarget:ring-2 data-droptarget:ring-monti-contrast [&>span:not([data-slot])]:min-w-0 [&>span:not([data-slot])]:truncate",
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
	SidebarFoot,
	SidebarInset,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarProvider,
	SidebarRailToggle,
	SidebarScreenMode,
	SidebarTrigger,
	useSidebar,
};
