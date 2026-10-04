"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BacklinkField, Collection, RelationField, ValueField } from "@monti-cms/core/client";
import { cmsApiUrl, isCollection, type SchemaCollection, schemaOf, storedField } from "@monti-cms/core/client";
import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils/cn";
import { IconButton } from "../../ui/icon-button";
import { CmsApiError, cmsFetch, errorText } from "../admin-api";
import { type RecordCollection, useTaxonomy } from "../shared/use-taxonomy";
import type { EntryForm, FormValue } from "./entry-form";
import { useRecordCreator } from "./record-create-sheet";
import { RelationCombobox } from "./relation-combobox";
import { t } from "./translate";

/** 입력이 필드 밖에서 알아야 하는 값. 편집 화면이 채운다. */
export interface FieldContext {
	/** 편집 중인 콘텐츠 ID. 자기 자신을 관계 대상으로 고르지 않게 한다. */
	entryId?: string;
	disabled: boolean;
	/** 편집 중인 콘텐츠의 언어. 필드 옆 AI 동작이 주소 충돌을 이 언어에서 본다. */
	locale?: string;
	/** 번역 묶음 ID(원문 ID). 반대 방향 관계는 원문을 가리킨다(v2 B2·B4). */
	groupId?: string;
	/** 속성 패널이 이미 불러온 이 글의 사용처. 반대 방향 관계가 같은 글이면 다시 부르지 않는다. */
	incomingReferences?: readonly IncomingReference[];
	incomingReferencesLoading?: boolean;
	refreshIncomingReferences?: () => void;
	/** 저장된 이 글(보기 필드가 원문 값·언어를 읽는다). */
	entry?: import("./entry-form").EntryData | null;
}

export interface FieldInputProps {
	/** 편집 중인 콘텐츠의 컬렉션. */
	collection: string;
	name: string;
	field: ValueField;
	id: string;
	value: FormValue;
	invalid: boolean;
	describedBy?: string;
	context: FieldContext;
	/** 지금 입력 중인 값 전체(제목·요약 등 다른 필드 값을 안내 문구에 쓸 때). 번역본의 공통 필드는 원문 값이다. */
	form: EntryForm;
	onChange: (value: FormValue) => void;
}

export const inputClass = "h-8 text-xs md:text-xs";

/** 여러 줄 텍스트 입력의 줄 수(`rows`, 없으면 2)와 그 줄 수가 보이는 최소 높이(글자 줄 + 위아래 여백). */
export function multilineProps(field: { readonly rows?: number }): { rows: number; style: { minHeight: string } } {
	const rows = field.rows !== undefined && field.rows >= 1 ? Math.floor(field.rows) : 2;
	return { rows, style: { minHeight: `${rows + 1}rem` } };
}

type EntryOption = { id: string; title: string; status: string };

/** 목록 API 한 번에 받는 최대 수. 글이 이보다 많으면 여러 번 나눠 받는다. */
const ENTRY_OPTIONS_PAGE_SIZE = 100;

/**
 * 관계 대상(게시글·메모)의 전체 목록. 고를 때 검색 없이 바로 펼쳐 보이려고 처음에 한 번 다 받는다.
 * 휴지통 글은 목록 API가 빼고, `publishedOnly`면 공개 글만 받는다.
 */
function useEntryOptions(field: RelationField) {
	const [options, setOptions] = useState<EntryOption[] | null>(null);
	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			const all: EntryOption[] = [];
			for (let page = 1; ; page += 1) {
				const params = new URLSearchParams({
					collection: field.to,
					pageSize: String(ENTRY_OPTIONS_PAGE_SIZE),
					page: String(page),
				});
				if (field.publishedOnly) params.set("status", "published");
				const data = await cmsFetch<{ items: { id: string; title: string | null; status: string }[]; total: number }>(
					cmsApiUrl(`/v1/entries?${params}`),
				);
				all.push(
					...data.items.map((item) => ({ id: item.id, title: item.title || t("untitled"), status: item.status })),
				);
				if (data.items.length === 0 || all.length >= data.total) break;
			}
			return all;
		};
		load()
			.then((loaded) => !cancelled && setOptions(loaded))
			.catch(() => !cancelled && setOptions([]));
		return () => {
			cancelled = true;
		};
	}, [field.to, field.publishedOnly]);
	return options;
}

