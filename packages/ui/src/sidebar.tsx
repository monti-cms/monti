"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Dialog as DrawerPrimitive } from "@base-ui/react/dialog";
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";
import { ChangeDot } from "./change-dot";
import { cn } from "./cn";
import { CutWords } from "./cut-words";
import { BACKDROP } from "./dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "./dropdown-menu";
import { ICON_BUTTON, IconButton } from "./icon-button";
import { Asleep, Light, OpenPanelLeft, Screen, SidePanelClose, SidePanelOpen } from "./icons";
import { useUiLabels } from "./labels";
import { NAV_ROW, NAV_ROW_END } from "./nav-link";
import { PageBannerPlace } from "./page-banner";
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

/**
 * The rail as the design draws it: the tool ground, the head row on top (52px, open or folded, so it stays put), 12px at the sides and below, rows
 * 2px apart. Folded, 8px | 7px at the sides, so the 32px rows fill the 48px rail with its 1px edge and nothing scrolls sideways.
 */
const RAIL =
	"flex flex-col gap-monti-2 bg-monti-tool px-monti-12 pb-monti-12 text-monti-default data-rail:pr-[7px] data-rail:pl-monti-8";

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
		<nav aria-label={label} data-slot="sidebar-nav" className="flex min-h-0 flex-1 flex-col">
			{children}
		</nav>
	);

	if (isMobile) {
		return (
			<DrawerPrimitive.Root open={openMobile} onOpenChange={setOpenMobile} {...props}>
				<DrawerPrimitive.Portal>
					<DrawerPrimitive.Backdrop className={BACKDROP} />
					<DrawerPrimitive.Popup
						dir={dir}
						data-sidebar="sidebar"
						data-slot="sidebar"
						data-mobile="true"
						className={cn(
							RAIL,
							"fixed inset-y-0 left-0 z-50 h-full w-monti-sidebar max-w-full border-monti-default border-r outline-none transition duration-(--monti-duration-slow) ease-monti-standard data-ending-style:-translate-x-10 data-starting-style:-translate-x-10 data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-(--monti-duration-normal) data-ending-style:ease-monti-exit",
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
 * The page beside the rail. On a narrow screen, where the rail is a drawer, a bar above the page holds the button that opens it.
 * `banner` is an alert about the whole site (a schema change saved but not applied): it spans the page edge to edge above everything, and the page
 * moves down under it. A page's own banner stands in the same place, under the site's: the page gives it with `PageBanner`.
 */
function SidebarInset({
	fixed = false,
	banner,
	className,
	children,
	...props
}: React.ComponentProps<"main"> & {
	/** Inside a `fixed` frame: the main area clips to the window, so its own panes scroll. */
	fixed?: boolean;
	/** A `Banner` about the whole site, above the page (and above what the page gives with `PageBanner`). */
	banner?: React.ReactNode;
}) {
	const { isMobile } = useSidebar();
	return (
		<main
			data-slot="sidebar-inset"
			className={cn("relative flex w-full flex-1 flex-col bg-monti-page", fixed && "min-w-0 overflow-clip", className)}
			{...props}
		>
			<PageBannerPlace data-slot="sidebar-inset-banner" banner={banner}>
				<div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
					{isMobile && (
						<div className="flex h-monti-header shrink-0 items-center justify-between px-monti-12">
							<SidebarTrigger />
						</div>
					)}
					{children}
				</div>
			</PageBannerPlace>
		</main>
	);
}

/**
 * The head row, as tall as the page's header (52px): the site's name in 14px at 600, 8px in, and the 28px fold button at its end and the fold button ({@link SidebarRailToggle}). Put the name in a span (a `Text`): it takes the room the row
 * leaves, so the fold button sits at the row's end, and folded to a rail it is hidden, so the row holds the unfold button alone.
 */
function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-header"
			data-sidebar="header"
			className={cn(
				"flex h-monti-header shrink-0 items-center gap-monti-4 pr-0 pl-monti-8 font-semibold text-monti-body group-data-[rail]/rail:px-0 *:[span]:min-w-0 *:[span]:flex-1 group-data-[rail]/rail:*:[span]:hidden",
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
						className={cn(ICON_BUTTON, "size-monti-control-sm rounded-monti-md text-monti-subtle", className)}
						onClick={toggleRail}
						{...props}
					/>
				}
			>
				{rail ? <SidePanelOpen /> : <SidePanelClose />}
			</TooltipTrigger>
			<TooltipContent side={rail ? "right" : "bottom"} shortcut={["mod", "B"]}>
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
			className={cn("flex pt-monti-6 group-data-[rail]/rail:px-0", className)}
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
	/** Without it the modes are drawn and pick nothing (a screen spec's look, before its behavior is wired). */
	onValueChange?: (mode: ScreenMode) => void;
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
					onValueChange={(mode) => onValueChange?.(mode)}
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
				<DropdownMenuRadioGroup value={value} onValueChange={(next) => onValueChange?.(next as ScreenMode)}>
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

/** The group at the bottom (trash, tools, settings): pushed to the end of the rail, with no line above it. */
function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-footer"
			data-sidebar="footer"
			className={cn("mt-auto flex flex-col gap-monti-2", className)}
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
 * One row of the rail ({@link NAV_ROW} on the cream ground): an icon, the name, and at the end a count ({@link SidebarMenuBadge}). The open one is on the
 * selected ground, in ink at 500; there is no bar beside it. Pointing at any other row gives it the hover ground.
 * Put a `ChangeDot` after the name for an unsaved change; it sits 6px from it.
 */
function SidebarMenuButton({
	render,
	isActive = false,
	tooltip,
	railDot,
	className,
	children,
	...props
}: useRender.ComponentProps<"button"> &
	React.ComponentProps<"button"> & {
		isActive?: boolean;
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
					NAV_ROW,
					"peer/menu-button group/menu-button text-monti-muted group-has-data-[sidebar=menu-action]/menu-item:pr-monti-32 group-data-[rail]/rail:relative group-data-[rail]/rail:w-8 group-data-[rail]/rail:px-monti-8 group-data-[rail]/rail:[&>[data-slot=sidebar-menu-badge]]:hidden group-data-[rail]/rail:[&>span:not([data-slot])]:hidden [&>[data-slot=change-dot]]:-ml-monti-4 [&>span:not([data-slot])]:min-w-0 [&>span:not([data-slot])]:truncate [&_svg]:size-4 [&_svg]:shrink-0",
					className,
				),
				children: (
					<>
						{children}
						{rail && railDot && (
							<ChangeDot tone="danger" label={railDot} className="absolute top-[7px] right-[7px] m-0" />
						)}
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
		},
	});
	// A name that runs past the row says itself whole when pointed at, as every cut word does; folded, the row's tooltip says it.
	if (!rail || !tooltip) return <CutWords render={cutBox(row)} />;
	return (
		<Tooltip>
			<TooltipTrigger render={row} />
			<TooltipContent side="right">{tooltip}</TooltipContent>
		</Tooltip>
	);
}

/** A row as `CutWords` takes its box: the element `useRender` made, typed as an element with the usual attributes. */
const cutBox = (row: React.ReactElement) => row as React.ReactElement<React.HTMLAttributes<HTMLElement>>;

/** The count at the end of a row: mono, small and quiet, in the flow of the row, so a long name is cut before it. */
function SidebarMenuBadge({
	tone = "default",
	label,
	className,
	children,
	...props
}: React.ComponentProps<"span"> & {
	/** `danger` for a count of what failed (failed deliveries). */
	tone?: "default" | "danger";
	/** A word that says what the count counts, before it in the sans ("실패 25": the failed deliveries on "활동 기록"). The count stays mono. */
	label?: React.ReactNode;
}) {
	return (
		<span
			data-slot="sidebar-menu-badge"
			data-sidebar="menu-badge"
			className={cn(NAV_ROW_END, tone === "danger" && "text-monti-danger", className)}
			{...props}
		>
			{label ? (
				<>
					<span data-slot="sidebar-menu-badge-label" className="font-sans">
						{label}
					</span>{" "}
				</>
			) : null}
			{children}
		</span>
	);
}

/** The folders under an open row, 13px, muted, 2px apart like the rows above them. Each row keeps its own indent, so its hover ground spans the whole row. Rows are {@link SidebarMenuSubButton}s. */
function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
	return (
		<ul
			data-slot="sidebar-menu-sub"
			data-sidebar="menu-sub"
			className={cn(
				"isolate m-0 flex list-none flex-col gap-monti-2 pt-monti-2 pr-0 pb-0 pl-0 text-monti-muted text-monti-note group-data-[rail]/rail:hidden",
				className,
			)}
			{...props}
		/>
	);
}

/** A folder's name stands where a top row's name stands (8px + 16px icon + 8px), then 12px further in each level. */
const SUB_DEPTH = ["pl-monti-32", "pl-[44px]", "pl-[56px]", "pl-[68px]"] as const;

/**
 * The place of each folder in a flat folder list, from its depth (kept for callers; no line is drawn from it any more): whether a folder is the first under its parent (its rule starts with some air),
 * whether it is the last at its depth under its parent (its rule ends at its middle), and which ancestors' rules run on past it (`through[d]`: the
 * parent at depth `d` has a later sibling).
 */
export function folderTree(depths: readonly number[]) {
	const hasLaterSibling = (index: number, depth: number) => {
		for (let next = index + 1; next < depths.length; next++) {
			if (depths[next] < depth) return false;
			if (depths[next] === depth) return true;
		}
		return false;
	};
	return depths.map((depth, index) => {
		const through: boolean[] = [];
		for (let level = 0; level < depth; level++) through.push(hasLaterSibling(index, level));
		const first = index === 0 || depths[index - 1] < depth;
		return { first, last: !hasLaterSibling(index, depth), through };
	});
}

/** A folder row draws no tree line (its ground would cross it): the nesting shows by its indent alone. */
const SUB_LINE = "relative";

/**
 * A folder under a row: 28px, `radius-md`, 13px words, its name and, at the end, its count. The open one is on the selected ground in ink at 500; pointing at
 * one gives it the hover ground. No tree line runs beside the folders (`SUB_LINE`): the indent says the nesting. A row's name starts where a top row's name stands, and its count ends 8px from the row's edge like a top row's; `depth` indents a folder inside another by 12px a level; `dropTarget` is the ring while entries are dragged over it. A link by default; `render={<button type="button" />}` makes it a button.
 */
function SidebarMenuSubButton({
	render,
	isActive = false,
	depth = 0,
	dropTarget = false,
	tree: _tree,
	className,
	style,
	children,
	...props
}: useRender.ComponentProps<"a"> &
	React.ComponentProps<"a"> & {
		isActive?: boolean;
		depth?: 0 | 1 | 2 | 3;
		dropTarget?: boolean;
		/** The row's place in the tree, from {@link folderTree}. Accepted for callers; the indent alone shows the nesting now. */
		tree?: { first: boolean; last: boolean; through: readonly boolean[] };
	}) {
	const row = useRender({
		defaultTagName: "a",
		props: mergeProps<"a">(
			{
				className: cn(
					"flex w-full cursor-pointer items-center justify-between gap-monti-8 min-h-monti-control-sm rounded-monti-md border-0 bg-transparent py-monti-4 pr-monti-8 text-left text-monti-note no-underline outline-none hover:bg-monti-muted hover:text-monti-default focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-monti-contrast/60 data-active:bg-monti-selected data-active:font-medium data-active:text-monti-default data-droptarget:ring-2 data-droptarget:ring-monti-contrast [&>span:not([data-slot])]:min-w-0 [&>span:not([data-slot])]:truncate",
					SUB_DEPTH[depth],
					SUB_LINE,
					className,
				),
				style,
				children,
			},
			props,
		),
		render,
		state: { slot: "sidebar-menu-sub-button", sidebar: "menu-sub-button", active: isActive, dropTarget },
	});
	return <CutWords render={cutBox(row)} />;
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
