import { altIsMissing, type MediaDetail, type MediaValue, mediaValueOf } from "@monti-cms/core";
import { FormField, FormFieldError, FormFieldLabel, Input, MediaInput, Option, Switch, Text } from "@monti-cms/ui";
import { useState } from "react";
import { previewUrl } from "../../media/file-text";
import { MediaPickerDialog } from "../../media/media-picker-dialog";
import { UploadActions, useProblemText } from "../../media/upload-problem";
import type { FieldUploads } from "../../media/use-field-uploads";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";

/** A file as a field shows it: its name, and its picture when it has one. */
const shownFile = (file: MediaDetail | null) =>
	file ? { name: file.name, thumbnail: file.kind === "image" ? previewUrl(file) : null } : null;

/**
 * A media field in the property panel (doc 09, screens/editor.md): the file on one line, opening the library's window, and under it what this entry says of the picture. In
 * a translation, an empty field follows the source's file (2026-11-09, owner): choosing or writing makes it this translation's own, and taking it out follows again.
 */
export function MediaField({
	id,
	field,
	label,
	required,
	accept,
	value,
	source,
	whose,
	readOnly,
	uploads,
	onChange,
}: {
	id: string;
	field: string;
	label: string;
	required: boolean;
	accept?: "image" | "any";
	value: unknown;
	/** What it follows while empty. */
	source?: unknown;
	/** In a translation following its source: says whose value shows, and what × does. */
	whose?: { following: string; own: string; clear: string };
	readOnly: boolean;
	uploads: FieldUploads;
	onChange: (next: MediaValue | null) => void;
}) {
	const { t } = useAdmin();
	const problemText = useProblemText();
	const [picking, setPicking] = useState(false);
	const own = mediaValueOf(value);
	const followed = own ? null : mediaValueOf(source);
	const shown = own ?? followed;
	const read = useRead<MediaDetail>("media.get", { id: shown?.media ?? "" }, { skip: !shown });
	const file = read.data?.id === shown?.media ? read.data : null;
	const going = uploads.of(field);
	const isImage = file?.kind === "image";
	const altMissing = isImage && shown && altIsMissing(shown);
	return (
		<>
			<FormField>
				<FormFieldLabel
					htmlFor={id}
					required={required}
					action={
						whose ? (
							<Text variant="caption" tone="faint">
								{own ? whose.own : whose.following}
							</Text>
						) : undefined
					}
				>
					{label}
				</FormFieldLabel>
				<MediaInput
					id={id}
					size="md"
					following={followed !== null && !going}
					value={going ? { name: going.name, thumbnail: going.preview } : shownFile(file)}
					placeholder={t("entry.empty")}
					onOpen={readOnly ? undefined : () => setPicking(true)}
					onClear={
						readOnly || (!own && !going)
							? undefined
							: () => {
									uploads.clear(field);
									onChange(null);
								}
					}
					clearLabel={whose?.clear ?? t("library.field.clear", { label })}
				/>
				{going?.problem && (
					<>
						<FormFieldError>{problemText(going)}</FormFieldError>
						<UploadActions upload={going} onRemove={uploads.remove} onRetry={uploads.retry} onShrink={uploads.shrink} />
					</>
				)}
			</FormField>
			{isImage && (
				<FormField>
					<FormFieldLabel htmlFor={`${id}-alt`}>{t("library.field.alt")}</FormFieldLabel>
					<Input
						id={`${id}-alt`}
						size="md"
						disabled={readOnly || shown?.decorative === true}
						value={own?.alt ?? ""}
						placeholder={followed?.alt || t("entry.empty")}
						onChange={(event) => shown && onChange({ ...own, media: shown.media, alt: event.target.value })}
					/>
					{altMissing && !readOnly && <FormFieldError>{t("library.field.altMissing")}</FormFieldError>}
					<Option spread>
						{t("editor.image.decorative")}
						<Switch
							checked={shown?.decorative === true}
							disabled={readOnly}
							onCheckedChange={(on) => shown && onChange({ ...own, media: shown.media, decorative: on })}
						/>
					</Option>
				</FormField>
			)}
			{picking && (
				<MediaPickerDialog
					kind={accept === "any" ? "any" : "image"}
					title={label}
					confirmLabel={t("library.field.pick")}
					onClose={() => setPicking(false)}
					onPick={(item) => {
						setPicking(false);
						uploads.clear(field);
						onChange({ media: item.id, alt: own?.alt });
					}}
					onFiles={([chosen]) => {
						setPicking(false);
						if (chosen) uploads.add(field, chosen, accept === "any" ? undefined : "image");
					}}
				/>
			)}
		</>
	);
}

/** A media field that is the same in every language, in a translation: the source's file, read only (doc 04). */
export function SharedMediaValue({ value, empty }: { value: unknown; empty: string }) {
	const shown = mediaValueOf(value);
	const read = useRead<MediaDetail>("media.get", { id: shown?.media ?? "" }, { skip: !shown });
	const name = read.data?.id === shown?.media ? read.data?.name : undefined;
	return (
		<Text variant="note" tone={name ? undefined : "faint"}>
			{name ?? empty}
		</Text>
	);
}
