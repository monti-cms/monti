"use client";

import type { BulkOp, Folder, ListEntriesItem, Site } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	BulkBar as BulkBarFrame,
	Caret,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	type SelectAllState,
	TextButton,
} from "@monti-cms/ui";
import type { BulkItemResult, BulkParams, BulkSelection } from "../../api/entries";
import { issueLine } from "../../api/error-message";
import { commonMessages } from "../../lib/common.messages";
import { exportMessages } from "../export/messages";
import { useConfirm } from "../shared/confirm-dialog";
import { nounVars } from "../shared/noun.messages";
import { bulkBarMessages } from "./bulk-bar.messages";
import { archiveAction, canPublish, changeableRelations, toSelection } from "./bulk-model";
import { RelationChoice } from "./relation-choice";

/** Failure reason per action ("distinguish success from failure and rerun only failed items"). Only codes in the dictionary have text. */
const FAILURE_CODES = new Set([
	"conflict",
	"not_found",
	"invalid_input",
	"invalid_status",
	"publish_validation_failed",
	"slug_conflict",
	"in_use",
	"invalid_reference",
]);

/** Reason for a single failure. If a usage blocked permanent deletion, names it as `In use: <name>`. */
export function describeBulkFailure(site: Site, failure: Extract<BulkItemResult, { ok: false }>): string {
	const t = site.createTranslator(bulkBarMessages);
	const tc = site.createTranslator(commonMessages);
	if (failure.error === "in_use" && failure.usages?.length) {
		const names = [...new Set(failure.usages.map((usage) => usage.title || tc("untitled")))];
		const shown = names.slice(0, 3).join(", ");
		return t("failure.usedBy", {
			names: names.length > 3 ? t("failure.more", { names: shown, more: names.length - 3 }) : shown,
		});
	}
	const base = FAILURE_CODES.has(failure.error) ? t(`failure.${failure.error}` as "failure.conflict") : failure.error;
	return failure.issues?.length
		? `${base} ${failure.issues
				.slice(0, 3)
				.map((issue) => issueLine(issue))
				.join(" ")}`
		: base;
}

/**
 * What the bar offers for the rows picked, by what can be done to them: publish (when something is left to publish), archive (or take the archive off when
 * every row is archived), a folder to move to, and a Change menu for the relations; the ⋯ has export and, last, the trash. Anything that cannot be done to these
 * rows is left out instead of dimmed: a collection of items is not published or archived, a list without folders has no folder to move to, a collection
 * with no relation field has nothing to change. The trash offers only the permanent delete.
 */
export function bulkActionsFor({
	site,
	collection,
	mode,
	rows,
	hasFolders,
}: {
	site: Site;
	collection: string;
	mode: "list" | "trash";
	rows: readonly ListEntriesItem[];
	hasFolders: boolean;
}): { primary: ("publish" | "archive" | "unarchive" | "folder.move" | "change")[]; more: ("export" | "trash")[] } {
	if (mode === "trash") return { primary: [], more: [] };
	const documents = !site.isItemCollection(collection);
	return {
		primary: [
			...(documents && canPublish(rows) ? (["publish"] as const) : []),
			...(documents ? [archiveAction(rows)] : []),
			...(hasFolders ? (["folder.move"] as const) : []),
			...(changeableRelations(site, collection).length > 0 ? (["change"] as const) : []),
		],
		more: ["export", "trash"],
	};
}

type Confirmed = "publish" | "archive" | "unarchive" | "folder.move" | "trash" | "permanentDelete";

/**
 * The bar that replaces the list's head row once rows are picked: how many, the actions that fit these rows, a ⋯ with export and the trash, and the way to
 * let go. Publish, archive, a folder, the trash and the permanent delete ask first; a change of a relation (the Change menu) does not: it is a box in a list
 * that undoes itself. Applies only to the rows picked on this page.
 */
