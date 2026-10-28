import { Box, FormField, FormFieldLabel, Text } from "@monti-cms/ui";
import { type ReactNode, useId } from "react";

/** A value shown as text under its label, with no field: what cannot be edited here (the admin address, the site URL). `mono` is for an address or an identifier. */
export function ReadValue({ label, children, mono = true }: { label: string; children: ReactNode; mono?: boolean }) {
	const id = useId();
	return (
		<FormField aria-labelledby={id}>
			<FormFieldLabel id={id}>{label}</FormFieldLabel>
			<Box paddingTop={4}>
				<Text mono={mono}>{children}</Text>
			</Box>
		</FormField>
	);
}
