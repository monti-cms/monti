"use client";

import type { BulkOp, Folder, Site } from "@monti-cms/core/site";
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
import { useState } from "react";
import type { BulkItemResult, BulkParams, BulkSelection } from "../../api/entries";
import { issueLine } from "../../api/error-message";
import { commonMessages } from "../../lib/common.messages";
import type { TranslatorFor } from "../../translator";
import { ExportDialog } from "../export/export-dialog";
import { exportMessages } from "../export/messages";
import { useConfirm } from "../shared/confirm-dialog";
import { collectionNoun, nounVars } from "../shared/noun.messages";
import { useTaxonomyOptions } from "../shared/use-taxonomy";
import { bulkBarMessages } from "./bulk-bar.messages";

type RelationOp = Extract<BulkOp, `relation.${string}`>;

/**
 * Actions on screen. A category action pairs a relation-field bulk action with a field name, like `relation.add:tagIds`.
 * It is sent to the server as a relation-field bulk action (`relation.*`).
 */
type ListAction = Exclude<BulkOp, RelationOp> | `${RelationOp}:${string}` | "export";

type ActionDef = {
	value: ListAction;
	label: string;
	/**
	 * Question for the confirm dialog. Actions that change many items at once always ask.
	 * `count` is the number picked, `target` is the name of the picked target (folder, category). `null` for an action that clears the target.
	 */
	ask: (count: number, target: string | null) => string;
	content?: boolean;
	destructive?: boolean;
	/** The relation field, for a category action. */
	relation?: { op: RelationOp; field: string; label: string; many: boolean };
};

/**
 * Actions per category field (tags, categories, etc.) of the collection. Fields that hold many get add/remove; a field that holds only one gets replace.
 * Multi-value field actions come first.
 */
export function taxonomyActions(site: Site, collection: string): ActionDef[] {
	const t = site.createTranslator(bulkBarMessages);
	const noun = nounVars(site, collection);
	const fields = site
		.taxonomyFieldsOf(collection)
		.flatMap((stored) =>
			stored.field.kind === "relation"
				? [{ name: stored.name, label: stored.field.label, many: stored.field.many === true }]
				: [],
		);
	const action = (op: RelationOp, field: (typeof fields)[number], ask: ActionDef["ask"]): ActionDef => ({
		value: `${op}:${field.name}`,
		label: t(op, { label: field.label }),
		ask,
		relation: { op, field: field.name, label: field.label, many: field.many },
	});
	return [
		...fields
			.filter((field) => field.many)
			.flatMap((field) => [
				action("relation.add", field, (count, target) =>
					t("ask.relation.add", { count, ...noun, label: field.label, target: target ?? "" }),
				),
				action("relation.remove", field, (count, target) =>
					t("ask.relation.remove", { count, ...noun, label: field.label, target: target ?? "" }),
				),
			]),
		...fields
			.filter((field) => !field.many)
			.map((field) =>
				action("relation.set", field, (count, target) =>
					target === null
						? t("ask.relation.clear", { count, ...noun, label: field.label })
						: t("ask.relation.set", { count, ...noun, label: field.label, target }),
				),
			),
	];
}

const listActions = (
	t: TranslatorFor<typeof bulkBarMessages>,
	tc: TranslatorFor<typeof commonMessages>,
	tx: TranslatorFor<typeof exportMessages>,
	noun: { noun: string },
): ActionDef[] => [
	{
		value: "folder.move",
		label: t("folder.move"),
		ask: (count, target) =>
			target === null ? t("ask.folder.root", { count }) : t("ask.folder.move", { count, target }),
	},
	{
		value: "publish",
		label: tc("lifecycle.publish"),
		ask: (count) => t("ask.publish", { count, ...noun }),
		content: true,
	},
	{
		value: "archive",
		label: tc("lifecycle.archive"),
		ask: (count) => t("ask.archive", { count, ...noun }),
		content: true,
	},
	{
		value: "unarchive",
		label: tc("lifecycle.unarchive"),
		ask: (count) => t("ask.unarchive", { count, ...noun }),
		content: true,
	},
	// Not a change to the entries: it opens the export dialog, which says what goes in and asks for the rest.
	{ value: "export", label: tx("action.selected"), ask: () => "" },
	{ value: "trash", label: tc("lifecycle.trash"), ask: (count) => t("ask.trash", { count }), destructive: true },
];

