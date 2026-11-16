import type { RelationOption, RelationOptionsResult } from "@monti-cms/core";
import { useCallback, useMemo, useState } from "react";
import { addressIfShared, titleOf } from "../../format/names";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";

export type UseRelationFieldOptions = {
	collection: string;
	field: string;
	locale?: string;
	entryGroup?: string;
	createMissing?: boolean;
	/** Reads nothing: the field has no candidates (the settings' preview of a field that is not saved yet). */
	skip?: boolean;
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
	/** The options are known (or there are none to read): a name is final then. Until then the chips and rows are not drawn, so none shows with no name. */
	ready: boolean;
	labelOf: (groupOrToken: string) => string;
	/** The address of an option that shares its name with another: what tells the two apart. Nothing for a name that stands alone. */
	addressOf: (group: string) => string | null;
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
	skip = false,
}: UseRelationFieldOptions): RelationFieldModel {
	const { t } = useAdmin();
	const [search, setSearch] = useState("");

	const read = useRead<RelationOptionsResult>("relations.options", { collection, field, locale, entryGroup }, { skip });

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

	const ready = skip || Boolean(read.data) || read.refusal !== null;

	const labelOf = useCallback(
		(groupOrToken: string): string => {
			if (!groupOrToken) return "";
			if (groupOrToken.startsWith("new:")) {
				return groupOrToken.slice(4);
			}
			const found = allOptions.find((opt) => opt.group === groupOrToken);
			if (found) {
				return titleOf(found.title, t);
			}
			// A target in the trash is no choice, but the field still points at it: it is named, and says where it is (doc 08).
			const trashed = read.data?.trashed.find((each) => each.group === groupOrToken);
			if (trashed) return t("relations.inTrash", { title: titleOf(trashed.title, t) });
			// Read, and not there: gone for good. An id is not a name; it is called what every untitled thing is.
			return ready ? titleOf("", t) : "";
		},
		[allOptions, read.data?.trashed, ready, t],
	);

	const addressOf = useCallback(
		(group: string): string | null => {
			const found = allOptions.find((opt) => opt.group === group);
			return found ? addressIfShared(found, allOptions, t) : null;
		},
		[allOptions, t],
	);

	return {
		read,
		options,
		allOptions,
		addressOf,
		search,
		setSearch,
		canCreate,
		createToken,
		createLabel,
		labelOf,
		ready,
		targetCollection: read.data?.targetCollection,
		targetKind: read.data?.targetKind,
	};
}
