"use client";

// The status bar at the bottom of every admin screen. Core and plugins contribute items; an item shows changing state that leads somewhere when clicked,
// and renders nothing when there is nothing to say.

import { Checkmark, Translate, WarningAlt } from "@carbon/icons-react";
import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	cn,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Spinner,
	StatusBarCell,
	StatusBar as StatusBarFrame,
	StatusBarSpacer,
} from "@monti-cms/ui";
import { useQuery } from "@tanstack/react-query";
import { type ComponentType, createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { CmsIssue } from "../../api/error-message";
import { countFailedEvents, eventsKeys, listEvents, retryAllEvents } from "../../api/events";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { AdminLink } from "../../router";
import { READING_CHARS_PER_MINUTE } from "../entries/body-stats";
import { entryEditorShellMessages } from "../entries/entry-editor-shell.messages";
import type { SaveStatus } from "../entries/entry-editor-types";
import { entriesMessages } from "../entries/messages";
import { eventCollectionLabel } from "../events/event-display";
import { eventsMessages } from "../events/messages";
import { statusLabels } from "./entry-status";
import { formatAgo, formatDateTime } from "./format-date";
import { useNavQueriesReady } from "./nav-queries";
import { issueHasPlace, type PublishCheckResult, readinessText } from "./publish-readiness";
import { publishReadinessMessages } from "./publish-readiness.messages";
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

/** One language of the entry's translation group, as the locale popup lists it. */
export interface EditorTranslation {
	readonly id: string;
	readonly locale: string;
	readonly status: "draft" | "published" | "archived" | "trashed";
	/** Whether this is the entry being edited. */
	readonly current: boolean;
}

/** One finding of a text checker, as a popup lists it. */
export interface EditorTextIssue {
	/** The marked text. */
	readonly text: string;
	/** The first replacement the checker suggests, if any. */
	readonly suggestion: string | null;
	/** Selects the finding in the body. */
	readonly jump: () => void;
}

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
	/** Sizes of the body besides `charCount`: characters with whitespace, words, and the text blocks and headings that have text. */
	readonly bodyStats: {
		readonly charsWithSpaces: number;
		readonly words: number;
		readonly paragraphs: number;
		readonly headings: number;
	};
	/** Whether the browser keeps a recovery copy of the changes. */
	readonly backupAvailable: boolean;
	/** A browser copy found on open that is not on the server, with the two answers to it. `null` when there is none. */
	readonly recovery: { readonly restore: () => void; readonly discard: () => void } | null;
	/** The languages of the entry's translation group (a missing one is not listed). `null` when the site has no translations here. */
	readonly translations: readonly EditorTranslation[] | null;
	/** Saves the changes now (the same as Cmd/Ctrl+S); also tries a failed save again. */
	readonly save: () => void;
	/**
	 * What the server's publish check found in the saved draft. `null` for an entry that cannot be published (trashed, archived), for one not saved
	 * yet, and while there is no answer; the item then shows nothing.
	 */
	readonly publishReadiness: {
		/** The latest answer, `null` while the first one is on its way. */
		readonly result: PublishCheckResult | null;
		/** Whether a check is running. */
		readonly checking: boolean;
		/** Whether the draft has changes the answer does not cover; it is rechecked after they are saved. */
		readonly stale: boolean;
		readonly recheck: () => void;
		/** Brings the writer to the field or block of a problem. */
		readonly focus: (issue: CmsIssue) => void;
		/** Whether the popup is open, so a refused publish can open it. Without `open` and `onOpenChange` the item keeps that state itself. */
		readonly open?: boolean;
		readonly onOpenChange?: (open: boolean) => void;
	} | null;
	/** What the text checkers found in the body, when a checker covers its language. */
	readonly textIssues: {
		readonly count: number;
		readonly jumpToFirst: () => void;
		/** The findings in document order. */
		readonly items: readonly EditorTextIssue[];
		/** Checks the body again; `null` when no checker can be run on demand. */
		readonly recheck: (() => void) | null;
		/** Whether a check is running. */
		readonly checking: boolean;
	} | null;
}

/** What an item can read about where it is shown. */
export interface StatusBarContextValue {
	readonly screen: StatusBarScreen;
	/** The collection of a list or entry screen. */
	readonly collection?: string;
	/** The entry being edited, and its language. */
	readonly entryId?: string;
	readonly locale?: string;
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
	default: "text-monti-muted",
	warning: "text-monti-warning",
	danger: "text-monti-danger",
};

