"use client";

// The status bar under the editor. It holds what is nowhere else: the save state, what is left to fix before publishing, the cells plugins fill, and
// the character count. The screens give it the entry's state; a plugin fills its own cell through the slot (`StatusCellsProvider`).

import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	StatusBarAnnouncer,
	StatusBarCell,
	StatusBar as StatusBarFrame,
	StatusBarList,
	StatusBarSpacer,
	TodoDone,
	TodoItem,
} from "@monti-cms/ui";
import { type ComponentType, createContext, type ReactNode, useContext, useMemo, useState } from "react";
import type { TextIssues } from "../../editor/text-check/findings";
import { entryEditorShellMessages } from "../entries/entry-editor-shell.messages";
import type { SaveStatus } from "../entries/entry-editor-types";
import { entriesMessages } from "../entries/messages";
import { formatDateTime } from "./format-date";
import { saveCell } from "./save-cell";
import { statusBarMessages } from "./status-bar.messages";
import type { TodoRow } from "./todo-rows";

/** What a plugin's cell can read about where it is shown: the entry being edited, and what the text checkers found in its body. */
export interface StatusBarContextValue {
	readonly collection: string;
	readonly entryId?: string;
	/** The entry's language: a plugin that checks only some languages draws no cell in the others. */
	readonly locale: string;
	/** What the text checkers found in the body, with the way to fix each; `null` when no checker covers the language. */
	readonly textIssues: TextIssues | null;
}

const StatusBarContext = createContext<StatusBarContextValue>({ collection: "", locale: "", textIssues: null });

/** Where a plugin's cell is shown: the collection, the entry and its language, and what the text checkers found. */
export const useStatusBarContext = (): StatusBarContextValue => useContext(StatusBarContext);

/**
 * The cells plugins fill, by name (`defineAdminPlugin({ statusCells: { spelling: SpellingCell } })`). A cell renders `StatusBarPluginCell`, or `null`
 * to draw nothing.
 */
export type StatusCells = Readonly<Record<string, ComponentType>>;

const StatusCellsContext = createContext<StatusCells>({});

/** Adds a plugin's cells to the ones outside it (inner wins on the same name). */
export function StatusCellsProvider({ cells, children }: { cells: StatusCells; children: ReactNode }) {
	const parent = useContext(StatusCellsContext);
	const value = useMemo(() => ({ ...parent, ...cells }), [parent, cells]);
	return <StatusCellsContext.Provider value={value}>{children}</StatusCellsContext.Provider>;
}

/** The entry's save state. */
export interface SaveCellProps {
	readonly status: SaveStatus;
	/** When the server last confirmed the entry (milliseconds since the epoch); `null` while nothing has been saved. */
	readonly savedAt: number | null;
	/** Whether the browser keeps a recovery copy of the changes. */
	readonly backupAvailable: boolean;
	/** Saves the changes now (the same as Cmd/Ctrl+S); also tries a failed save again. */
	readonly onSave: () => void;
}

function SaveCell({ status, savedAt, backupAvailable, onSave }: SaveCellProps) {
	const site = useSite();
	const t = useTranslator(statusBarMessages);
	const te = useTranslator(entriesMessages);
	const ts = useTranslator(entryEditorShellMessages);
	const { tone, dot, action } = saveCell(status);
	const text =
		status === "saved"
			? savedAt === null
				? t("save.savedNow")
				: t("save.saved", {
						time: formatDateTime(site, savedAt, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
					})
			: t(`save.${status}`);
	// The tooltip is the full sentence of the save state, with a note when the browser keeps no backup.
	const title = `${te(`save.${status}`)}${backupAvailable ? "" : ts("backupUnavailable")}`;
	const cell =
		action === "save" ? (
			<StatusBarCell tone={tone} dot={dot} title={title} onClick={onSave}>
				{text}
			</StatusBarCell>
		) : action === "sign-in" ? (
			<StatusBarCell
				tone={tone}
				dot={dot}
				title={title}
				href={site.adminHref("/login")}
				target="_blank"
				rel="noopener noreferrer"
			>
				{text}
			</StatusBarCell>
		) : (
			<StatusBarCell tone={tone} dot={dot} title={title} render={<span />}>
				{text}
			</StatusBarCell>
		);
	return (
		<>
			{cell}
			{/* The time is not announced, only the state. */}
			<StatusBarAnnouncer>{t(`save.word.${status}`)}</StatusBarAnnouncer>
		</>
	);
}

/** What is left to fix before the entry can be published. */
export interface TodoCellProps {
	/** The rows to fix (`todoRows`): problems of the same kind are one row. */
	readonly rows: readonly TodoRow[];
	/** What is already right, one ✓ row each: the to-dos fixed just now, then the required fields that were never empty in one line. */
	readonly done: readonly string[];
	/** Whether the list is open, so a refused publish can open it. Without `open` and `onOpenChange` the cell keeps that state itself. */
	readonly open?: boolean;
	readonly onOpenChange?: (open: boolean) => void;
}

function TodoCell({ rows, done, open: controlledOpen, onOpenChange }: TodoCellProps) {
	const t = useTranslator(statusBarMessages);
	const [ownOpen, setOwnOpen] = useState(false);
	const open = controlledOpen ?? ownOpen;
	const setOpen = onOpenChange ?? setOwnOpen;
	return (
		<StatusBarList
			open={open}
			onOpenChange={setOpen}
			label={t("todo.title")}
			count={rows.length}
			trigger={
				<StatusBarCell tone={rows.length > 0 ? "warning" : undefined}>
					{rows.length > 0 ? t("todo.count", { count: rows.length }) : t("todo.none")}
				</StatusBarCell>
			}
		>
			{rows.map(({ key, title, detail, onOpen }) => (
				<TodoItem key={key} title={title} detail={detail} onOpen={onOpen} />
			))}
			{done.map((label) => (
				<TodoDone key={label}>{label}</TodoDone>
			))}
		</StatusBarList>
	);
}

export interface StatusBarProps {
	readonly save: SaveCellProps;
	/** `null` for an entry that cannot be published (trashed, archived), one not saved yet, and while there is no answer. */
	readonly todo: TodoCellProps | null;
	/** Characters of the body without whitespace. */
	readonly chars: number;
	readonly context: StatusBarContextValue;
}

/**
 * The bar at the bottom of the editor. Left to right: the save state, the to-do cell, the plugins' cells, then the character count. `context` is what
 * the plugins' cells read through `useStatusBarContext`.
 */
export function StatusBar({ save, todo, chars, context }: StatusBarProps) {
	const t = useTranslator(statusBarMessages);
	const plugins = useContext(StatusCellsContext);
	return (
		<StatusBarContext.Provider value={context}>
			<StatusBarFrame aria-label={t("label")}>
				<SaveCell {...save} />
				{todo && <TodoCell {...todo} />}
				{Object.entries(plugins).map(([name, Cell]) => (
					<Cell key={name} />
				))}
				<StatusBarSpacer />
				<StatusBarCell end render={<span />}>
					{t("chars", { count: chars.toLocaleString() })}
				</StatusBarCell>
			</StatusBarFrame>
		</StatusBarContext.Provider>
	);
}
