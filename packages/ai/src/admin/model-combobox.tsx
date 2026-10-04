"use client";

import { cmsFetch, errorText } from "@monti-cms/admin/api";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	cn,
} from "@monti-cms/admin/kit";
import { cmsApiUrl, createTranslator } from "@monti-cms/core/client";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { AiModelInfo } from "../connection";
import { aiCommonMessages } from "./ai-common.messages";

const t = createTranslator(aiCommonMessages);

/** Where to fetch the model list from. A saved connection by id; before saving, by URL and key. */
export type ModelSource = { providerId: string } | { url: string; apiKey?: string };

/**
 * Model list of a generation connection. A list fetched once is not fetched again for 10 minutes, and is reused after saving or reopening.
 * If there is no `source`, it is not fetched.
 */
export function useModelList(source: ModelSource | null) {
	const query = useQuery({
		queryKey: ["cms", "ai", "models", source],
		queryFn: async ({ signal }) =>
			(
				await cmsFetch<{ items: AiModelInfo[] }>(cmsApiUrl("/v1/ai/models"), {
					method: "POST",
					json: source,
					signal,
					fallback: t("modelsFailed"),
				})
			).items,
		enabled: source !== null,
		staleTime: 10 * 60_000,
		retry: false,
	});
	return {
		models: query.data ?? null,
		loading: query.isFetching,
		error: query.error ? errorText(query.error, t("modelsFailed")) : null,
	};
}

type Item = { value: string; label: string; custom?: true };

/**
 * Model picker. Search the list and pick, or use a name that is not in the list exactly as typed.
 * Even without a list (judge model, or a URL that gives no list), you can type a name and pick it.
 */
export function ModelCombobox({
	id,
	value,
	onChange,
	models,
	loading,
	error,
	placeholder,
	"aria-label": ariaLabel,
}: {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	models: AiModelInfo[] | null;
	loading?: boolean;
	error?: string | null;
	placeholder?: string;
	"aria-label"?: string;
}) {
	const [query, setQuery] = useState("");
	const options = useMemo<Item[]>(
		() => (models ?? []).map((model) => ({ value: model.id, label: model.id })),
		[models],
	);
	// Even if the chosen value is not in the list (a typed name), pass the same object for the same value so the typed text does not revert.
	const selected = useMemo<Item | null>(
		() => (value ? (options.find((option) => option.value === value) ?? { value, label: value }) : null),
		[value, options],
	);
	const typed = query.trim();
	const items: Item[] =
		typed && typed !== value && !options.some((option) => option.value === typed)
			? [...options, { value: typed, label: typed, custom: true }]
			: options;

	return (
		<Combobox
			items={items}
			autoHighlight
			value={selected}
			onValueChange={(next: Item | null) => onChange(next?.value ?? "")}
			onInputValueChange={setQuery}
			itemToStringLabel={(item: Item) => item.label}
			isItemEqualToValue={(a: Item, b: Item) => a.value === b.value}
		>
			<ComboboxInput
				id={id}
				aria-label={ariaLabel}
				placeholder={loading ? t("modelsLoading") : placeholder}
				showClear={Boolean(value)}
				className="h-8 w-full min-w-0 [&_input]:font-mono [&_input]:text-xs"
			/>
			<ComboboxContent>
				<ComboboxEmpty>{error ?? (loading ? t("modelsLoading") : t("modelsHint"))}</ComboboxEmpty>
				<ComboboxList>
					{(item: Item) => (
						<ComboboxItem
							key={item.value}
							value={item}
							className={cn("font-mono text-xs", item.custom && "text-cms-primary")}
						>
							<span className="truncate">{item.custom ? t("modelUse", { label: item.label }) : item.label}</span>
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}