interface StatusBarItemBase {
	readonly icon?: ReactNode;
	readonly tone?: Tone;
	/** What the item means, as a tooltip and for assistive technology. */
	readonly title: string;
	readonly children: ReactNode;
}

type NoPopupState = { readonly open?: never; readonly onOpenChange?: never };

/** What an item leads to: nothing, a link (`href`), an action (`onClick`) or a popup (`popover`). At most one. */
export type StatusBarItemProps = StatusBarItemBase &
	(
		| (NoPopupState & {
				readonly href?: never;
				readonly newTab?: never;
				readonly onClick?: never;
				readonly popover?: never;
		  })
		/** A link inside the admin (or an address). Opens in a new tab when `newTab` is set. */
		| (NoPopupState & {
				readonly href: string;
				readonly newTab?: boolean;
				readonly onClick?: never;
				readonly popover?: never;
		  })
		| (NoPopupState & {
				readonly href?: never;
				readonly newTab?: never;
				readonly onClick: () => void;
				readonly popover?: never;
		  })
		/**
		 * Opens a popup above the item (Enter and Space open it, Escape closes it). Build it from `StatusPopoverHeader` and `StatusPopoverRow`.
		 * With `open` and `onOpenChange` the item does not keep the state itself, so something else can open the popup.
		 */
		| {
				readonly href?: never;
				readonly newTab?: never;
				readonly onClick?: never;
				readonly popover: ReactNode;
				readonly open?: boolean;
				readonly onOpenChange?: (open: boolean) => void;
		  }
	);

// Which group the item sits in decides which edge its popup lines up with.
const AlignContext = createContext<"start" | "end">("start");
// Lets what is inside a popup (a row, a header action) close it.
const PopoverCloseContext = createContext<() => void>(() => {});

/** One item of the status bar, drawn as a cell: an optional icon and a short text, a link, a button or a popup when it leads somewhere. */
export function StatusBarItem({
	icon,
	tone = "default",
	href,
	newTab,
	onClick,
	popover,
	open: controlledOpen,
	onOpenChange,
	title,
	children,
}: StatusBarItemProps) {
	const align = useContext(AlignContext);
	const [ownOpen, setOwnOpen] = useState(false);
	const open = controlledOpen ?? ownOpen;
	const setOpen = onOpenChange ?? setOwnOpen;
	const cellProps = { end: align === "end", tone: tone === "default" ? undefined : tone, title } as const;
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
	if (popover) {
		return (
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger render={<StatusBarCell {...cellProps} />}>{content}</PopoverTrigger>
				<PopoverContent side="top" align={align} sideOffset={6} width="md" padding="none" scroll>
					<PopoverCloseContext.Provider value={() => setOpen(false)}>
						<Box paddingY={4}>{popover}</Box>
					</PopoverCloseContext.Provider>
				</PopoverContent>
			</Popover>
		);
	}
	if (href) {
		const external = newTab || /^https?:/.test(href);
		return external ? (
			<StatusBarCell {...cellProps} href={href} target="_blank" rel="noopener noreferrer">
				{content}
			</StatusBarCell>
		) : (
			<StatusBarCell {...cellProps} render={<AdminLink href={href} />}>
				{content}
			</StatusBarCell>
		);
	}
	if (onClick) {
		return (
			<StatusBarCell {...cellProps} onClick={onClick}>
				{content}
			</StatusBarCell>
		);
	}
	return (
		<StatusBarCell {...cellProps} render={<span />}>
			{content}
		</StatusBarCell>
	);
}

/** The title of a popup, with one optional action on the right (it closes the popup). */
export function StatusPopoverHeader({
	title,
	action,
}: {
	title: ReactNode;
	action?: {
		readonly label: string;
		readonly onClick?: () => void;
		readonly href?: string;
		readonly newTab?: boolean;
		/** Leaves the popup open after the action, for one whose answer is shown in it. */
		readonly keepOpen?: boolean;
	};
}) {
	const close = useContext(PopoverCloseContext);
	const buttonClass =
		"h-6 shrink-0 rounded-monti-sm px-monti-8 font-medium text-monti-default outline-none hover:bg-monti-selected focus-visible:ring-2 focus-visible:ring-monti-contrast";
	return (
		<div className="flex items-center justify-between gap-monti-12 px-monti-12 py-monti-8">
			<h2 className="min-w-0 truncate font-medium">{title}</h2>
			{action?.href ? (
				<a
					href={action.href}
					target={action.newTab ? "_blank" : undefined}
					rel="noopener noreferrer"
					onClick={close}
					className={cn(buttonClass, "flex items-center")}
				>
					{action.label}
				</a>
			) : action ? (
				<button
					type="button"
					className={buttonClass}
					onClick={() => {
						action.onClick?.();
						if (!action.keepOpen) close();
					}}
				>
					{action.label}
				</button>
			) : null}
		</div>
	);
}

