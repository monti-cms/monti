import { altIsMissing, cleanMediaValue, type MediaDetail, type MediaValue, mediaValueOf } from "@monti-cms/core";
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
import { type ReactNode, useRef, useState } from "react";
import { AltFields } from "../../editor/alt-fields";
import { previewUrl } from "../../media/file-text";
import { MediaPickerDialog } from "../../media/media-picker-dialog";
import { RetryButton, useAcceptFiles } from "../../media/upload-problem";
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
	change,
	value,
	source,
	following,
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
	/** The mark on a translation's own value when the source's moved on: in the place of whose value it is. */
	change?: ReactNode;
	value: unknown;
	/** What it follows while empty. */
	source?: unknown;
	/** In a translation following its source: the mark while it follows (empty, or showing the source's file); its own value needs none. */
	following?: string;
	readOnly: boolean;
	uploads: FieldUploads;
	/** Whether the picture's settings card is open: the editor's, so a to-do row can open it. */
	card: boolean;
	onCard: (open: boolean) => void;
	onChange: (next: MediaValue | null) => void;
}) {
	const { t } = useAdmin();
	const acceptFiles = useAcceptFiles();
	const line = useRef<HTMLDivElement>(null);
	const [picking, setPicking] = useState(false);
	const own = mediaValueOf(value);
	const followed = own ? null : mediaValueOf(source);
	const shown = own ?? followed;
	const read = useRead<MediaDetail>("media.get", { id: shown?.media ?? "" }, { skip: !shown });
	const file = read.data?.id === shown?.media ? read.data : null;
	const going = uploads.of(field);
	const isImage = file?.kind === "image";
	const said = uploads.saidOf(field);
	const altMissing = going ? going.preview !== null && altIsMissing(said) : isImage && shown && altIsMissing(shown);
	return (
		<>
			<FormField>
				<FormFieldLabel
					htmlFor={id}
					required={required}
					action={
						change && !going ? (
							change
						) : following && !own && !going ? (
							<Text variant="micro" tone="faint">
								{following}
							</Text>
						) : undefined
					}
				>
					{label}
				</FormFieldLabel>
				<MediaInput
					ref={line}
					id={id}
					size="md"
					following={followed !== null && !going}
					value={going ? { name: going.name, thumbnail: going.preview } : shownFile(file)}
					placeholder={t("entry.empty")}
					readOnly={readOnly}
					onOpen={() => setPicking(true)}
					// On a file going up or stopped, × takes out that file: the field goes back to what it had.
					onClear={going ? () => uploads.clear(field) : readOnly || !own ? undefined : () => onChange(null)}
					clearLabel={t("library.field.clear", { label })}
					action={
						going?.status === "failed" ? (
							<RetryButton onRetry={() => uploads.retry(going)} />
						) : isImage && shown ? (
							<Popover open={card} onOpenChange={onCard}>
								<IconButton
									label={t("library.field.settings", { label })}
									pressed={card}
									trigger={(button) => <PopoverTrigger render={button} />}
								>
									<Settings aria-hidden />
								</IconButton>
								{/* As wide as the line it belongs to, right under it (2026-11-09, owner). */}
								<PopoverContent anchor={line} align="start" width="anchor">
									<Stack gap={12}>
										<AltFields
											// While a new file goes up, these are about it, and wait with it.
											value={(going ? said.alt : own?.alt) ?? ""}
											decorative={(going ? said.decorative : shown.decorative) === true}
											readOnly={readOnly}
											placeholder={(!going && followed?.alt) || t("entry.empty")}
											onChange={(alt) =>
												going
													? uploads.say(field, { alt })
													: onChange(cleanMediaValue({ ...own, media: shown.media, alt }))
											}
											onDecorative={(decorative) =>
												going
													? uploads.say(field, { decorative })
													: onChange(cleanMediaValue({ ...own, media: shown.media, decorative }))
											}
											onEnter={() => onCard(false)}
										/>
									</Stack>
								</PopoverContent>
							</Popover>
						) : undefined
					}
				/>
				{altMissing && !readOnly && going?.status !== "failed" && (
					<FormFieldError>{t("editor.image.altMissing")}</FormFieldError>
				)}
				{going?.status === "failed" && <FormFieldError>{t("library.failed")}</FormFieldError>}
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
					onFiles={([chosen], folder) => {
						setPicking(false);
						if (!chosen) return;
						const only = accept === "any" ? undefined : "image";
						// One the library refuses leaves the field as it was.
						void acceptFiles([chosen], only).then(([taken]) => {
							if (taken) uploads.add(field, taken, folder, only);
						});
					}}
				/>
			)}
		</>
	);
}

/** A media field that is the same in every language, in a translation: the source's file, read only (doc 04). */
export function SharedMediaValue({
	value,
	empty,
	withAlt = false,
}: {
	value: unknown;
	empty: string;
	/** Says what the entry says of it too: a change card, where that may be all that changed. */
	withAlt?: boolean;
}) {
	const { t } = useAdmin();
	const shown = mediaValueOf(value);
	const read = useRead<MediaDetail>("media.get", { id: shown?.media ?? "" }, { skip: !shown });
	const name = read.data?.id === shown?.media ? read.data?.name : undefined;
	const words = shown?.decorative ? t("editor.image.decorative") : shown?.alt;
	return (
		<Text variant="note" tone={name ? undefined : "faint"}>
			{name && withAlt && words ? `${name} · ${words}` : (name ?? empty)}
		</Text>
	);
}
