"use client";

// The status bar at the bottom of every admin screen. Core and plugins contribute items; an item shows changing state that leads somewhere when clicked,
// and renders nothing when there is nothing to say.

import { useSite, useTranslator } from "@monti-cms/core/site";
import { useQuery } from "@tanstack/react-query";
import { Languages, TriangleAlert } from "lucide-react";
import { type ComponentType, createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { countFailedEvents, eventsKeys } from "../../api/events";
import { cn } from "../../lib/utils/cn";
import { AdminLink } from "../../router";
import { entryEditorShellMessages } from "../entries/entry-editor-shell.messages";
import type { SaveStatus } from "../entries/entry-editor-types";
import { entriesMessages } from "../entries/messages";
import { formatAgo } from "./format-date";
import { useNavQueriesReady } from "./nav-queries";
import { statusBarMessages } from "./status-bar.messages";

/** The screen the bar is shown on. */
export type StatusBarScreen =
	| "list"
	| "entry"
	| "media"
	| "trash"
	| "settings"
	| "tools"
	| "events"
	| "templates"
	| "data"
	| "api-keys"
	| (string & {});

/** What the entry editor publishes to the bar: the state of the entry being edited. */
export interface EditorStatus {
	readonly saveStatus: SaveStatus;
	/** When the server last confirmed the entry (milliseconds since the epoch). `null` while nothing has been saved. */
	readonly savedAt: number | null;
	/** The lifecycle name of the entry ("Draft", "Published"). */
	readonly statusLabel: string;
	/** Characters of the body without whitespace. */
	readonly charCount: number;
	/** Reading time of the body in minutes, at least 1. */
	readonly readingMinutes: number;
	/** Whether the browser keeps a recovery copy of the changes. */
	readonly backupAvailable: boolean;
	/** Saves the changes now (the same as Cmd/Ctrl+S); also tries a failed save again. */
	readonly save: () => void;
	/** What the text checkers found in the body, when a checker covers its language. */
	readonly textIssues: { readonly count: number; readonly jumpToFirst: () => void } | null;
}

/** What an item can read about where it is shown. */
export interface StatusBarContextValue {
	readonly screen: StatusBarScreen;
	/** The collection of a list or entry screen. */
	readonly collection?: string;
	/** The entry being edited, and its language. */
	readonly entryId?: string;
	readonly locale?: string;
	/** How many entries a list screen has in all (the whole result, not the page). */
	readonly count?: number;
	/** The state of the entry being edited, on the editor screen only. */
	readonly editor?: EditorStatus;
}

const StatusBarContext = createContext<StatusBarContextValue>({ screen: "other" });

/** What an item knows about the screen it sits on: the screen kind, the collection, and on the editor the entry and its {@link EditorStatus}. */
export const useStatusBarContext = (): StatusBarContextValue => useContext(StatusBarContext);

/**
 * One item of the bar, as a plugin declares it (`defineAdminPlugin({ statusItems: { "git-sync": { align: "end", order: 20, Component: GitSyncStatus } } })`).
 * The component renders a `StatusBarItem`, or `null` to hide.
 */
export interface StatusItemDefinition {
	/** `start` is the left group and `end` the right one. On narrow screens the `end` items hide first. */
	readonly align: "start" | "end";
	/** Position within the group, ascending. The core items use 10 to 90 for the start group and 10 to 40 for the end group. */
	readonly order: number;
	readonly Component: ComponentType;
}

export type StatusItems = Readonly<Record<string, StatusItemDefinition>>;

const StatusItemsContext = createContext<StatusItems>({});

/** Adds a plugin's status items to the ones outside it (inner wins on the same name). */
export function StatusItemsProvider({ items, children }: { items: StatusItems; children: ReactNode }) {
	const parent = useContext(StatusItemsContext);
	const value = useMemo(() => ({ ...parent, ...items }), [parent, items]);
	return <StatusItemsContext.Provider value={value}>{children}</StatusItemsContext.Provider>;
}

type Tone = "default" | "warning" | "danger";

const toneClass: Record<Tone, string> = {
	default: "text-monti-muted-foreground",
	warning: "text-monti-warning-foreground",
	danger: "text-monti-destructive-foreground",
};

export interface StatusBarItemProps {
	readonly icon?: ReactNode;
	readonly tone?: Tone;
	/** A link inside the admin (or an address). Opens in a new tab when `newTab` is set. */
	readonly href?: string;
	readonly newTab?: boolean;
	readonly onClick?: () => void;
	/** What the item means, as a tooltip and for assistive technology. */
	readonly title: string;
	readonly className?: string;
	readonly children: ReactNode;
}

const itemClass =
	"flex h-5 shrink-0 items-center gap-1 rounded-sm px-1.5 text-monti-micro whitespace-nowrap tabular-nums";
const interactiveClass =
	"cursor-pointer outline-none hover:bg-monti-sidebar-accent hover:text-monti-foreground focus-visible:ring-2 focus-visible:ring-monti-ring";

/** One item of the status bar: an optional icon and a short text, a link or a button when it leads somewhere. */
export function StatusBarItem({
	icon,
	tone = "default",
	href,
	newTab,
	onClick,
	title,
	className,
	children,
}: StatusBarItemProps) {
	const classes = cn(itemClass, toneClass[tone], (href || onClick) && interactiveClass, className);
	const content = (
		<>
			{icon && (
				<span aria-hidden className="flex shrink-0 items-center [&_svg]:size-3">
					{icon}
				</span>
			)}
			<span className="truncate">{children}</span>
		</>
	);
	if (href) {
		const external = newTab || /^https?:/.test(href);
		return external ? (
			<a href={href} target="_blank" rel="noopener noreferrer" title={title} className={classes}>
				{content}
			</a>
		) : (
			<AdminLink href={href} title={title} className={classes}>
				{content}
			</AdminLink>
		);
	}
	if (onClick) {
		return (
			<button type="button" title={title} onClick={onClick} className={classes}>
				{content}
			</button>
		);
	}
	return (
		<span title={title} className={classes}>
			{content}
		</span>
	);
}

/** Re-renders on a timer, so a relative time ("2 min ago") stays true. */
function useNow(intervalMs = 30_000): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), intervalMs);
		return () => clearInterval(timer);
	}, [intervalMs]);
	return now;
}

