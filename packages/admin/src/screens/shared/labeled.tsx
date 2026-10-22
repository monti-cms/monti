import { Box, FormFieldDescription, FormFieldLabel, Inline, Stack, Text, FormField as UiField } from "@monti-cms/ui";
import type { ReactNode } from "react";

/** How wide the control of a field is: short values and choices stay narrow, text takes more, a list or a row of controls takes the whole width. */
const CONTROL_MAX_WIDTH = { narrow: "panel-lg", normal: "prose", wide: "prose", full: undefined } as const;
export type ControlWidth = keyof typeof CONTROL_MAX_WIDTH;

export function Labeled({
	label,
	description,
	hint,
	children,
	htmlFor,
	control = "normal",
	aside,
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
}) {
	const labelNode = (
		<FormFieldLabel htmlFor={htmlFor}>
			<Text variant="body" weight="medium">
				{label}
			</Text>
		</FormFieldLabel>
	);
	return (
		<UiField>
			<Stack gap="condensed">
				{aside ? (
					<Inline gap="condensed">
						{labelNode}
						{aside}
					</Inline>
				) : (
					labelNode
				)}
				{description && (
					<Box maxWidth="prose">
						<FormFieldDescription>{description}</FormFieldDescription>
					</Box>
				)}
				<Box width="full" maxWidth={CONTROL_MAX_WIDTH[control]}>
					{children}
				</Box>
				{hint && (
					<Box maxWidth="prose">
						<FormFieldDescription>{hint}</FormFieldDescription>
					</Box>
				)}
			</Stack>
		</UiField>
	);
}
