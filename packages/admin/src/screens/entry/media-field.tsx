import { altIsMissing, type MediaDetail, type MediaValue, mediaValueOf } from "@monti-cms/core";
import {
	FormField,
	FormFieldError,
	FormFieldLabel,
	IconButton,
	MediaInput,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Stack,
	Text,
} from "@monti-cms/ui";
import { Settings } from "@monti-cms/ui/icons";
import { useState } from "react";
import { AltFields } from "../../editor/alt-fields";
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
 * A media field in the property panel (doc 09, screens/editor.md): the file on one line, opening the library's window, and what this entry says of the picture in the settings
 * card at the end of that line, as a body's image has it (2026-11-09, owner). In a translation, an empty field follows the source's file (2026-11-09, owner): choosing or writing makes it this translation's own, and taking it out follows again.
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
	card,
	onCard,
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
	/** Whether the picture's settings card is open: the editor's, so a to-do row can open it. */
	card: boolean;
	onCard: (open: boolean) => void;
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
						whose && !going ? (
							<Text variant="caption" tone="subtle">
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
					// On a file going up or stopped, × takes out that file: the field goes back to what it had.
					onClear={going ? () => uploads.clear(field) : readOnly || !own ? undefined : () => onChange(null)}
					clearLabel={(!going && whose?.clear) || t("library.field.clear", { label })}
					action={
						isImage && shown ? (
							<Popover open={card} onOpenChange={onCard}>
								<IconButton
									label={t("library.field.settings", { label })}
									pressed={card}
									trigger={(button) => <PopoverTrigger render={button} />}
								>
									<Settings aria-hidden />
								</IconButton>
								<PopoverContent align="end">
									<Stack gap={12}>
										<AltFields
											value={own?.alt ?? ""}
											decorative={shown.decorative === true}
											readOnly={readOnly}
											placeholder={followed?.alt || t("entry.empty")}
											onChange={(alt) => onChange({ ...own, media: shown.media, alt })}
											onDecorative={(decorative) => onChange({ ...own, media: shown.media, decorative })}
											onEnter={() => onCard(false)}
										/>
									</Stack>
								</PopoverContent>
							</Popover>
						) : undefined
					}
				/>
				{altMissing && !readOnly && <FormFieldError>{t("editor.image.altMissing")}</FormFieldError>}
				{going?.problem && (
					<>
						<FormFieldError>{problemText(going)}</FormFieldError>
						<UploadActions upload={going} onRetry={uploads.retry} onShrink={uploads.shrink} />
					</>
				)}
			</FormField>
			{picking && (
				<MediaPickerDialog
					kind={accept === "any" ? "any" : "image"}
					title={label}
					confirmLabel={t("library.field.pick")}
					onClose={() => setPicking(false)}
					onPick={(item) => {
						setPicking(false);
						uploads.clear(field);
						// Alt text says what a picture shows, so another file starts with none (2026-11-09, owner). The same file keeps it.
						onChange(item.id === own?.media ? own : { media: item.id });
					}}
					onFiles={([chosen]) => {
						setPicking(false);
						if (chosen) uploads.add(field, chosen, own?.alt, accept === "any" ? undefined : "image");
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
