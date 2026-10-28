import { Box, FormFieldDescription, FormFieldLabel, Inline, Stack, FormField as UiField } from "@monti-cms/ui";
import type { ComponentProps, ReactNode } from "react";

/** How wide the control of a field is: controls share a unified editorial column width (`reading`), while `full` spans the whole container. */
const CONTROL_MAX_WIDTH = { narrow: "reading", normal: "reading", wide: "reading", full: undefined } as const;
export type ControlWidth = keyof typeof CONTROL_MAX_WIDTH;

export function Labeled({
	label,
	description,
	hint,
	children,
	htmlFor,
	control = "normal",
	aside,
	changed,
	required,
}: {
	label: ReactNode;
	/** A field description explaining what the setting is, placed between label and control. */
	description?: ReactNode;
	/** An input hint or helper text, placed beneath the control. */
	hint?: ReactNode;
	htmlFor?: string;
	children: ReactNode;
	control?: ControlWidth;
	/** Next to the label on the same line (a change marker, a revert button). */
	aside?: ReactNode;
	/** The field differs from the saved value: the label row shows the change dot and the undo button (see `FormFieldLabel`). */
	changed?: ComponentProps<typeof FormFieldLabel>["changed"];
	/** The field must be filled in: the label ends with a red star. Only in a form that also has optional fields; the control carries the real `required`. */
	required?: boolean;
}) {
	const labelNode = (
		<FormFieldLabel htmlFor={htmlFor} required={required} changed={changed}>
			{label}
		</FormFieldLabel>
	);

	return (
		<UiField>
			<Stack gap={description || hint ? 8 : 2}>
				{aside ? (
					<Inline gap={8}>
						{labelNode}
						{aside}
					</Inline>
				) : (
					labelNode
				)}
				{description && (
					<Box maxWidth="reading">
						<FormFieldDescription>{description}</FormFieldDescription>
					</Box>
				)}
				{/* The control and its error line are one column, the error 2px under the control like every field's label row. */}
				<Stack gap={2} width="full" maxWidth={CONTROL_MAX_WIDTH[control]}>
					{children}
				</Stack>
				{hint && (
					<Box maxWidth="reading">
						<FormFieldDescription>{hint}</FormFieldDescription>
					</Box>
				)}
			</Stack>
		</UiField>
	);
}