const SAVE_TONE: Record<SaveStatus, Tone> = {
	new: "warning",
	saved: "default",
	dirty: "warning",
	saving: "default",
	"local-only": "warning",
	failed: "danger",
	conflict: "danger",
	"session-expired": "danger",
};

/** Editor: the lifecycle name and the save state ("Draft · Saved 2 min ago", "Saving…", "Not saved"). Clicking it saves now (and tries a failed save again). */
function SaveStateItem() {
	const site = useSite();
	const t = useTranslator(statusBarMessages);
	const te = useTranslator(entriesMessages);
	const ts = useTranslator(entryEditorShellMessages);
	const now = useNow();
	const { editor } = useStatusBarContext();
	if (!editor) return null;
	const { saveStatus: status } = editor;
	const word = t(`save.word.${status}`);
	const text =
		status === "saved"
			? editor.savedAt === null
				? t("save.savedNow", { status: editor.statusLabel })
				: t("save.saved", { status: editor.statusLabel, ago: formatAgo(site, editor.savedAt, now) })
			: status === "dirty"
				? t("save.dirty", { status: editor.statusLabel })
				: t(`save.${status}`);
	// The tooltip is the full sentence of the save state, with a note when the browser keeps no backup.
	const title = `${te(`save.${status}`)}${editor.backupAvailable ? "" : ts("backupUnavailable")}`;
	const action =
		status === "failed" || status === "local-only" || status === "dirty" || status === "new"
			? { onClick: editor.save }
			: status === "session-expired"
				? { href: site.adminHref("/login"), newTab: true }
				: {};
	return (
		<>
			<StatusBarItem tone={SAVE_TONE[status]} title={title} {...action}>
				{text}
			</StatusBarItem>
			{/* The time moves every half minute, so only the state is announced. */}
			<output aria-live="polite" className="sr-only">
				{word}
			</output>
		</>
	);
}