const trashActions = (
	t: TranslatorFor<typeof bulkBarMessages>,
	tc: TranslatorFor<typeof commonMessages>,
): ActionDef[] => [
	{
		value: "permanentDelete",
		label: tc("lifecycle.deletePermanently"),
		ask: (count) => t("ask.permanentDelete", { count }),
		destructive: true,
	},
];

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
 * What the bar offers for the rows picked, by what can be done to them: the two used most as buttons (publish, move to a folder), the rest in the ⋯
 * with the trash last. Anything that cannot be done to these rows is left out instead of dimmed: a collection of items is not published or
 * archived, a list without folders has no folder to move to, and a pick of only archived rows is not published or archived again.
 */
export function bulkActionsFor({
	site,
	collection,
	mode,
	selected,
	hasFolders,
}: {
	site: Site;
	collection: string;
	mode: "list" | "trash";
	selected: readonly BulkSelection[];
	hasFolders: boolean;
}): { primary: ListAction[]; more: ListAction[] } {
	if (mode === "trash") return { primary: ["permanentDelete"], more: [] };
	const documents = !site.isItemCollection(collection);
	const states = new Set(selected.map((item) => item.status));
	const onlyArchived = states.size > 0 && [...states].every((state) => state === "archived");
	const noneArchived = !states.has("archived");
	return {
		primary: [
			...(documents && !onlyArchived ? (["publish"] as const) : []),
			...(hasFolders ? (["folder.move"] as const) : []),
		],
		more: [
			...taxonomyActions(site, collection).map((action) => action.value),
			...(documents && !onlyArchived ? (["archive"] as const) : []),
			...(documents && !noneArchived ? (["unarchive"] as const) : []),
			"export",
			"trash",
		],
	};
}

/**
 * The bar that replaces the list's toolbar once rows are picked: how many, the two actions used most, a ⋯ with the rest, and the way to let go.
 * Every action on several rows asks first. A choice of a folder, tag or category is a row in a menu, so it is picked and applied in one step.
 * Applies only to the rows picked on this page.
 */
