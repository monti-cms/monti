"use client";

import type { BulkOp } from "@monti-cms/core/client";
import { cmsApiUrl, createTranslator, isItemCollection, taxonomyFieldsOf } from "@monti-cms/core/client";
import type { Folder } from "@monti-cms/core/runtime";
import { ChevronDownIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../../lib/utils/cn";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { cmsFetch, errorText } from "../admin-api";
import { type CmsIssue, cmsIssueMessage } from "../api-error-message";
import { ConfirmDialog, type ConfirmRequest } from "../shared/confirm-dialog";
import { useTaxonomyOptions } from "../shared/use-taxonomy";
import { bulkBarMessages } from "./bulk-bar.messages";

const t = createTranslator(bulkBarMessages);

export type BulkUsage = { entryId: string; title: string | null; collection: string; state: string };

export type BulkItemResult =
	| { id: string; ok: true; version: number }
	| { id: string; ok: false; error: string; issues?: CmsIssue[]; usages?: BulkUsage[] };

export type BulkSelection = { id: string; expectedVersion: number; title?: string | null };

type RelationOp = Extract<BulkOp, `relation.${string}`>;

/**
 * 화면의 작업. 분류 작업은 `relation.add:tagIds`처럼 관계 필드 일괄 작업과 필드 이름을 함께 적는다.
 * 서버에는 관계 필드 일괄 작업(`relation.*`)으로 보낸다.
 */
type ListAction = Exclude<BulkOp, RelationOp> | `${RelationOp}:${string}`;

type ActionDef = {
	value: ListAction;
	label: string;
	/**
	 * 확인창의 질문. 여러 개를 한 번에 바꾸는 작업은 모두 묻는다(§5).
	 * `count`는 고른 수, `target`은 고른 대상 이름(폴더·분류). 대상을 비우는 작업이면 `null`.
	 */
	ask: (count: number, target: string | null) => string;
	content?: boolean;
	destructive?: boolean;
	/** 분류 작업이면 관계 필드. */
	relation?: { op: RelationOp; field: string; label: string; many: boolean };
};

/**
 * 컬렉션의 분류 필드(태그·카테고리 등)별 작업. 여러 개 필드는 추가·빼기, 하나뿐인 필드는 바꾸기다.
 * 여러 개 필드 작업을 먼저 둔다.
 */
export function taxonomyActions(collection: string): ActionDef[] {
	const fields = taxonomyFieldsOf(collection).flatMap((stored) =>
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
					t("ask.relation.add", { count, label: field.label, target: target ?? "" }),
				),
				action("relation.remove", field, (count, target) =>
					t("ask.relation.remove", { count, label: field.label, target: target ?? "" }),
				),
			]),
		...fields
			.filter((field) => !field.many)
			.map((field) =>
				action("relation.set", field, (count, target) =>
					target === null
						? t("ask.relation.clear", { count, label: field.label })
						: t("ask.relation.set", { count, label: field.label, target }),
				),
			),
	];
}

const LIST_ACTIONS: ActionDef[] = [
	{
		value: "folder.move",
		label: t("folder.move"),
		ask: (count, target) =>
			target === null ? t("ask.folder.root", { count }) : t("ask.folder.move", { count, target }),
	},
	{ value: "publish", label: t("publish"), ask: (count) => t("ask.publish", { count }), content: true },
	{ value: "archive", label: t("archive"), ask: (count) => t("ask.archive", { count }), content: true },
	{ value: "unarchive", label: t("unarchive"), ask: (count) => t("ask.unarchive", { count }), content: true },
	{ value: "trash", label: t("trash"), ask: (count) => t("ask.trash", { count }), destructive: true },
];

const TRASH_ACTIONS: ActionDef[] = [
	{
		value: "permanentDelete",
		label: t("permanentDelete"),
		ask: (count) => t("ask.permanentDelete", { count }),
		destructive: true,
	},
];

/** 작업별 실패 사유(§3.4 "성공·실패를 구분하고 실패한 항목만 다시 실행"). 사전에 있는 코드만 문구가 있다. */
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

