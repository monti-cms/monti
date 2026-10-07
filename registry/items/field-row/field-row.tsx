"use client";

import { useField } from "@monti-cms/admin/hooks";
import type { ReactNode } from "react";

const CONTROL =
	"w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm aria-invalid:border-red-600 disabled:opacity-60 dark:border-neutral-700";

/**
 * One field of an entry form, drawn on `useField(name)`: label, the control for the value, the description and the first error. The component
 * re-renders only when this field changes, so typing here does not redraw the other rows. It must sit below an `EntryEditorProvider`.
 *
 * It covers text, slug and select fields (the value is a string). A field of another kind (a relation, a media field) shows a note: draw it with
 * your own control, reading the same `useField` state.
 */
export function FieldRow({ name }: { name: string }) {
	const field = useField(name);
	if (field.hidden) return null;
	const kind = field.definition?.kind;
	const value = typeof field.value === "string" ? field.value : "";
	const editable = field.value === null || typeof field.value === "string";

	let control: ReactNode;
	if (!editable) {
		control = <p className="text-neutral-500 text-sm">This field is edited in the admin screen.</p>;
	} else if (field.definition?.kind === "select") {
		control = (
			<select
				{...field.inputProps}
				className={CONTROL}
				value={value}
				onChange={(event) => field.setValue(event.target.value)}
			>
				{Object.entries(field.definition.options).map(([key, label]) => (
					<option key={key} value={key}>
						{label}
					</option>
				))}
			</select>
		);
	} else if (field.definition?.kind === "text" && field.definition.multiline) {
		control = (
			<textarea
				{...field.inputProps}
				className={CONTROL}
				rows={field.definition.rows ?? 4}
				value={value}
				maxLength={field.definition.max}
				placeholder={field.definition.placeholder}
				onChange={(event) => field.setValue(event.target.value)}
			/>
		);
	} else {
		control = (
			<input
				{...field.inputProps}
				className={CONTROL}
				value={value}
				maxLength={field.definition?.kind === "text" ? field.definition.max : undefined}
				placeholder={kind === "text" || kind === "slug" ? field.definition?.placeholder : undefined}
				onChange={(event) => field.setValue(event.target.value)}
			/>
		);
	}

	return (
		<div className="grid gap-1.5">
			<label htmlFor={field.ids.input} className="font-medium text-sm">
				{field.label}
				{field.required ? <span aria-hidden> *</span> : null}
			</label>
			{control}
			{field.description ? <p className="text-neutral-500 text-xs">{field.description}</p> : null}
			{field.lockedNote ? <p className="text-neutral-500 text-xs">{field.lockedNote}</p> : null}
			{field.error ? (
				<p id={field.ids.error} role="alert" className="text-red-600 text-xs">
					{field.error.message}
				</p>
			) : null}
		</div>
	);
}
