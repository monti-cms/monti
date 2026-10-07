"use client";

import type { BulkOp, Site } from "@monti-cms/core/client";
import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import type { Folder } from "@monti-cms/core/runtime";
import { ChevronDownIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../../lib/utils/cn";
import type { TranslatorFor } from "../../translator";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { cmsFetch, errorText } from "../admin-api";
import { type CmsIssue, cmsIssueMessage } from "../api-error-message";
import { ConfirmDialog, type ConfirmRequest } from "../shared/confirm-dialog";
import { nounVars } from "../shared/noun.messages";
import { useTaxonomyOptions } from "../shared/use-taxonomy";
import { bulkBarMessages } from "./bulk-bar.messages";

export type BulkUsage = { entryId: string; title: string | null; collection: string; state: string };

export type BulkItemResult =
	| { id: string; ok: true; version: number }
	| { id: string; ok: false; error: string; issues?: CmsIssue[]; usages?: BulkUsage[] };

export type BulkSelection = { id: string; expectedVersion: number; title?: string | null };

type RunBulkArgs = Parameters<typeof runBulk> extends [unknown, ...infer Rest] ? Rest : never;

type RelationOp = Extract<BulkOp, `relation.${string}`>;

/**
 * Actions on screen. A category action pairs a relation-field bulk action with a field name, like `relation.add:tagIds`.
 * It is sent to the server as a relation-field bulk action (`relation.*`).
 */
type ListAction = Exclude<BulkOp, RelationOp> | `${RelationOp}:${string}`;

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

const listActions = (t: TranslatorFor<typeof bulkBarMessages>, noun: { noun: string }): ActionDef[] => [
	{
		value: "folder.move",
		label: t("folder.move"),
		ask: (count, target) =>
			target === null ? t("ask.folder.root", { count }) : t("ask.folder.move", { count, target }),
	},
	{ value: "publish", label: t("publish"), ask: (count) => t("ask.publish", { count, ...noun }), content: true },
	{ value: "archive", label: t("archive"), ask: (count) => t("ask.archive", { count, ...noun }), content: true },
	{ value: "unarchive", label: t("unarchive"), ask: (count) => t("ask.unarchive", { count, ...noun }), content: true },
	{ value: "trash", label: t("trash"), ask: (count) => t("ask.trash", { count }), destructive: true },
];

const trashActions = (t: TranslatorFor<typeof bulkBarMessages>): ActionDef[] => [
	{
		value: "permanentDelete",
		label: t("permanentDelete"),
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
	if (failure.error === "in_use" && failure.usages?.length) {
		const names = [...new Set(failure.usages.map((usage) => usage.title || t("untitled")))];
		const shown = names.slice(0, 3).join(", ");
		return t("failure.usedBy", {
			names: names.length > 3 ? t("failure.more", { names: shown, more: names.length - 3 }) : shown,
		});
	}
	const base = FAILURE_CODES.has(failure.error) ? t(`failure.${failure.error}` as "failure.conflict") : failure.error;
	return failure.issues?.length
		? `${base} ${failure.issues
				.slice(0, 3)
				.map((issue) => cmsIssueMessage(site, issue))
				.join(" ")}`
		: base;
}

export async function runBulk(
	site: Site,
	op: BulkOp,
	items: BulkSelection[],
	params: { field?: string; ids?: string[]; id?: string | null; folderId?: string | null } = {},
): Promise<BulkItemResult[]> {
	const data = await cmsFetch<{ results: BulkItemResult[] }>(site, cmsApiUrl("/v1/bulk"), {
		method: "POST",
		json: { op, items: items.map(({ id, expectedVersion }) => ({ id, expectedVersion })), ...params },
		fallback: site.createTranslator(bulkBarMessages)("requestFailed"),
	});
	return data.results;
}

/**
 * Multi-category (tags, etc.) picker in the bulk action row. A single small button like the folder and category pickers; pressing it opens search and a checklist.
 * The button shows picked items shortened like `React +2`, so the row does not overflow.
 */
function ManyPicker({
	label,
	options,
	value,
	onValueChange,
}: {
	label: string;
	options: readonly { id: string; title: string }[];
	value: string[];
	onValueChange: (value: string[]) => void;
}) {
	const t = useTranslator(bulkBarMessages);
	const names = value.map((id) => options.find((option) => option.id === id)?.title ?? id);
	const summary =
		names.length === 0
			? t("picker.select", { label })
			: names.length === 1
				? names[0]
				: t("picker.more", { first: names[0] ?? "", more: names.length - 1 });
	const toggle = (id: string) =>
		onValueChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button
						type="button"
						variant="outline"
						size="sm"
						aria-label={t("picker.aria", { label, names: names.length === 0 ? t("picker.none") : names.join(", ") })}
						className={cn(
							"max-w-56 justify-between gap-1.5 font-normal",
							names.length === 0 && "text-cms-muted-foreground",
						)}
					/>
				}
			>
				<span className="truncate">{summary}</span>
				<ChevronDownIcon aria-hidden className="size-4 text-cms-muted-foreground" />
			</PopoverTrigger>
			<PopoverContent align="start" className="w-64 p-0">
				<Command>
					<CommandInput placeholder={t("picker.search", { label })} aria-label={t("picker.search", { label })} />
					<CommandList className="max-h-64">
						<CommandEmpty>{t("picker.empty", { label })}</CommandEmpty>
						<CommandGroup>
							{options.map((option) => (
								<CommandItem key={option.id} value={`${option.title} ${option.id}`} onSelect={() => toggle(option.id)}>
									<Checkbox
										checked={value.includes(option.id)}
										tabIndex={-1}
										aria-hidden
										className="pointer-events-none"
									/>
									{option.title}
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

/**
 * Bulk actions. Apply only to items picked on the current page and show a result per item.
 * Only failed items can be rerun. The trash screen (`mode="trash"`) offers only bulk permanent delete.
 */
export function BulkBar({
	collection,
	selected,
	folders,
	mode = "list",
	onClearSelection,
	onRun,
	onDone,
}: {
	collection: string;
	selected: BulkSelection[];
	folders: Folder[];
	mode?: "list" | "trash";
	onClearSelection: () => void;
	/** Action request. The list screen passes a request that updates the list first (optimistic update). */
	onRun?: (...args: RunBulkArgs) => ReturnType<typeof runBulk>;
	onDone?: (failedIds: string[]) => void;
}) {
	const site = useSite();
	const t = useTranslator(bulkBarMessages);
	const isRecord = site.isItemCollection(collection);
	const actions = useMemo(
		() =>
			mode === "trash"
				? trashActions(t)
				: [
						...taxonomyActions(site, collection),
						...listActions(t, nounVars(site, collection)).filter((action) => !action.content || !isRecord),
					],
		[isRecord, collection, mode, site, t],
	);
	const [action, setAction] = useState<ListAction>(actions[0]?.value ?? "trash");
	const [checked, setChecked] = useState<string[]>([]);
	const [single, setSingle] = useState("");
	const [isRunning, setIsRunning] = useState(false);
	const [results, setResults] = useState<BulkItemResult[] | null>(null);
	const [ranItems, setRanItems] = useState<BulkSelection[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
	const options = useTaxonomyOptions(collection, mode === "list");

	useEffect(() => {
		if (!actions.some((candidate) => candidate.value === action)) setAction(actions[0]?.value ?? "trash");
	}, [actions, action]);

	// Changing the action clears that action's input value.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset keyed by action
	useEffect(() => {
		setChecked([]);
		setSingle("");
		setError(null);
	}, [action]);

	const activeAction = actions.find((candidate) => candidate.value === action);
	const relation = activeAction?.relation;
	const needsMany = relation !== undefined && relation.op !== "relation.set";
	const needsSingle = relation?.op === "relation.set" || action === "folder.move";
	const relationOptions = relation ? (options[relation.field] ?? []) : [];
	const canRun =
		!isRunning && selected.length > 0 && (needsMany ? checked.length > 0 : needsSingle ? single !== "" : true);

	const run = async (items: BulkSelection[]) => {
		setIsRunning(true);
		setError(null);
		try {
			const params = needsMany
				? { field: relation.field, ids: checked }
				: relation
					? { field: relation.field, id: single === "__none__" ? null : single }
					: action === "folder.move"
						? { folderId: single === "__unfiled__" ? null : single }
						: {};
			const out = await (onRun ?? ((...args: RunBulkArgs) => runBulk(site, ...args)))(
				relation?.op ?? (action as BulkOp),
				items,
				params,
			);
			setResults(out);
			setRanItems(items);
			onDone?.(out.filter((result) => !result.ok).map((result) => result.id));
		} catch (err) {
			setError(errorText(site, err, t("failed")));
		} finally {
			setIsRunning(false);
		}
	};

	/** Name of the picked target. For categories, the picked names; for a folder, the folder name. `null` for a clearing selection. */
	const targetName = (): string | null => {
		const titleOf = (id: string) => relationOptions.find((option) => option.id === id)?.title ?? id;
		if (needsMany) return checked.map(titleOf).join(", ");
		if (relation) return single === "__none__" ? null : titleOf(single);
		if (action === "folder.move")
			return single === "__unfiled__" ? null : (folders.find((folder) => folder.id === single)?.name ?? single);
		return null;
	};

	// Actions that change many items at once always ask.
	const start = () => {
		if (!activeAction) return;
		setConfirm({
			title: activeAction.label,
			description: activeAction.ask(selected.length, targetName()),
			confirmLabel: activeAction.label,
			destructive: activeAction.destructive,
			onConfirm: () => run(selected),
		});
	};

	const failures = (results ?? []).filter((result): result is Extract<BulkItemResult, { ok: false }> => !result.ok);
	const successes = (results ?? []).length - failures.length;
	const titleOf = (id: string) => ranItems.find((item) => item.id === id)?.title || id.slice(0, 8);

	if (selected.length === 0 && !results) return null;

	const singleItems = relation
		? [
				{ value: "__none__", label: t("option.none") },
				...relationOptions.map((option) => ({ value: option.id, label: option.title })),
			]
		: [
				{ value: "__unfiled__", label: t("option.root") },
				...folders.map((folder) => ({ value: folder.id, label: folder.name })),
			];

	return (
		<section aria-label={t("bar")} className="border-b bg-cms-primary/5 px-5 py-2">
			<div className="flex min-h-7 flex-wrap items-center gap-2 text-sm">
				<span className="font-medium text-cms-primary">{t("count", { count: selected.length })}</span>
				<Button type="button" variant="ghost" size="xs" onClick={onClearSelection}>
					{t("clear")}
				</Button>

				{actions.length > 1 ? (
					<Select
						value={action}
						items={actions.map((candidate) => ({ value: candidate.value, label: candidate.label }))}
						onValueChange={(value) => value && setAction(value as ListAction)}
					>
						<SelectTrigger size="sm" aria-label={t("kind")}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{actions.map((candidate) => (
								<SelectItem key={candidate.value} value={candidate.value}>
									{candidate.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : null}

				{needsMany && (
					<ManyPicker label={relation.label} options={relationOptions} value={checked} onValueChange={setChecked} />
				)}

				{needsSingle && (
					<Select
						value={single || null}
						items={singleItems}
						onValueChange={(value) => setSingle(typeof value === "string" ? value : "")}
					>
						<SelectTrigger
							size="sm"
							aria-label={relation ? t("target.aria", { label: relation.label }) : t("folder.aria")}
						>
							<SelectValue
								placeholder={relation ? t("picker.select", { label: relation.label }) : t("folder.select")}
							/>
						</SelectTrigger>
						<SelectContent>
							{singleItems.map((item) => (
								<SelectItem key={item.value} value={item.value}>
									{item.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}

				<Button
					type="button"
					size="sm"
					variant={activeAction?.destructive ? "destructive" : "default"}
					disabled={!canRun}
					onClick={start}
				>
					{isRunning ? t("running") : (activeAction?.label ?? t("run"))}
				</Button>

				{results && (
					<output className="text-cms-muted-foreground text-xs">
						{t("result", { success: successes, failed: failures.length })}
					</output>
				)}
				{failures.length > 0 && (
					<Button
						type="button"
						variant="outline"
						size="xs"
						onClick={() => void run(ranItems.filter((item) => failures.some((failure) => failure.id === item.id)))}
					>
						{t("retry")}
					</Button>
				)}
			</div>

			{error && (
				<p role="alert" className="pt-2 text-cms-destructive text-xs">
					{error}
				</p>
			)}
			{failures.length > 0 && (
				<ul className="flex flex-col gap-1 pt-2 text-cms-destructive text-xs">
					{failures.map((failure) => (
						<li key={failure.id}>
							<span className="font-medium">{titleOf(failure.id)}</span> — {describeBulkFailure(site, failure)}
						</li>
					))}
				</ul>
			)}
			<ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
		</section>
	);
}