/** 관계 대상 컬렉션의 이름표(예: `게시글`). 입력 안내 문구에 쓴다. */
const targetLabel = (relation: RelationField) =>
	isCollection(relation.to) ? schemaOf(relation.to).label : relation.to;

/** 공개되지 않은 글은 이름 뒤에 표시한다. 모음집·대체 글의 공개 목록에서 빠지기 때문이다. */
const entryLabel = (option: EntryOption) =>
	option.status === "published" ? option.title : `${option.title}${t("entry.unpublished")}`;

/** 한 개 관계(게시글·메모 대상). 누르면 전체 글 목록이 열리고 고른다. 대체 글(§6.4)이 쓴다. */
export function EntryPicker({ field, id, value, invalid, describedBy, context, onChange }: FieldInputProps) {
	const relation = field as RelationField;
	const options = useEntryOptions(relation);
	const selected = typeof value === "string" && value ? [value] : [];
	return (
		<RelationCombobox
			id={id}
			aria-label={field.label}
			placeholder={
				options === null ? t("loading") : (relation.placeholder ?? t("entry.choose", { target: targetLabel(relation) }))
			}
			invalid={invalid}
			describedBy={describedBy}
			disabled={context.disabled || options === null}
			multiple={false}
			options={(options ?? [])
				.filter((option) => option.id !== context.entryId)
				.map((option) => ({ value: option.id, label: entryLabel(option) }))}
			value={selected}
			onValueChange={(next) => onChange(next[0] ?? null)}
		/>
	);
}

/** 순서 있는 목록의 한 줄. 손잡이를 끌거나 위로·아래로 버튼으로 옮긴다. */
function SortableEntryRow({
	sortableId,
	index,
	count,
	option,
	disabled,
	onMove,
	onRemove,
}: {
	sortableId: string;
	index: number;
	count: number;
	option: EntryOption | undefined;
	disabled: boolean;
	onMove: (direction: -1 | 1) => void;
	onRemove: () => void;
}) {
	const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
		id: sortableId,
		disabled,
	});
	const title = option?.title ?? t("loading");
	return (
		<li
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			className={cn(
				"flex items-center gap-1 rounded-md border bg-cms-background px-1 py-1 text-xs",
				isDragging && "relative z-10 shadow-md",
			)}
		>
			<IconButton
				ref={setActivatorNodeRef}
				size="icon-xs"
				label={t("entry.drag", { title })}
				disabled={disabled}
				className="cursor-grab touch-none text-cms-muted-foreground active:cursor-grabbing"
				{...attributes}
				{...listeners}
			>
				<GripVertical />
			</IconButton>
			<span className="min-w-0 flex-1 truncate">
				{index + 1}. {title}
				{/* 공개되지 않은 글은 모음집의 공개 목록에서 빠진다. */}
				{option && option.status !== "published" && option.status !== "missing" && (
					<span className="ml-1 cms-dark:text-amber-400 text-amber-700">{t("entry.unpublished")}</span>
				)}
			</span>
			<IconButton
				size="icon-xs"
				label={t("entry.up", { title })}
				disabled={disabled || index === 0}
				onClick={() => onMove(-1)}
			>
				<ArrowUp />
			</IconButton>
			<IconButton
				size="icon-xs"
				label={t("entry.down", { title })}
				disabled={disabled || index === count - 1}
				onClick={() => onMove(1)}
			>
				<ArrowDown />
			</IconButton>
			<IconButton size="icon-xs" label={t("entry.remove", { title })} disabled={disabled} onClick={onRemove}>
				<X />
			</IconButton>
		</li>
	);
}

/**
 * 순서 있는 여러 개 관계(게시글 대상). 모음집 항목(§6.4)이 쓴다.
 * 위의 `글 추가·빼기` 목록에서 체크해 넣고 빼며(넣으면 끝에 붙는다), 아래 목록에서 끌어서 순서를 바꾼다.
 */