/** Editor: the language of the entry, in mono. */
function LocaleItem() {
	const site = useSite();
	const t = useTranslator(statusBarMessages);
	const { editor, locale } = useStatusBarContext();
	if (!editor || !locale) return null;
	return (
		<StatusBarItem icon={<Languages />} title={t("locale", { label: site.localeLabel(locale) })} className="font-mono">
			{locale}
		</StatusBarItem>
	);
}

/** Editor: characters (whitespace excluded) and reading time of the body. */
function BodyStatsItem() {
	const t = useTranslator(statusBarMessages);
	const { editor } = useStatusBarContext();
	if (!editor) return null;
	return (
		<StatusBarItem title={t("body.title")}>
			{t("body", { chars: editor.charCount.toLocaleString(), minutes: editor.readingMinutes })}
		</StatusBarItem>
	);
}

/** Failed and dead event deliveries, from the same count the sidebar badge reads. Links to the event log. */
function FailedDeliveriesItem() {
	const site = useSite();
	const t = useTranslator(statusBarMessages);
	const ready = useNavQueriesReady();
	// A light background fetch. Errors (for example no access) are ignored so the bar never breaks.
	const { data: count } = useQuery({
		queryKey: eventsKeys.count(),
		queryFn: ({ signal }) => countFailedEvents(site, signal),
		retry: false,
		enabled: ready,
	});
	if (!count) return null;
	return (
		<StatusBarItem
			tone="danger"
			icon={<TriangleAlert />}
			href={site.adminHref("/events")}
			title={t("deliveries.title")}
		>
			{t("deliveries.failed", { count })}
		</StatusBarItem>
	);
}

/** Lists, trash and media: how many entries there are in all, on the right. */
function EntryCountItem() {
	const t = useTranslator(statusBarMessages);
	const { count } = useStatusBarContext();
	if (count === undefined) return null;
	return <StatusBarItem title={t("count", { count })}>{t("count", { count: count.toLocaleString() })}</StatusBarItem>;
}

/** The core's own items, built with the same declaration a plugin uses. */
const CORE_ITEMS: StatusItems = {
	"core:save": { align: "start", order: 10, Component: SaveStateItem },
	"core:locale": { align: "start", order: 20, Component: LocaleItem },
	"core:body": { align: "start", order: 30, Component: BodyStatsItem },
	"core:deliveries": { align: "start", order: 80, Component: FailedDeliveriesItem },
	"core:count": { align: "end", order: 10, Component: EntryCountItem },
};

const byPosition = ([nameA, a]: [string, StatusItemDefinition], [nameB, b]: [string, StatusItemDefinition]) =>
	a.order - b.order || nameA.localeCompare(nameB);

/**
 * The bar. It sits at the bottom of a screen (the shell, the editor) and shrinks the page above it. `context` is what the items read through
 * `useStatusBarContext`. The bar never wraps: the `start` items truncate, and the `end` items hide first on narrow screens.
 */
export function StatusBar({ context }: { context: StatusBarContextValue }) {
	const t = useTranslator(statusBarMessages);
	const plugin = useContext(StatusItemsContext);
	const { start, end } = useMemo(() => {
		const sorted = Object.entries({ ...CORE_ITEMS, ...plugin }).sort(byPosition);
		return {
			start: sorted.filter(([, item]) => item.align === "start"),
			end: sorted.filter(([, item]) => item.align === "end"),
		};
	}, [plugin]);
	return (
		<StatusBarContext.Provider value={context}>
			<section
				aria-label={t("label")}
				data-slot="status-bar"
				className="flex h-6 shrink-0 items-center justify-between gap-2 overflow-hidden whitespace-nowrap border-t bg-monti-sidebar px-2"
			>
				<div className="flex min-w-0 items-center gap-1 overflow-hidden">
					{start.map(([name, { Component }]) => (
						<Component key={name} />
					))}
				</div>
				<div className="flex shrink-0 items-center gap-1 max-sm:hidden">
					{end.map(([name, { Component }]) => (
						<Component key={name} />
					))}
				</div>
			</section>
		</StatusBarContext.Provider>
	);
}
