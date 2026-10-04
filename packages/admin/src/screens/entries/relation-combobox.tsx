"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "../../lib/utils/cn";
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	ComboboxValue,
	useComboboxAnchor,
} from "../../ui/combobox";
import { t } from "./translate";

export interface RelationOption {
	value: string;
	label: string;
}

/** 목록 끝의 `'검색어' 추가` 항목. 검색어가 곧 이름이라 거르기에 늘 걸린다. */
type Item = RelationOption & { create?: true };

interface RelationComboboxProps {
	options: readonly RelationOption[];
	multiple: boolean;
	/** 고른 ID들. 하나만 고르는 관계는 비었거나 하나다. */
	value: readonly string[];
	onValueChange: (value: string[]) => void;
	/** 있으면 검색어로 새 항목을 추가할 수 있다. 만든 항목의 ID를, 그만두면 null을 돌려준다. */
	onCreate?: (label: string) => Promise<string | null>;
	id?: string;
	placeholder?: string;
	"aria-label"?: string;
	invalid?: boolean;
	describedBy?: string;
	disabled?: boolean;
	/** 여러 개일 때 고른 항목을 입력칸 안에 칩으로 보일지. 고른 목록을 따로 그리는 곳(모음집 글 목록)은 끈다. */
	showChips?: boolean;
}

/**
 * 태그·카테고리 같은 관계 입력. 검색해 고르고, 없는 이름이면 목록 끝의 `'이름' 추가`로 추가 칸을 연다
 * (따로 떨어진 "새 항목" 입력 줄을 두지 않는다).
 */
export function RelationCombobox({
	options,
	multiple,
	value,
	onValueChange,
	onCreate,
	id,
	placeholder,
	"aria-label": ariaLabel,
	invalid,
	describedBy,
	disabled,
	showChips = true,
}: RelationComboboxProps) {
	const anchor = useComboboxAnchor();
	const [query, setQuery] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const byValue = useMemo(() => new Map(options.map((option) => [option.value, option])), [options]);
	// 목록에 아직 없는 선택값(방금 만든 항목 등)도 이름 대신 짧은 ID로 보인다. Base UI는 값 객체가 바뀌면
	// 입력 글자를 고른 이름으로 되돌리므로, 같은 선택이면 같은 객체를 넘긴다.
	const valueKey = value.join("\u0000");
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the joined ids
	const selected: Item[] = useMemo(
		() => value.map((item) => byValue.get(item) ?? { value: item, label: item.slice(0, 8) }),
		[valueKey, byValue],
	);

	const trimmed = query.trim();
	const canCreate =
		Boolean(onCreate) &&
		!isCreating &&
		trimmed !== "" &&
		// 고른 항목 이름이 입력에 보이는 경우(하나만 고르는 관계)나 이미 있는 이름이면 만들지 않는다.
		![...options, ...selected].some((option) => option.label.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
	const items: Item[] = canCreate
		? [...options, { value: `__create__:${trimmed}`, label: trimmed, create: true }]
		: [...options];

	const create = async (label: string, keep: string[]) => {
		if (!onCreate) return;
		setIsCreating(true);
		setError(null);
		try {
			const createdId = await onCreate(label);
			if (createdId === null) return;
			onValueChange([...keep, createdId]);
			setQuery("");
		} catch (caught) {
			setError(caught instanceof Error && caught.message ? caught.message : t("relation.addFailed"));
		} finally {
			setIsCreating(false);
		}
	};

	const list = (
		<ComboboxContent anchor={multiple ? anchor : undefined}>
			<ComboboxEmpty>{t("relation.empty")}</ComboboxEmpty>
			<ComboboxList>
				{(item: Item) => (
					<ComboboxItem key={item.value} value={item} className={cn(item.create && "text-cms-primary")}>
						{item.create ? (
							<>
								<Plus aria-hidden />
								<span className="truncate">{t("relation.create", { label: item.label })}</span>
							</>
						) : (
							<span className="truncate">{item.label}</span>
						)}
					</ComboboxItem>
				)}
			</ComboboxList>
		</ComboboxContent>
	);

	const errorText = error && (
		<p role="alert" className="text-cms-destructive text-xs">
			{error}
		</p>
	);

	if (multiple) {
		return (
			<>
				<Combobox
					items={items}
					multiple
					autoHighlight
					disabled={disabled || isCreating}
					value={selected}
					onValueChange={(next: Item[]) => {
						const created = next.find((item) => item.create);
						const keep = next.filter((item) => !item.create).map((item) => item.value);
						if (created) void create(created.label, keep);
						else onValueChange(keep);
					}}
					onInputValueChange={setQuery}
					itemToStringLabel={(item: Item) => item.label}
					isItemEqualToValue={(a: Item, b: Item) => a.value === b.value}
				>
					<ComboboxChips ref={anchor} className="w-full min-w-0">
						<ComboboxValue>
							{(showChips ? selected : []).map((item) => (
								<ComboboxChip key={item.value} className="max-w-full">
									<span className="truncate">{item.label}</span>
								</ComboboxChip>
							))}
						</ComboboxValue>
						<ComboboxChipsInput
							id={id}
							aria-label={ariaLabel}
							aria-invalid={invalid || undefined}
							aria-describedby={describedBy}
							placeholder={selected.length === 0 || !showChips ? placeholder : undefined}
							className="text-xs"
						/>
					</ComboboxChips>
					{list}
				</Combobox>
				{errorText}
			</>
		);
	}

	return (
		<>
			<Combobox
				items={items}
				autoHighlight
				disabled={disabled || isCreating}
				value={selected[0] ?? null}
				onValueChange={(next: Item | null) => {
					if (next?.create) void create(next.label, []);
					else onValueChange(next ? [next.value] : []);
				}}
				onInputValueChange={setQuery}
				itemToStringLabel={(item: Item) => item.label}
				isItemEqualToValue={(a: Item, b: Item) => a.value === b.value}
			>
				<ComboboxInput
					id={id}
					aria-label={ariaLabel}
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					placeholder={placeholder}
					showClear={selected.length > 0}
					disabled={disabled || isCreating}
					className="h-8 w-full text-xs [&_input]:text-xs"
				/>
				{list}
			</Combobox>
			{errorText}
		</>
	);
}
