import { Box, FormFieldDescription, FormFieldLabel, Inline, Stack, Text, FormField as UiField } from "@monti-cms/ui";
import type { ReactNode } from "react";

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
	/** The field must be filled in: the label ends with a red star. Only in a form that also has optional fields; the control carries the real `required`. */
	required?: boolean;
}) {
	const labelNode = (
		<FormFieldLabel htmlFor={htmlFor} required={required}>
			<Text variant="body" weight="medium">
				{label}
			</Text>
		</FormFieldLabel>
	);

	return (
		<UiField>
			<Stack gap={8}>
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
				<Box width="full" maxWidth={CONTROL_MAX_WIDTH[control]}>
					{children}
				</Box>
				{hint && (
					<Box maxWidth="reading">
						<FormFieldDescription>{hint}</FormFieldDescription>
					</Box>
				)}
			</Stack>
		</UiField>
	);
}
