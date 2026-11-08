import { type MediaDetail, type MediaItem, mediaValueOf } from "@monti-cms/core";
import { FormField, FormFieldError, FormFieldLabel, Input, MediaInput, Text } from "@monti-cms/ui";
import { useState } from "react";
import { previewUrl } from "../../media/file-text";
import { MediaPickerDialog } from "../../media/media-picker-dialog";
import { useUpload } from "../../media/use-upload";
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
	label,
	required,
	accept,
	value,
	source,
	readOnly,
	onChange,
}: {
	id: string;
	label: string;
	required: boolean;
	accept?: "image" | "any";
	value: unknown;
	/** What it follows while empty. */
	source?: unknown;
	readOnly: boolean;
	onChange: (next: { media: string; alt?: string } | null) => void;
}) {
	const { t } = useAdmin();
	const [picking, setPicking] = useState(false);
	const own = mediaValueOf(value);
	const followed = own ? null : mediaValueOf(source);
	const shown = own ?? followed;
	const read = useRead<MediaDetail>("media.get", { id: shown?.media ?? "" }, { skip: !shown });
	const file = read.data?.id === shown?.media ? read.data : null;
	const upload = useUpload({
		onUploaded: (item: MediaItem) => onChange({ media: item.id, alt: own?.alt }),
	});
	const [going] = upload.uploads;
	const isImage = file?.kind === "image";
	const altMissing = isImage && !shown?.decorative && !shown?.alt?.trim();
	return (
		<>
			<FormField>
				<FormFieldLabel htmlFor={id} required={required}>
					{label}
				</FormFieldLabel>
				<MediaInput
					id={id}
					size="md"
					following={followed !== null}
					value={going ? { name: going.name, thumbnail: going.preview } : shownFile(file)}
					placeholder={t("entry.empty")}
					onOpen={readOnly ? undefined : () => setPicking(true)}
					onClear={readOnly || !own ? undefined : () => onChange(null)}
					clearLabel={t("library.field.clear", { label })}
				/>
				{going?.problem && (
					<FormFieldError>
						{going.problem === "tooBig" ? t("library.failed.failed") : t(`library.failed.${going.problem}`)}
					</FormFieldError>
				)}
			</FormField>
			{isImage && (
				<FormField>
					<FormFieldLabel htmlFor={`${id}-alt`}>{t("library.field.alt")}</FormFieldLabel>
					<Input
						id={`${id}-alt`}
						size="md"
						disabled={readOnly}
						value={own?.alt ?? ""}
						placeholder={followed?.alt || t("entry.empty")}
						onChange={(event) => shown && onChange({ ...own, media: shown.media, alt: event.target.value })}
					/>
					{altMissing && !readOnly && <FormFieldError>{t("library.field.altMissing")}</FormFieldError>}
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
						onChange({ media: item.id, alt: own?.alt });
					}}
					onFiles={(files) => {
						setPicking(false);
						upload.add(files.slice(0, 1));
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
