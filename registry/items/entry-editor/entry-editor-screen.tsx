"use client";

import {
	type EntryData,
	EntryEditorProvider,
	type EntryEditorTarget,
	useEntryEditor,
	useEntryEditorContext,
} from "@monti-cms/admin/hooks";
import { FieldRow } from "@/registry/monti/field-row/field-row";

const BUTTON =
	"rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800";

export interface EntryEditorScreenProps {
	/** Who is editing. Scopes the browser recovery copy, so accounts never mix on a shared browser. */
	adminId: string;
	/** What to open: `{ mode: "edit", entryId }` or `{ mode: "new", collection }`. To edit another entry, mount a new screen (`key={entryId}`). */
	target: EntryEditorTarget;
	/** The fields to show, by name in the collection definition. Default `title` and `slug`. */
	fields?: readonly string[];
	/** Called after every successful server write. `created` is true for the first save of a new entry: move the address bar to its edit URL here. */
	onSaved?: (entry: EntryData, info: { created: boolean }) => void;
}

/**
 * A minimal custom editor screen for one entry, built on the public hooks: `useEntryEditor` for load, save, publish and the recovery and conflict
 * state, `useField` (inside `FieldRow`) for each field. The body editor is not part of it. Draw whatever you need on the same hooks.
 *
 * Nothing here navigates, shows a toast or opens a dialog: the hooks return state, and this screen shows it.
 */
export function EntryEditorScreen({ adminId, target, fields = ["title", "slug"], onSaved }: EntryEditorScreenProps) {
	const editor = useEntryEditor({ adminId, target, onSaved });
	if (editor.load.status === "loading") return <p className="p-6 text-sm">Loading…</p>;
	if (editor.load.status === "error") return <p className="p-6 text-red-600 text-sm">{editor.load.error.message}</p>;
	if (editor.load.status === "redirect")
		return <p className="p-6 text-sm">This collection is edited in the list, not here.</p>;
	return (
		<EntryEditorProvider editor={editor}>
			<EntryForm fields={fields} />
		</EntryEditorProvider>
	);
}

function EntryForm({ fields }: { fields: readonly string[] }) {
	const editor = useEntryEditorContext();
	const { saveStatus, saveError, recovery, conflict, readOnly, busy } = editor;
	const working = saveStatus === "saving" || busy !== null;

	return (
		<form
			className="mx-auto grid max-w-xl gap-5 p-6"
			onSubmit={(event) => {
				event.preventDefault();
				void editor.save();
			}}
		>
			{recovery ? (
				<output className="grid gap-2 rounded-md border border-amber-500 p-3 text-sm">
					<p>
						{recovery.kind === "conflict"
							? "A copy from this browser is newer than what you opened, but the server changed since."
							: "Changes from an earlier session are saved in this browser."}
					</p>
					<div className="flex gap-2">
						<button type="button" className={BUTTON} onClick={() => editor.restoreRecovery()}>
							Restore them
						</button>
						<button type="button" className={BUTTON} onClick={() => void editor.discardRecovery()}>
							Discard them
						</button>
					</div>
				</output>
			) : null}
			{conflict ? (
				<div role="alert" className="grid gap-2 rounded-md border border-red-600 p-3 text-sm">
					<p>Someone saved this entry first.</p>
					<div className="flex gap-2">
						<button type="button" className={BUTTON} onClick={() => void editor.overwriteWithMine()}>
							Keep my changes
						</button>
						<button type="button" className={BUTTON} onClick={() => void editor.reload()}>
							Load theirs
						</button>
					</div>
				</div>
			) : null}
			{readOnly ? <p className="text-neutral-500 text-sm">This entry is in the trash and cannot be edited.</p> : null}

			{fields.map((name) => (
				<FieldRow key={name} name={name} />
			))}

			{saveError ? (
				<p role="alert" className="text-red-600 text-sm">
					{saveError.message}
				</p>
			) : null}
			<div className="flex items-center gap-2">
				<button type="submit" className={BUTTON} disabled={working || readOnly || !editor.hasUnsavedChanges}>
					{saveStatus === "saving" ? "Saving…" : "Save draft"}
				</button>
				<button type="button" className={BUTTON} disabled={working || readOnly} onClick={() => void editor.publish()}>
					{busy === "publish" ? "Publishing…" : "Publish"}
				</button>
				<span className="text-neutral-500 text-xs">{saveStatus}</span>
			</div>
		</form>
	);
}
