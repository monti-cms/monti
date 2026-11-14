import type { RelationOption, RelationOptionsResult } from "@monti-cms/core";
import { useCallback, useMemo, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";

export type UseRelationFieldOptions = {
	collection: string;
	field: string;
	locale?: string;
	entryGroup?: string;
	createMissing?: boolean;
};

export type RelationFieldModel = {
	read: ReturnType<typeof useRead<RelationOptionsResult>>;
	options: RelationOption[];
	allOptions: RelationOption[];
	search: string;
	setSearch: (search: string) => void;
	canCreate: boolean;
	createToken: string | null;
	createLabel: string | null;
	labelOf: (groupOrToken: string) => string;
	targetCollection?: string;
	targetKind?: "document" | "item";
};

/**
 * Manages options and inline creation for a relation field (doc 08, T66).
 * Reads active target entries, supports client-side search filtering,
 * and allows inline token creation (`new:<name>`) when `createMissing` is true.
 */
export function useRelationField({
	collection,
	field,
	locale,
	entryGroup,
	createMissing = false,
}: UseRelationFieldOptions): RelationFieldModel {
	const { t } = useAdmin();
	const [search, setSearch] = useState("");

	const read = useRead<RelationOptionsResult>("relations.options", { collection, field, locale, entryGroup });

	const allOptions = useMemo(() => read.data?.options ?? [], [read.data?.options]);

	const q = search.trim();
	const qLower = q.toLowerCase();

	const options = useMemo(() => {
		if (!qLower) return allOptions;
		return allOptions.filter(
			(opt) => opt.title.toLowerCase().includes(qLower) || opt.slug.toLowerCase().includes(qLower),
		);
	}, [allOptions, qLower]);

	const exactMatch = useMemo(
		() => Boolean(qLower && allOptions.some((opt) => opt.title.toLowerCase() === qLower)),
		[allOptions, qLower],
	);

	const canCreate = Boolean(createMissing && q.length > 0 && !exactMatch);
	const createToken = canCreate ? `new:${q}` : null;
	const createLabel = canCreate ? t("relations.createNew", { name: q }) : null;

	const labelOf = useCallback(
		(groupOrToken: string): string => {
			if (!groupOrToken) return "";
			if (groupOrToken.startsWith("new:")) {
				return groupOrToken.slice(4);
			}
			const found = allOptions.find((opt) => opt.group === groupOrToken);
			if (found) {
				return found.title || found.slug || groupOrToken;
			}
			// A target in the trash is no choice, but the field still points at it: it is named, and says where it is (doc 08).
			const trashed = read.data?.trashed.find((each) => each.group === groupOrToken);
			if (trashed) return t("relations.inTrash", { title: trashed.title });
			return groupOrToken;
		},
		[allOptions, read.data?.trashed, t],
	);

	return {
		read,
		options,
		allOptions,
		search,
		setSearch,
		canCreate,
		createToken,
		createLabel,
		labelOf,
		targetCollection: read.data?.targetCollection,
		targetKind: read.data?.targetKind,
	};
}