/**
 * A row of a popup: the label on the left, a value in mono on the right. With `href` it is a link, with `onClick` a button (both close the popup),
 * and without either it only states something.
 */
export function StatusPopoverRow({
	label,
	value,
	tone = "default",
	href,
	onClick,
	current,
}: {
	label: ReactNode;
	value?: ReactNode;
	tone?: Tone;
	href?: string;
	onClick?: () => void;
	/** Marks the row as the current one (for assistive technology). */
	current?: boolean;
}) {
	const close = useContext(PopoverCloseContext);
	const classes = cn(
		"flex w-full items-baseline justify-between gap-monti-12 px-monti-12 py-monti-4 text-left",
		(href || onClick) && "cursor-pointer outline-none hover:bg-monti-selected focus-visible:bg-monti-selected",
	);
	const body = (
		<>
			<span className={cn("min-w-0 break-words", tone === "default" ? "text-monti-default" : toneClass[tone])}>
				{label}
			</span>
			{value !== undefined && value !== null && (
				<span className="max-w-[60%] shrink-0 break-words text-right font-mono text-monti-muted">{value}</span>
			)}
		</>
	);
	if (href)
		return (
			<AdminLink href={href} aria-current={current ? "true" : undefined} onClick={close} className={classes}>
				{body}
			</AdminLink>
		);
	if (onClick)
		return (
			<button
				type="button"
				aria-current={current ? "true" : undefined}
				onClick={() => {
					onClick();
					close();
				}}
				className={classes}
			>
				{body}
			</button>
		);
	return (
		<div aria-current={current ? "true" : undefined} className={classes}>
			{body}
		</div>
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

/** The popup of the save state: what the state is, when the server last confirmed the entry, and what can be done about it. */
function SavePopover({ editor, now }: { editor: EditorStatus; now: number }) {
	const site = useSite();
	const t = useTranslator(statusBarMessages);
	const status = editor.saveStatus;
	const action =
		status === "dirty" || status === "new"
			? { label: t("popover.save.now"), onClick: editor.save }
			: status === "failed" || status === "local-only"
				? { label: t("popover.save.retry"), onClick: editor.save }
				: status === "session-expired"
					? { label: t("popover.save.signIn"), href: site.adminHref("/login"), newTab: true }
					: undefined;
	return (
		<>
			<StatusPopoverHeader title={t("popover.save.title")} action={action} />
			<StatusPopoverRow label={t("popover.save.status")} value={editor.statusLabel} />
			<StatusPopoverRow label={t("popover.save.changes")} value={t(`save.word.${status}`)} tone={SAVE_TONE[status]} />
			<StatusPopoverRow
				label={t("popover.save.lastSaved")}
				value={
					editor.savedAt === null
						? t("popover.save.never")
						: `${formatDateTime(site, editor.savedAt)} · ${formatAgo(site, editor.savedAt, now)}`
				}
			/>
			{!editor.backupAvailable && <StatusPopoverRow label={t("popover.save.noBackup")} tone="warning" />}
			{editor.recovery && (
				<>
					<StatusPopoverRow label={t("popover.save.restore")} onClick={editor.recovery.restore} />
					<StatusPopoverRow label={t("popover.save.discard")} onClick={editor.recovery.discard} />
				</>
			)}
		</>
	);
}

/** Editor: the lifecycle name and the save state ("Draft · Saved 2 min ago", "Saving…", "Not saved"). Clicking it opens what the state is and what to do about it. */
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
	return (
		<>
			<StatusBarItem tone={SAVE_TONE[status]} title={title} popover={<SavePopover editor={editor} now={now} />}>
				{text}
			</StatusBarItem>
			{/* The time moves every half minute, so only the state is announced. */}
			<output aria-live="polite" className="sr-only">
				{word}
			</output>
		</>
	);
}

/** The popup of the publish readiness: each problem as a to-do that goes to its place, then the warnings, and the way to check again. */
function PublishReadinessPopover({ readiness }: { readiness: NonNullable<EditorStatus["publishReadiness"]> }) {
	const t = useTranslator(publishReadinessMessages);
	const { result, checking, stale } = readiness;
	const row = (issue: CmsIssue, tone: "warning" | "default") => (
		<StatusPopoverRow
			key={JSON.stringify(issue)}
			label={readinessText(t, issue)}
			value={issue.where}
			tone={tone}
			onClick={issueHasPlace(issue) ? () => readiness.focus(issue) : undefined}
		/>
	);
	return (
		<>
			<StatusPopoverHeader
				title={t("title")}
				action={{ label: t("recheck"), onClick: readiness.recheck, keepOpen: true }}
			/>
			{stale && <p className="px-monti-12 py-monti-4 text-monti-muted">{t("staleHint")}</p>}
			{checking && <StatusPopoverRow label={<span className="text-monti-muted">{t("checking")}</span>} />}
			{!checking && result && result.issues.length === 0 && <StatusPopoverRow label={t("nothingToFix")} />}
			{result?.issues.map((issue) => row(issue, "warning"))}
			{result && result.warnings.length > 0 && (
				<>
					<p className="px-monti-12 pt-monti-8 pb-monti-2 text-monti-muted">{t("warningsHeading")}</p>
					{result.warnings.map((issue) => row(issue, "default"))}
				</>
			)}
		</>
	);
}

/**
 * Editor: whether the saved draft is ready to publish ("Ready to publish", "2 to fix before publishing", "Checking…"), from the server's publish check.
 * Its popup lists what to fix and goes to each place. It is not there for an entry that cannot be published or has not been saved yet.
 */
function PublishReadinessItem() {
	const t = useTranslator(publishReadinessMessages);
	const { editor } = useStatusBarContext();
	const readiness = editor?.publishReadiness;
	if (!readiness) return null;
	const { result, checking } = readiness;
	if (!checking && !result) return null;
	const blocking = result?.issues.length ?? 0;
	const warnings = result?.warnings.length ?? 0;
	const word = checking ? t("checking") : blocking > 0 ? t("blocked", { count: blocking }) : t("ready");
	const text = checking || warnings === 0 ? word : `${word} · ${t("warningsSuffix", { count: warnings })}`;
	return (
		<>
			<StatusBarItem
				tone={!checking && blocking > 0 ? "warning" : "default"}
				icon={checking ? <Spinner /> : blocking > 0 ? <WarningAlt /> : <Checkmark />}
				title={t("itemTitle")}
				{...(readiness.open !== undefined && readiness.onOpenChange
					? { open: readiness.open, onOpenChange: readiness.onOpenChange }
					: {})}
				popover={<PublishReadinessPopover readiness={readiness} />}
			>
				{text}
			</StatusBarItem>
			<output aria-live="polite" className="sr-only">
				{word}
			</output>
		</>
	);
}

/** Editor: the language of the entry, in mono. With translations it opens the list of the languages and where each one stands. */
function LocaleItem() {
	const site = useSite();
	const t = useTranslator(statusBarMessages);
	const { editor, locale } = useStatusBarContext();
	if (!editor || !locale) return null;
	const title = t("locale", { label: site.localeLabel(locale) });
	const translations = editor.translations;
	if (!translations) {
		return (
			<StatusBarItem icon={<Translate />} title={title}>
				{locale}
			</StatusBarItem>
		);
	}
	const labels = statusLabels(site);
	return (
		<StatusBarItem
			icon={<Translate />}
			title={title}
			popover={
				<>
					<StatusPopoverHeader title={t("popover.locale.title")} />
					{site.LOCALES.map((target) => {
						const member = translations.find((item) => item.locale === target);
						return member ? (
							<StatusPopoverRow
								key={target}
								label={`${site.localeLabel(target)} (${target})`}
								value={labels[member.status]}
								href={member.current ? undefined : site.adminEntryEditHref(member.id)}
								current={member.current}
							/>
						) : (
							<StatusPopoverRow
								key={target}
								label={`${site.localeLabel(target)} (${target})`}
								value={t("popover.locale.missing")}
							/>
						);
					})}
				</>
			}
		>
			{locale}
		</StatusBarItem>
	);
}

/** Editor: characters (whitespace excluded) and reading time of the body. Opens the other counts. */
function BodyStatsItem() {
	const t = useTranslator(statusBarMessages);
	const { editor } = useStatusBarContext();
	if (!editor) return null;
	const { bodyStats } = editor;
	return (
		<StatusBarItem
			title={t("body.title")}
			popover={
				<>
					<StatusPopoverHeader title={t("popover.body.title")} />
					<StatusPopoverRow label={t("popover.body.chars")} value={editor.charCount.toLocaleString()} />
					<StatusPopoverRow label={t("popover.body.charsSpaces")} value={bodyStats.charsWithSpaces.toLocaleString()} />
					<StatusPopoverRow label={t("popover.body.words")} value={bodyStats.words.toLocaleString()} />
					<StatusPopoverRow label={t("popover.body.paragraphs")} value={bodyStats.paragraphs.toLocaleString()} />
					<StatusPopoverRow label={t("popover.body.headings")} value={bodyStats.headings.toLocaleString()} />
					<StatusPopoverRow label={t("popover.body.reading", { minutes: editor.readingMinutes })} />
					<p className="px-monti-12 py-monti-4 text-monti-muted">
						{t("popover.body.rule", { rate: READING_CHARS_PER_MINUTE })}
					</p>
				</>
			}
		>
			{t("body", { chars: editor.charCount.toLocaleString(), minutes: editor.readingMinutes })}
		</StatusBarItem>
	);
}

/** How many of the latest failures the popup lists. */
const FAILED_LISTED = 5;

/** The popup of failed deliveries: the latest failures from the event log's own query, a retry for all, and the way to the log. */
function FailedDeliveriesPopover() {
	const site = useSite();
	const t = useTranslator(statusBarMessages);
	const te = useTranslator(eventsMessages);
	const { data } = useQuery({
		queryKey: eventsKeys.list("failed", 1, FAILED_LISTED),
		queryFn: ({ signal }) => listEvents(site, "failed", 1, FAILED_LISTED, signal),
		retry: false,
	});
	const retry = useCmsMutation({
		// biome-ignore lint/suspicious/noConfusingVoidType: a mutation without variables, so `mutate()` takes no argument
		fn: (_: void, { site }) => retryAllEvents(site, te("retryAll.failed")),
		success: (result) => te("retryAll.done", { delivered: result.delivered, failed: result.failed, dead: result.dead }),
		failure: te("retryAll.failed"),
		invalidate: [eventsKeys.all],
	});
	return (
		<>
			<StatusPopoverHeader
				title={t("popover.deliveries.title")}
				action={{ label: te("action.retryAll"), onClick: () => retry.mutate() }}
			/>
			{data?.items.map((item) => (
				<StatusPopoverRow
					key={`${item.change.eventId}:${item.subscriber ?? ""}`}
					label={
						<>
							{item.subscriber ?? item.change.kind}
							<span className="block text-monti-muted">
								{item.lastError ?? item.change.title ?? eventCollectionLabel(site, item.change.collection)}
							</span>
						</>
					}
					value={formatAgo(site, item.lastAttemptAt ?? item.change.occurredAt)}
					href={site.adminHref("/tools/events")}
					tone="danger"
				/>
			))}
			<StatusPopoverRow label={t("popover.deliveries.open")} href={site.adminHref("/tools/events")} />
		</>
	);
}

/** Failed and dead event deliveries, from the same count the sidebar badge reads. Opens the latest failures. */
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
			icon={<WarningAlt />}
			title={t("deliveries.title")}
			popover={<FailedDeliveriesPopover />}
		>
			{t("deliveries.failed", { count })}
		</StatusBarItem>
	);
}

/** The core's own items, built with the same declaration a plugin uses. */
const CORE_ITEMS: StatusItems = {
	"core:save": { align: "start", order: 10, Component: SaveStateItem },
	"core:locale": { align: "start", order: 20, Component: LocaleItem },
	"core:body": { align: "start", order: 30, Component: BodyStatsItem },
	"core:publish-readiness": { align: "start", order: 40, Component: PublishReadinessItem },
	"core:deliveries": { align: "start", order: 80, Component: FailedDeliveriesItem },
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
			{/* Drawn only while some item has something to say: on most screens outside the editor that is nothing. */}
			<StatusBarFrame aria-label={t("label")}>
				<AlignContext.Provider value="start">
					{start.map(([name, { Component }]) => (
						<Component key={name} />
					))}
				</AlignContext.Provider>
				<StatusBarSpacer />
				<AlignContext.Provider value="end">
					{end.map(([name, { Component }]) => (
						<Component key={name} />
					))}
				</AlignContext.Provider>
			</StatusBarFrame>
		</StatusBarContext.Provider>
	);
}
