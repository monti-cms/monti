import type { UsageItem } from "@monti-cms/core";
import { useCallback, useMemo } from "react";
import { useLeaveGuard } from "../../draft/leave-guard";
import { type Path, useDraft } from "../../draft/use-draft";
import type { ProposalItem } from "../../draft/use-proposals";
import { useOperation } from "../../operations/use-operation";

export type UseItemPanelOptions = {
	collection: string;
	group: string | null;
	item?: UsageItem | null;
	locales: string[];
	sourceLocale: string;
	onSaved?: (group: string) => void;
};

/**
 * Manages side panel draft editing for an item group across all site languages (doc 08, T45).
 * Uses `useDraft` to handle dirty tracking, unsaved changes count, and agent proposals.
 * Saves all locales in a single write via `items.saveGroup`.
 */
export function useItemPanel({ collection, group, item, locales, sourceLocale, onSaved }: UseItemPanelOptions) {
	const saveGroupOp = useOperation<{
		output: {
			id: string;
			group: string;
			locales: Record<string, { id: string; title: string; slug: string }>;
		};
		activityId?: string;
	}>("items.saveGroup");

	const base = useMemo(() => {
		if (!item && group !== "__new__") return null;
		const map: Record<Path, unknown> = {};
		for (const locale of locales) {
			const loc = item?.locales[locale];
			map[`locales.${locale}.title`] = loc?.title ?? "";
			map[`locales.${locale}.slug`] = loc?.slug ?? "";
			map[`locales.${locale}.description`] = (loc?.values?.description as string) ?? "";
		}
		return map;
	}, [item, group, locales]);

	const targetId = item ? (item.locales[sourceLocale]?.id ?? item.group) : (group ?? "new");
	const target = useMemo(() => ({ kind: "entry" as const, id: targetId }), [targetId]);

	const proposalValues = useCallback(
		(proposalItem: ProposalItem): Record<Path, unknown> => {
			const map: Record<Path, unknown> = {};
			if (proposalItem.operation === "items.saveGroup") {
				const input = proposalItem.input as {
					collection: string;
					group?: string;
					locales: Record<
						string,
						{ title?: string; slug?: string; description?: string; values?: Record<string, unknown> }
					>;
				};
				if (input.collection === collection && (!input.group || input.group === group)) {
					for (const [locale, data] of Object.entries(input.locales ?? {})) {
						if (data.title !== undefined) map[`locales.${locale}.title`] = data.title;
						if (data.slug !== undefined) map[`locales.${locale}.slug`] = data.slug;
						if (data.description !== undefined) map[`locales.${locale}.description`] = data.description;
					}
				}
			} else if (proposalItem.operation === "entries.save") {
				const input = proposalItem.input as {
					id?: string;
					title?: string;
					slug?: string;
					values?: Record<string, unknown>;
				};
				if (item) {
					for (const [locCode, locData] of Object.entries(item.locales)) {
						if (!input.id || locData.id === input.id) {
							if (input.title !== undefined) map[`locales.${locCode}.title`] = input.title;
							if (input.slug !== undefined) map[`locales.${locCode}.slug`] = input.slug;
							if (input.values?.description !== undefined)
								map[`locales.${locCode}.description`] = input.values.description;
						}
					}
				}
			}
			return map;
		},
		[collection, group, item],
	);

	const draft = useDraft({
		target,
		base: group === "__new__" ? {} : base,
		version: item ? (item.locales[sourceLocale]?.updatedAt ?? "1") : "1",
		proposalValues,
	});

	useLeaveGuard({ changes: draft.changes, revertAll: draft.revertAll });

	/** A name in some language: an item cannot be saved without one. */
	const named = useMemo(
		() => locales.some((l) => Boolean(String(draft.value(`locales.${l}.title`) ?? "").trim())),
		[locales, draft],
	);

	const save = async () => {
		const localesData: Record<string, { title?: string; slug?: string; description?: string }> = {};
		for (const locale of locales) {
			const title = String(draft.value(`locales.${locale}.title`) ?? "").trim();
			const slug = String(draft.value(`locales.${locale}.slug`) ?? "").trim();
			const description = String(draft.value(`locales.${locale}.description`) ?? "").trim();
			if (title || slug || description) {
				localesData[locale] = {
					title: title || undefined,
					slug: slug || undefined,
					description: description || undefined,
				};
			}
		}
		const sent = draft.sending();
		const res = await saveGroupOp.run(
			{
				collection,
				group: group === "__new__" ? undefined : (group ?? undefined),
				locales: localesData,
			},
			{ accepted: draft.accepted },
		);
		if (res.ok) {
			const out = res.body.output;
			draft.saved(sent);
			if (out?.group) onSaved?.(out.group);
			return { ok: true as const, out };
		}
		return { ok: false as const, refusal: res.refusal };
	};

	return {
		draft,
		saving: saveGroupOp.pending,
		named,
		save,
	};
}