export function BulkBar({
	collection,
	rows,
	folders,
	mode = "list",
	selectAll,
	colSpan,
	onClearSelection,
	onRun,
	onExport,
	onRestore,
}: {
	collection: string;
	/** The rows picked. */
	rows: readonly ListEntriesItem[];
	/** The folders items can move to; `null` where the list shows no folders, which leaves out the folder move. */
	folders: readonly Folder[] | null;
	mode?: "list" | "trash";
	/** The select-all check that moves onto the bar. */
	selectAll?: { state: SelectAllState; onChange: (all: boolean) => void; label: string };
	/** How many columns the list's table has, the ⋯ column included. */
	colSpan: number;
	onClearSelection: () => void;
	/** Applies an action to the picked rows and tells the writer how it went. */
	onRun: (op: BulkOp, label: string, targets: BulkSelection[], params?: BulkParams) => Promise<void> | void;
	/** Opens the export of the picked rows. */
	onExport: (ids: string[]) => void;
	/** Restores the picked rows from the trash. */
	onRestore: (targets: BulkSelection[]) => void;
}) {
	const site = useSite();
	const t = useTranslator(bulkBarMessages);
	const tc = useTranslator(commonMessages);
	const tx = useTranslator(exportMessages);
	const { confirm, dialog } = useConfirm();
	const selected = rows.map(toSelection);
	const noun = nounVars(site, collection);
	const { primary, more } = bulkActionsFor({ site, collection, mode, rows, hasFolders: folders !== null });
	if (rows.length === 0) return null;

	/** What each action that asks says: its name, its question and whether it is the dangerous kind. */
	const asks: Record<Confirmed, { label: string; ask: (target: string | null) => string; destructive?: boolean }> = {
		publish: { label: tc("lifecycle.publish"), ask: () => t("ask.publish", { count: rows.length, ...noun }) },
		archive: { label: tc("lifecycle.archive"), ask: () => t("ask.archive", { count: rows.length, ...noun }) },
		unarchive: { label: tc("lifecycle.unarchive"), ask: () => t("ask.unarchive", { count: rows.length, ...noun }) },
		"folder.move": {
			label: t("folder.move"),
			ask: (target) =>
				target === null
					? t("ask.folder.root", { count: rows.length })
					: t("ask.folder.move", { count: rows.length, target }),
		},
		trash: { label: tc("lifecycle.trash"), ask: () => t("ask.trash", { count: rows.length }), destructive: true },
		permanentDelete: {
			label: tc("lifecycle.deletePermanently"),
			ask: () => t("ask.permanentDelete", { count: rows.length }),
			destructive: true,
		},
	};
	const apply = async (action: Confirmed, target: string | null = null, params: BulkParams = {}) => {
		const { label, ask, destructive } = asks[action];
		const ok = await confirm({ title: label, description: ask(target), confirmLabel: label, destructive });
		if (ok) await onRun(action, label, selected, params);
	};

	const button = (action: Confirmed) => (
		<TextButton key={action} variant={asks[action].destructive ? "danger" : "plain"} onClick={() => void apply(action)}>
			{asks[action].label}
		</TextButton>
	);
	const relations = changeableRelations(site, collection);
	const actions = [
		...(mode === "trash"
			? [
					<TextButton key="restore" onClick={() => onRestore(selected)}>
						{tc("lifecycle.restore")}
					</TextButton>,
					button("permanentDelete"),
				]
			: []),
		...primary.map((action) => {
			if (action === "folder.move") {
				return (
					<DropdownMenu key={action}>
						<DropdownMenuTrigger render={<TextButton />}>
							{asks["folder.move"].label}
							<Caret />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							<DropdownMenuItem onClick={() => void apply(action, null, { folderId: null })}>
								{t("option.root")}
							</DropdownMenuItem>
							{(folders ?? []).map((folder) => (
								<DropdownMenuItem
									key={folder.id}
									onClick={() => void apply(action, folder.name, { folderId: folder.id })}
								>
									{folder.name}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				);
			}
			if (action === "change") {
				return (
					<DropdownMenu key={action}>
						<DropdownMenuTrigger render={<TextButton />}>
							{t("change")}
							<Caret />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							{relations.map((field) => (
								<DropdownMenuSub key={field.name}>
									<DropdownMenuSubTrigger>{field.label}</DropdownMenuSubTrigger>
									<DropdownMenuSubContent>
										<RelationChoice field={field} rows={rows} onRun={onRun} />
									</DropdownMenuSubContent>
								</DropdownMenuSub>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				);
			}
			return button(action);
		}),
	];

	return (
		<>
			<BulkBarFrame
				colSpan={colSpan}
				label={t("count", { count: rows.length })}
				clearLabel={t("clear")}
				onClear={onClearSelection}
				selectAll={selectAll}
				more={
					more.length > 0
						? {
								label: t("more"),
								children: (
									<>
										<DropdownMenuItem onClick={() => onExport(rows.map((row) => row.id))}>
											{tx("action.selected")}
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem variant="danger" onClick={() => void apply("trash")}>
											{asks.trash.label}
										</DropdownMenuItem>
									</>
								),
							}
						: undefined
				}
			>
				{actions.length > 0 ? actions : undefined}
			</BulkBarFrame>
			{dialog}
		</>
	);
}