/** 실패 한 건의 사유. 영구 삭제를 막은 사용처가 있으면 `사용 중: ○○`으로 이름을 댄다(v2 A3). */
export function describeBulkFailure(failure: Extract<BulkItemResult, { ok: false }>): string {
	if (failure.error === "in_use" && failure.usages?.length) {
		const names = [...new Set(failure.usages.map((usage) => usage.title || t("untitled")))];
		const shown = names.slice(0, 3).join(", ");
		return t("failure.usedBy", {
			names: names.length > 3 ? t("failure.more", { names: shown, more: names.length - 3 }) : shown,
		});
	}
	const base = FAILURE_CODES.has(failure.error) ? t(`failure.${failure.error}` as "failure.conflict") : failure.error;
	return failure.issues?.length ? `${base} ${failure.issues.slice(0, 3).map(cmsIssueMessage).join(" ")}` : base;
}

export async function runBulk(
	op: BulkOp,
	items: BulkSelection[],
	params: { field?: string; ids?: string[]; id?: string | null; folderId?: string | null } = {},
): Promise<BulkItemResult[]> {
	const data = await cmsFetch<{ results: BulkItemResult[] }>(cmsApiUrl("/v1/bulk"), {
		method: "POST",
		json: { op, items: items.map(({ id, expectedVersion }) => ({ id, expectedVersion })), ...params },
		fallback: t("requestFailed"),
	});
	return data.results;
}

/**
 * 일괄 작업 줄의 여러 개 분류(태그 등) 선택. 폴더·카테고리 선택처럼 작은 버튼 하나로 두고, 누르면 검색과 체크 목록이 열린다.
 * 버튼에는 고른 항목을 `React 외 2개`처럼 줄여 보여 줘서 줄이 넘치지 않는다.
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
 * 일괄 작업(§3.4). 현재 페이지에서 고른 항목에만 적용하고, 항목마다 결과를 보여 준다.
 * 실패한 항목만 다시 실행할 수 있다. 휴지통 화면(`mode="trash"`)에서는 일괄 영구 삭제만 제공한다.
 */
export function BulkBar({
	collection,
	selected,
	folders,
	mode = "list",
	onClearSelection,
	onRun = runBulk,
	onDone,
}: {
	collection: string;
	selected: BulkSelection[];
	folders: Folder[];
	mode?: "list" | "trash";
	onClearSelection: () => void;
	/** 작업 요청. 목록 화면은 목록에 먼저 반영(낙관적 갱신)하는 요청을 넘긴다. */
	onRun?: typeof runBulk;
	onDone?: (failedIds: string[]) => void;
}) {
	const isRecord = isItemCollection(collection);
	const actions = useMemo(
		() =>
			mode === "trash"
				? TRASH_ACTIONS
				: [...taxonomyActions(collection), ...LIST_ACTIONS.filter((action) => !action.content || !isRecord)],
		[isRecord, collection, mode],
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

	// 작업을 바꾸면 그 작업의 입력값을 비운다.
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
			const out = await onRun(relation?.op ?? (action as BulkOp), items, params);
			setResults(out);
			setRanItems(items);
			onDone?.(out.filter((result) => !result.ok).map((result) => result.id));
		} catch (err) {
			setError(errorText(err, t("failed")));
		} finally {
			setIsRunning(false);
		}
	};

	/** 고른 대상의 이름. 분류는 고른 이름들, 폴더는 폴더 이름이다. 비우는 선택이면 `null`. */
	const targetName = (): string | null => {
		const titleOf = (id: string) => relationOptions.find((option) => option.id === id)?.title ?? id;
		if (needsMany) return checked.map(titleOf).join(", ");
		if (relation) return single === "__none__" ? null : titleOf(single);
		if (action === "folder.move")
			return single === "__unfiled__" ? null : (folders.find((folder) => folder.id === single)?.name ?? single);
		return null;
	};

	// 여러 개를 한 번에 바꾸는 작업은 모두 묻는다(§5).
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
							<span className="font-medium">{titleOf(failure.id)}</span> — {describeBulkFailure(failure)}
						</li>
					))}
				</ul>
			)}
			<ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
		</section>
	);
}
