"use client";

import type { Collection } from "@monti-cms/core/client";
import { useCallback, useRef, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "../../ui/sheet";
import { RecordPanel } from "../record-panel";
import { useConfirm } from "../shared/confirm-dialog";
import type { EntryData, EntryFormPatch } from "./entry-form";
import { t } from "./translate";

type Request = { collection: Collection; initial: EntryFormPatch };

/** The saved item in the shape of a relation option. */
export const optionOf = (saved: EntryData) => ({
	id: saved.id,
	title: String(saved.working?.metadata.title ?? "") || saved.workingSlug || t("untitled"),
	slug: saved.publishedSlug ?? saved.workingSlug ?? null,
});

/**
 * Right-hand sheet for adding a category (tag, category, collection) from the entry edit screen. Opens the same sheet as the category sheet on the list screen
 * and fills in name, slug, description and translations at once. `create(...)` resolves to the created item on save, or null on close.
 * Render `sheet` once on the screen.
 */
export function useRecordCreator() {
	const [request, setRequest] = useState<Request | null>(null);
	const resolveRef = useRef<((saved: EntryData | null) => void) | null>(null);
	const dirtyRef = useRef(false);
	const { confirmDiscard, dialog } = useConfirm();

	const finish = useCallback((saved: EntryData | null) => {
		resolveRef.current?.(saved);
		resolveRef.current = null;
		dirtyRef.current = false;
		setRequest(null);
	}, []);

	const create = useCallback(
		(collection: Collection, initial: EntryFormPatch) =>
			new Promise<EntryData | null>((resolve) => {
				resolveRef.current?.(null);
				resolveRef.current = resolve;
				dirtyRef.current = false;
				setRequest({ collection, initial });
			}),
		[],
	);

	const sheet = (
		<>
			<Sheet
				open={request !== null}
				onOpenChange={(open) => {
					// Esc and outside clicks also ask about unsaved content, like the sheet's close button.
					if (!open) void confirmDiscard(dirtyRef.current).then((ok) => ok && finish(null));
				}}
			>
				<SheetContent
					showCloseButton={false}
					className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-[22rem] data-[side=right]:sm:max-w-none"
				>
					<SheetTitle className="sr-only">{t("record.add")}</SheetTitle>
					{request && (
						<RecordPanel
							target={{ collection: request.collection, id: null }}
							initial={request.initial}
							className="border-l-0"
							onDirtyChange={(dirty) => {
								dirtyRef.current = dirty;
							}}
							onClose={() => finish(null)}
							onSaved={(saved) => finish(saved)}
						/>
					)}
				</SheetContent>
			</Sheet>
			{dialog}
		</>
	);

	return { create, sheet };
}
