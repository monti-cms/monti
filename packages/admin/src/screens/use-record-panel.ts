"use client";

import { useSite } from "@monti-cms/core/site";
import { useEffect, useRef, useState } from "react";
import { useAdminRouter, useAdminSearchParams } from "../router";
import type { RecordTarget } from "./record-panel";
import { OPEN_ITEM_PARAM } from "./shared/entry-href";
import { useUnsavedGuard } from "./shared/use-unsaved-guard";
import type { ListMode } from "./use-entry-list";

/**
 * The taxonomy item (record) panel beside the list: which item is open, whether it has unsaved changes, and the guards around that. The panel
 * reports its own dirty state; this hook decides when it may be replaced or closed.
 * `confirmDiscard` is the list's confirm dialog, passed in so the screen renders a single set of dialogs.
 */
export function useRecordPanel({
	collection,
	mode,
	confirmDiscard,
}: {
	collection: string;
	mode: ListMode;
	confirmDiscard: (dirty: boolean) => Promise<boolean>;
}) {
	const site = useSite();
	const router = useAdminRouter();
	const [recordTarget, setRecordTarget] = useState<RecordTarget | null>(null);
	/** Whether the taxonomy edit panel has unsaved changes. The panel reports it. */
	const recordDirtyRef = useRef(false);
	/** The same, as state, for the guard on links that leave the list (the sidebar, another collection). */
	const [recordDirty, setRecordDirtyState] = useState(false);
	const { dialog: guardDialog } = useUnsavedGuard(recordDirty);
	const setRecordDirty = (dirty: boolean) => {
		recordDirtyRef.current = dirty;
		setRecordDirtyState(dirty);
	};
	/** Opens the taxonomy edit panel directly (without asking). Used to keep a saved item open as is. */
	const showRecord = (target: RecordTarget) => {
		setRecordDirty(false);
		setRecordTarget(target);
	};
	/** Opens the taxonomy edit panel. If there are unsaved changes, asks first whether to discard them. */
	const openRecord = async (target: RecordTarget) => {
		if (await confirmDiscard(recordDirtyRef.current)) showRecord(target);
	};
	const closeRecord = () => {
		setRecordDirty(false);
		setRecordTarget(null);
	};
	// The panel belongs to the collection it was opened in: moving to another collection (the guard asked first if it had changes) closes it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: close only when the collection changes
	useEffect(() => {
		if (recordTarget && recordTarget.collection !== collection) closeRecord();
	}, [collection]);
	// The address's `open` (an item opened from, e.g., media usages) opens once into the item slot and is then removed from the address.
	const searchParams = useAdminSearchParams();
	const openParam = searchParams.get(OPEN_ITEM_PARAM);
	// biome-ignore lint/correctness/useExhaustiveDependencies: open only when the address value changes
	useEffect(() => {
		if (!openParam || !site.isItemCollection(collection) || mode === "trash") return;
		showRecord({ collection, id: openParam });
		const next = new URLSearchParams(searchParams.toString());
		next.delete(OPEN_ITEM_PARAM);
		router.replace(site.adminHref(`?${next.toString()}`), { scroll: false });
	}, [openParam]);
	return { recordTarget, openRecord, showRecord, closeRecord, setRecordDirty, guardDialog };
}
