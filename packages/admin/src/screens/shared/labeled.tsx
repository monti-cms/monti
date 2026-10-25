import { Box, FormFieldDescription, FormFieldLabel, Inline, Stack, Text, FormField as UiField } from "@monti-cms/ui";
import type { ReactNode } from "react";
import { useInSectionRow } from "./section";

/** How wide the control of a field is: controls share a unified editorial column width (`prose`), while `full` spans the whole container. */
const CONTROL_MAX_WIDTH = { narrow: "prose", normal: "prose", wide: "prose", full: undefined } as const;
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
	const inSectionRow = useInSectionRow();
	const labelNode = (
		<FormFieldLabel htmlFor={htmlFor}>
			<Text variant="body" weight="medium">
				{label}
			</Text>
		</FormFieldLabel>
	);

	if (inSectionRow && control !== "full") {
		return (
			<UiField>
				<Inline align="center" justify="between" gap="spacious" paddingY="normal">
					<Stack gap="hair" minWidth={0}>
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
					</Stack>
					<Stack gap="tight" width="full" maxWidth="panel">
						<Box width="full">{children}</Box>
						{hint && <FormFieldDescription>{hint}</FormFieldDescription>}
					</Stack>
				</Inline>
			</UiField>
		);
	}

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
