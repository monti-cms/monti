import { FormField, FormFieldError, FormFieldLabel, Input, Option, Switch, Text } from "@monti-cms/ui";
import { useId } from "react";
import { useAdmin } from "../operations/admin-context";
import { useComposedValue } from "./use-composed-value";

/** How long alt text runs (flow 1·12). */
const ALT_MAX = 80;

/**
 * What an entry says of a picture, in a settings card (screens/editor.md): a body's image and a media field write it the same way. The box takes the cursor as the card opens.
 * Enter is the place's own: an image goes on to the next one that needs words, a field closes its card.
 */
export function AltFields({
	value,
	decorative,
	readOnly = false,
	placeholder,
	missing = false,
	onChange,
	onDecorative,
	onEnter,
}: {
	value: string;
	decorative: boolean;
	readOnly?: boolean;
	/** What shows while there are no words: a translation's are the source's until it has its own. */
	placeholder?: string;
	/** Says here that the words are missing. A field says it under its own row, where it shows with the card closed. */
	missing?: boolean;
	onChange: (next: string) => void;
	onDecorative: (on: boolean) => void;
	onEnter: () => void;
}) {
	const { t } = useAdmin();
	const id = useId();
	const alt = useComposedValue(value, onChange);
	return (
		<>
			<FormField>
				<FormFieldLabel
					htmlFor={id}
					action={
						<Text variant="micro" tone="subtle">
							{t("entry.count", { count: alt.value.length, max: ALT_MAX })}
						</Text>
					}
				>
					{t("editor.image.alt")}
				</FormFieldLabel>
				<Input
					id={id}
					size="md"
					autoFocus
					disabled={readOnly || decorative}
					maxLength={ALT_MAX}
					placeholder={placeholder}
					value={alt.value}
					onChange={(event) => alt.change(event.target.value)}
					{...alt.composition}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							onEnter();
						}
					}}
				/>
				{missing && <FormFieldError>{t("editor.image.altMissing")}</FormFieldError>}
			</FormField>
			<Option spread>
				{t("editor.image.decorative")}
				<Switch checked={decorative} disabled={readOnly} onCheckedChange={onDecorative} />
			</Option>
		</>
	);
}
