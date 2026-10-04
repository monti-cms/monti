"use client";

import {
	COLLECTION_DEFINITIONS,
	cmsApiUrl,
	createTranslator,
	isCollection,
	taxonomyFieldsOf,
} from "@monti-cms/core/client";
import { useQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cmsFetch } from "../admin-api";
import { sharedMessages } from "./messages";

const t = createTranslator(sharedMessages);

/** record 컬렉션(§5.2) 이름. 관계 필드의 선택지와 추가(v2 B2)에 쓴다. */
export type RecordCollection = string;

/** 분류 필드 이름 → 그 필드가 가리키는 컬렉션의 선택지. */
export type TaxonomyOptions = Readonly<Record<string, readonly TaxonomyOption[]>>;

const labelOf = (collection: string) =>
	isCollection(collection) ? COLLECTION_DEFINITIONS[collection].label : collection;

export interface TaxonomyOption {
	id: string;
	title: string;
	slug: string | null;
}

type ListResponse = { items: { id: string; title: string | null; slug: string | null }[]; total: number };

/** 활성(공개) record 전체. 100개를 넘으면 다음 페이지도 읽는다. */
async function loadAll(collection: RecordCollection): Promise<TaxonomyOption[]> {
	const options: TaxonomyOption[] = [];
	for (let page = 1; page < 50; page++) {
		const params = new URLSearchParams({
			collection,
			pageSize: "100",
			page: String(page),
			sortField: "title",
			sortDirection: "asc",
		});
		params.append("status", "published");
		const data = await cmsFetch<ListResponse>(cmsApiUrl(`/v1/entries?${params.toString()}`));
		options.push(
			...data.items.map((item) => ({
				id: item.id,
				title: item.title || item.slug || t("taxonomy.unnamed"),
				slug: item.slug,
			})),
		);
		if (options.length >= data.total || data.items.length === 0) break;
	}
	return options;
}

/**
 * 편집 화면·일괄 작업·목록 필터가 함께 쓰는 태그·카테고리 등 record 선택지.
 * 새 항목은 분류 추가 칸(`useRecordCreator`)에서 만들고, 만든 항목을 `remember`로 바로 보인다.
 */
export function useTaxonomy(collection: RecordCollection, enabled = true) {
	const [options, setOptions] = useState<TaxonomyOption[]>([]);
	const [error, setError] = useState<string | null>(null);
	// 이 화면에서 추가한 항목. 다시 읽은 목록에 아직 없어도(목록 캐시·검색 반영 전) 이름으로 보인다.
	const rememberedRef = useRef<TaxonomyOption[]>([]);

	const reload = useCallback(async () => {
		try {
			const loaded = await loadAll(collection);
			setOptions([
				...loaded,
				...rememberedRef.current.filter((option) => !loaded.some((item) => item.id === option.id)),
			]);
			setError(null);
		} catch {
			setError(t("taxonomy.loadFailed", { label: labelOf(collection) }));
		}
	}, [collection]);

	useEffect(() => {
		if (enabled) void reload();
	}, [enabled, reload]);

	/** 방금 추가한 항목을 다시 읽기 전에도 이름으로 보이게 선택지에 넣는다. */
	const remember = useCallback((option: TaxonomyOption) => {
		rememberedRef.current = [...rememberedRef.current, option];
		setOptions((current) => (current.some((item) => item.id === option.id) ? current : [...current, option]));
	}, []);

	return { options, error, reload, remember };
}

/**
 * 컬렉션의 분류 필드(태그·카테고리 등) 선택지를 필드 이름별로 읽는다. 목록 필터·일괄 작업·행 메뉴가 쓴다.
 * 같은 컬렉션을 가리키는 필드는 한 번만 읽는다.
 */
export function useTaxonomyOptions(collection: string, enabled = true): TaxonomyOptions {
	const fields = useMemo(() => taxonomyFieldsOf(collection), [collection]);
	const targets = useMemo(() => [...new Set(fields.map((stored) => stored.to))], [fields]);
	const combine = useCallback(
		(results: { data?: TaxonomyOption[] }[]): TaxonomyOptions =>
			Object.fromEntries(fields.map((stored) => [stored.name, results[targets.indexOf(stored.to)]?.data ?? []])),
		[fields, targets],
	);
	return useQueries({
		queries: targets.map((target) => ({
			// 목록 캐시 아래에 두어 목록을 다시 받을 때 함께 새로 받는다.
			queryKey: ["cms", "entries", "taxonomy", target],
			queryFn: () => loadAll(target),
			enabled,
		})),
		combine,
	});
}