export function BulkBar({
	collection,
	selected,
	held = {},
	folders,
	mode = "list",
	selectAll,
	onClearSelection,
	onRun,
}: {
	collection: string;
	selected: BulkSelection[];
	/** The ids each relation field holds across the picked rows: a remove menu offers only those. */
	held?: Readonly<Record<string, ReadonlySet<string>>>;
	/** The folders items can move to; `null` where the list shows no folders, which leaves out the folder move. */
	folders: readonly Folder[] | null;
	mode?: "list" | "trash";
	/** The select-all check that stays where it was in the toolbar. */
	selectAll?: { state: SelectAllState; onChange: (all: boolean) => void; label: string };
	onClearSelection: () => void;
	/** Applies an action to the picked rows and tells the writer how it went. */
	onRun: (op: BulkOp, label: string, targets: BulkSelection[], params?: BulkParams) => Promise<void> | void;
}) {
	const site = useSite();
	const t = useTranslator(bulkBarMessages);
	const tc = useTranslator(commonMessages);
	const tx = useTranslator(exportMessages);
	const [isExporting, setIsExporting] = useState(false);
	const { confirm, dialog } = useConfirm();
	const options = useTaxonomyOptions(collection, mode === "list");

	const all = [
		...taxonomyActions(site, collection),
		...listActions(t, tc, tx, nounVars(site, collection)),
		...trashActions(t, tc),
	];
	const definition = (action: ListAction) => all.find((candidate) => candidate.value === action);
	const { primary, more } = bulkActionsFor({
		site,
		collection,
		mode,
		selected,
		hasFolders: folders !== null,
	});

	if (selected.length === 0) return null;

	/** Asks, then applies. `target` names the folder, tag or category picked; `params` is what the server needs to apply it. */
	const apply = async (action: ListAction, target: string | null, params: BulkParams = {}) => {
		const def = definition(action);
		if (!def) return;
		if (def.value === "export") {
			setIsExporting(true);
			return;
		}
		const ok = await confirm({
			title: def.label,
			description: def.ask(selected.length, target),
			confirmLabel: def.label,
			destructive: def.destructive,
		});
		if (ok) await onRun(def.relation?.op ?? (def.value as BulkOp), def.label, selected, params);
	};

	const relationItems = (action: ListAction) => {
		const relation = definition(action)?.relation;
		if (!relation) return null;
		const offered = options[relation.field] ?? [];
		const items =
			relation.op === "relation.remove" ? offered.filter((item) => held[relation.field]?.has(item.id)) : offered;
		// Nothing to add or take away: the row is left out rather than opening an empty menu.
		if (items.length === 0 && relation.op !== "relation.set") return null;
		return (
			<DropdownMenuSub key={action}>
				<DropdownMenuSubTrigger>{definition(action)?.label}</DropdownMenuSubTrigger>
				<DropdownMenuSubContent>
					{relation.op === "relation.set" && (
						<>
							<DropdownMenuItem onClick={() => void apply(action, null, { field: relation.field, id: null })}>
								{t("option.none")}
							</DropdownMenuItem>
							{items.length > 0 && <DropdownMenuSeparator />}
						</>
					)}
					{items.map((item) => (
						<DropdownMenuItem
							key={item.id}
							onClick={() =>
								void apply(
									action,
									item.title,
									relation.op === "relation.set"
										? { field: relation.field, id: item.id }
										: { field: relation.field, ids: [item.id] },
								)
							}
						>
							{item.title}
						</DropdownMenuItem>
					))}
				</DropdownMenuSubContent>
			</DropdownMenuSub>
		);
	};

	const menuRow = (action: ListAction) => {
		const def = definition(action);
		if (!def) return null;
		if (def.relation) return relationItems(action);
		return (
			<DropdownMenuItem
				key={action}
				variant={def.destructive ? "danger" : "default"}
				onClick={() => void apply(action, null)}
			>
				{def.label}
			</DropdownMenuItem>
		);
	};
	/** The ⋯ rows: the dangerous one last, after a rule. */
	const quiet = more.filter((action) => !definition(action)?.destructive);
	const dangerous = more.filter((action) => definition(action)?.destructive);

	return (
		<>
			<BulkBarFrame
				label={t("count", { count: selected.length })}
				clearLabel={t("clear")}
				onClear={onClearSelection}
				selectAll={selectAll}
				more={
					more.length > 0
						? {
								label: t("more"),
								children: (
									<>
										{quiet.map(menuRow)}
										{dangerous.length > 0 && quiet.length > 0 && <DropdownMenuSeparator />}
										{dangerous.map(menuRow)}
									</>
								),
							}
						: undefined
				}
			>
				{primary.map((action) => {
					const def = definition(action);
					if (!def) return null;
					if (action === "folder.move") {
						return (
							<DropdownMenu key={action}>
								<DropdownMenuTrigger render={<TextButton type="button" />}>
									{def.label}
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
					return (
						<TextButton
							key={action}
							type="button"
							variant={def.destructive ? "danger" : "plain"}
							onClick={() => void apply(action, null)}
						>
							{def.label}
						</TextButton>
					);
				})}
			</BulkBarFrame>
			{dialog}
			<ExportDialog
				open={isExporting}
				onOpenChange={setIsExporting}
				kind="selected"
				ids={selected.map((item) => item.id)}
				noun={collectionNoun(site, collection)}
			/>
		</>
	);
}