export function OrderedEntryList({ field, id, value, context, onChange }: FieldInputProps) {
	const relation = field as RelationField;
	const options = useEntryOptions(relation);
	const ids = Array.isArray(value) ? value : [];
	const byId = useMemo(() => new Map((options ?? []).map((option) => [option.id, option])), [options]);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	// 같은 글이 두 번 담길 수 있어(이전 데이터) 순번까지 끌기 ID로 쓴다.
	const sortableIds = ids.map((itemId, index) => `${index}:${itemId}`);

	const move = (index: number, direction: -1 | 1) => {
		const target = index + direction;
		if (target < 0 || target >= ids.length) return;
		onChange(arrayMove([...ids], index, target));
	};
	const onDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		onChange(arrayMove([...ids], sortableIds.indexOf(String(active.id)), sortableIds.indexOf(String(over.id))));
	};
	/** 체크 목록이 돌려준 선택. 남은 글은 지금 순서를 지키고 새 글은 끝에 붙인다. */
	const applySelection = (selected: string[]) => {
		const chosen = new Set(selected);
		const kept = ids.filter((itemId) => chosen.has(itemId));
		onChange([...kept, ...selected.filter((itemId) => !ids.includes(itemId))]);
	};
	const target = targetLabel(relation);
	const missing = (itemId: string): EntryOption | undefined =>
		options === null ? undefined : { id: itemId, title: t("entry.missing", { target }), status: "missing" };

	return (
		<div className="space-y-2">
			<RelationCombobox
				id={id}
				aria-label={t("entry.editList", { target })}
				placeholder={options === null ? t("loading") : (relation.placeholder ?? t("entry.editList", { target }))}
				disabled={context.disabled || options === null}
				multiple
				showChips={false}
				options={(options ?? [])
					.filter((option) => option.id !== context.entryId)
					.map((option) => ({ value: option.id, label: entryLabel(option) }))}
				value={ids}
				onValueChange={applySelection}
			/>
			{ids.length === 0 ? (
				<p className="text-cms-muted-foreground text-xs">{t("entry.empty", { target })}</p>
			) : (
				<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
					<SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
						<ol aria-label={t("entry.listAria", { target })} className="space-y-1">
							{ids.map((itemId, index) => (
								<SortableEntryRow
									key={sortableIds[index]}
									sortableId={sortableIds[index] as string}
									index={index}
									count={ids.length}
									option={byId.get(itemId) ?? missing(itemId)}
									disabled={context.disabled}
									onMove={(direction) => move(index, direction)}
									onRemove={() => onChange(ids.filter((_, i) => i !== index))}
								/>
							))}
						</ol>
					</SortableContext>
				</DndContext>
			)}
		</div>
	);
}

type RecordEntry = {
	id: string;
	version: number;
	workingSlug: string | null;
	working: { metadata: Record<string, unknown> };
};
export type IncomingReference = {
	state: "working" | "published";
	sourceId: string;
	sourceCollection: string;
	sourceTitle: string | null;
	occurrences: readonly { type: string; path?: string }[];
};

/**
 * 반대 방향 관계가 상대 레코드의 조건부 목록이면(예: 모음집의 `담는 글`이 메모일 때만 있는 `memoIds`)
 * 그 조건에 맞는 레코드만 고를 수 있게 한다. 레코드마다 지금 고른 종류를 읽어 거른다.
 * 조건이 없는 관계는 거르지 않는다.
 */
function useRecordKind(field: BacklinkField, options: readonly { id: string }[]) {
	const requirement = storedField(field.from as SchemaCollection, field.via)?.when;
	const discriminant = requirement ? storedField(field.from as SchemaCollection, requirement.field)?.field : undefined;
	const defaultValue = discriminant?.kind === "select" ? discriminant.defaultValue : undefined;
	const [kinds, setKinds] = useState<ReadonlyMap<string, string>>(new Map());
	const idsKey = options.map((option) => option.id).join(",");

	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the option ids
	useEffect(() => {
		if (!requirement) return;
		const missing = options.filter((option) => !kinds.has(option.id));
		if (missing.length === 0) return;
		let cancelled = false;
		void Promise.all(
			missing.map((option) =>
				cmsFetch<RecordEntry>(cmsApiUrl(`/v1/entries/${option.id}`))
					.then((record) => {
						const value = record.working.metadata[requirement.field];
						return [option.id, typeof value === "string" ? value : (defaultValue ?? "")] as const;
					})
					.catch(() => [option.id, ""] as const),
			),
		).then((loaded) => {
			if (!cancelled) setKinds((current) => new Map([...current, ...loaded]));
		});
		return () => {
			cancelled = true;
		};
	}, [idsKey, requirement?.field]);

	return {
		ready: !requirement || options.every((option) => kinds.has(option.id)),
		accepts: (id: string) => !requirement || kinds.get(id) === requirement.value,
		/** 새로 만들 레코드가 이 관계를 받도록 종류를 정한다. 기본 종류면 따로 적지 않는다. */
		createMetadata: requirement && requirement.value !== defaultValue ? { [requirement.field]: requirement.value } : {},
	};
}

