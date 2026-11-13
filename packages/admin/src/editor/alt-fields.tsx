import {
	FormField,
	FormFieldError,
	FormFieldLabel,
	Inline,
	Input,
	Option,
	Switch,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { Renew, Spark } from "@monti-cms/ui/icons";
import { useId } from "react";
import type { FillState } from "../assistant/use-fill";
import { useAdmin } from "../operations/admin-context";
import { useComposedValue } from "./use-composed-value";

/** How long alt text runs (flow 1·12). */
export const ALT_MAX = 80;

/**
 * What an entry says of a picture, in a settings card (screens/editor.md): a body's image and a media field write it the same way. The box takes the cursor as the card opens.
 * Enter is the place's own: an image goes on to the next one that needs words, a field closes its card. A decorative picture has no words, so its box is not
 * there at all and the cursor stays on the switch; turned off, the box comes back with the cursor in it (2026-11-10, owner: the usual pattern, and no note).
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
	fill,
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
	/**
	 * "✦ Fill" (doc 10, quick tasks): the quick-task model looks at the picture and writes its words. On the label row before the count.
	 * Left out where there is nothing to ask (no assistant, no key, a read-only entry).
	 */
	fill?: { state: FillState; onFill: () => void };
}) {
	const { t } = useAdmin();
	const id = useId();
	const alt = useComposedValue(value, onChange);
	return (
		<>
			{!decorative && (
				<FormField>
					<FormFieldLabel
						htmlFor={id}
						action={
							<Inline gap={8} align="baseline">
								{fill && !readOnly ? (
									<TextButton
										tone="proposal"
										size="micro"
										loading={fill.state.working}
										// The press leaves the caret in the box.
										onMouseDown={(event) => event.preventDefault()}
										onClick={fill.onFill}
									>
										{fill.state.working ? null : alt.value ? <Renew aria-hidden /> : <Spark aria-hidden />}
										{t(fill.state.working ? "fill.working" : alt.value ? "fill.again" : "fill.fill")}
									</TextButton>
								) : null}
								<Text variant="micro" tone="subtle">
									{t("entry.count", { count: alt.value.length, max: ALT_MAX })}
								</Text>
							</Inline>
						}
					>
						{t("editor.image.alt")}
					</FormFieldLabel>
					<Input
						id={id}
						size="md"
						autoFocus
						disabled={readOnly}
						maxLength={ALT_MAX}
						placeholder={placeholder}
						// What a fill wrote is blue until it is changed (components/proposal.md, filling a field).
						proposal={fill !== undefined && alt.value !== "" && fill.state.filled === alt.value}
						aria-invalid={Boolean(fill?.state.failed) || undefined}
						value={alt.value}
						onChange={(event) => alt.change(event.target.value)}
						{...alt.composition}
						onKeyDown={(event) => {
							if (event.key === "Enter" && !event.nativeEvent.isComposing) {
								event.preventDefault();
								onEnter();
							}
						}}
					/>
					{fill?.state.failed ? (
						<FormFieldError>{fill.state.failed}</FormFieldError>
					) : (
						missing && <FormFieldError>{t("editor.image.altMissing")}</FormFieldError>
					)}
				</FormField>
			)}
			<Option spread>
				{t("editor.image.decorative")}
				<Switch checked={decorative} disabled={readOnly} onCheckedChange={onDecorative} />
			</Option>
		</>
	);
}