/**
 * 반대 방향 관계 입력(v2 B2). 예: 게시글의 `모음집`. 상대 레코드(모음집)의 여러 개 관계 필드(`itemIds`)를
 * 누르는 즉시 저장한다 — 이 글의 초안·발행과 별개다. 추가하면 끝에 들어가고, 빼면 이 글이 든 자리를 모두 뺀다.
 * 버전이 어긋나면(다른 곳에서 먼저 바뀜) 최신 값을 다시 읽어 한 번 더 시도한다.
 */
export function BacklinkInput({
	field,
	targetId,
	disabled,
	shared,
}: {
	field: BacklinkField;
	/** 이 글의 ID. 번역본이면 원문 ID다(관계는 원문을 가리킨다). 새 글이면 없다. */
	targetId: string | undefined;
	disabled: boolean;
	/** 속성 패널이 불러온 같은 글의 사용처. 있으면 그것을 쓰고, 저장 뒤에는 `refresh`로 다시 부른다. */
	shared?: { references: readonly IncomingReference[]; loading: boolean; refresh: () => void };
}) {
	const records = useTaxonomy(field.from as RecordCollection, Boolean(targetId));
	const creator = useRecordCreator();
	const kind = useRecordKind(field, records.options);
	const [fetched, setFetched] = useState<{ id: string; title: string }[] | null>(null);
	/** 불러오기·저장 실패. 다른 관계 입력처럼 입력 바로 아래에 보인다. */
	const [error, setError] = useState<string | null>(null);

	const membersOf = useCallback(
		(references: readonly IncomingReference[]) => {
			const found = new Map<string, string>();
			for (const reference of references) {
				const viaField = reference.occurrences.some((occurrence) => occurrence.path === field.via);
				if (reference.state === "working" && reference.sourceCollection === field.from && viaField) {
					found.set(reference.sourceId, reference.sourceTitle || t("untitled"));
				}
			}
			return [...found].map(([id, title]) => ({ id, title }));
		},
		[field.from, field.via],
	);

	const refreshShared = shared?.refresh;
	const load = useCallback(async () => {
		if (!targetId) return;
		if (refreshShared) {
			refreshShared();
			return;
		}
		try {
			const data = await cmsFetch<{ incomingReferences: IncomingReference[] }>(
				cmsApiUrl(`/v1/entries/${targetId}/relations`),
			);
			setFetched(membersOf(data.incomingReferences));
		} catch (loadError) {
			setError(errorText(loadError, t("entry.loadFailed")));
		}
	}, [targetId, refreshShared, membersOf]);

	// 속성 패널이 같은 글의 사용처를 이미 불러오면 따로 부르지 않는다.
	const usesShared = Boolean(shared);
	useEffect(() => {
		if (!usesShared) void load();
	}, [usesShared, load]);

	const members = shared
		? shared.loading && shared.references.length === 0
			? null
			: membersOf(shared.references)
		: fetched;

	/** 상대 레코드의 관계 목록을 바꿔 바로 저장한다. record 컬렉션은 저장이 곧 공개 반영이다. */
	const update = async (recordId: string, change: (ids: string[]) => string[]) => {
		for (let attempt = 0; attempt < 2; attempt++) {
			const record = await cmsFetch<RecordEntry>(cmsApiUrl(`/v1/entries/${recordId}`));
			const current = record.working.metadata[field.via];
			const ids = Array.isArray(current) ? current.filter((id): id is string => typeof id === "string") : [];
			try {
				await cmsFetch(cmsApiUrl(`/v1/entries/${recordId}`), {
					method: "PATCH",
					json: {
						expectedVersion: record.version,
						slug: record.workingSlug,
						metadata: { ...record.working.metadata, [field.via]: change(ids) },
					},
					fallback: t("saveFailed"),
				});
				return;
			} catch (saveError) {
				if (!(saveError instanceof CmsApiError && saveError.code === "conflict") || attempt === 1) throw saveError;
			}
		}
	};

	// 고르거나 빼면 먼저 화면에 반영하고(낙관적), 저장은 뒤에서 차례로 한다. 실패하면 알리고 그 변경만 되돌린다.
	const [optimistic, setOptimistic] = useState<string[] | null>(null);
	const pendingRef = useRef(0);
	const queueRef = useRef<Promise<void>>(Promise.resolve());
	const awaitingServerRef = useRef(false);
	/** 방금 만들면서 이 글을 넣은 모음집. 다시 저장하지 않는다. */
	const createdRef = useRef(new Set<string>());
	const serverIds = useMemo(() => members?.map((member) => member.id) ?? [], [members]);
	const serverKey = serverIds.join(",");
	const serverIdsRef = useRef(serverIds);
	serverIdsRef.current = serverIds;

	// 저장이 모두 끝난 뒤 서버 값이 도착하면 낙관적 값을 내려놓는다.
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the server ids
	useEffect(() => {
		if (awaitingServerRef.current && pendingRef.current === 0) {
			awaitingServerRef.current = false;
			setOptimistic(null);
		}
	}, [serverKey]);

	const enqueue = (task: () => Promise<void>, failure: string, revert: (ids: string[]) => string[]) => {
		pendingRef.current += 1;
		queueRef.current = queueRef.current.then(async () => {
			try {
				await task();
			} catch (taskError) {
				setError(errorText(taskError, failure));
				setOptimistic((current) => revert(current ?? serverIdsRef.current));
			} finally {
				pendingRef.current -= 1;
				if (pendingRef.current === 0) {
					awaitingServerRef.current = true;
					await load();
				}
			}
		});
	};

	if (!targetId) {
		return <p className="text-cms-muted-foreground text-xs">{t("backlink.saveDraft", { label: field.label })}</p>;
	}

	const shown = optimistic ?? serverIds;
	const options = [
		...records.options
			.filter((option) => kind.accepts(option.id))
			.map((option) => ({ value: option.id, label: option.title })),
		// 공개 목록에 아직 없는 모음집(방금 만든 것 등)도 이름으로 보인다.
		...(members ?? [])
			.filter((member) => !records.options.some((option) => option.id === member.id))
			.map((member) => ({ value: member.id, label: member.title })),
	];

	const change = (next: string[]) => {
		setError(null);
		const added = next.filter((id) => !shown.includes(id) && !createdRef.current.delete(id));
		const removed = shown.filter((id) => !next.includes(id));
		setOptimistic(next);
		for (const recordId of added) {
			enqueue(
				() => update(recordId, (ids) => (ids.includes(targetId) ? ids : [...ids, targetId])),
				t("backlink.addFailed", { label: field.label }),
				(ids) => ids.filter((id) => id !== recordId),
			);
		}
		for (const recordId of removed) {
			enqueue(
				() => update(recordId, (ids) => ids.filter((id) => id !== targetId)),
				t("backlink.removeFailed", { label: field.label }),
				(ids) => (ids.includes(recordId) ? ids : [...ids, recordId]),
			);
		}
	};

	return (
		<>
			<RelationCombobox
				multiple
				aria-label={field.label}
				placeholder={members === null || !kind.ready ? t("loading") : t("relation.searchOrAdd")}
				options={options}
				value={shown}
				disabled={disabled || members === null || !kind.ready}
				onValueChange={change}
				onCreate={
					field.createInline
						? async (title) => {
								// 추가 칸에 이 글을 담은 채로 연다. 저장하면 목록에 바로 보이게 선택지도 다시 읽는다.
								const saved = await creator.create(field.from as Collection, {
									title,
									...kind.createMetadata,
									[field.via]: [targetId],
								});
								if (!saved) return null;
								createdRef.current.add(saved.id);
								void records.reload();
								awaitingServerRef.current = true;
								void load();
								return saved.id;
							}
						: undefined
				}
			/>
			{error && (
				<p role="alert" className="text-cms-destructive text-xs">
					{error}
				</p>
			)}
			{creator.sheet}
		</>
	);
}
