import type * as React from "react";
import { useId } from "react";
import { FormField, FormFieldLabel } from "./field";
import { Text } from "./text";

/** A value shown as text under its label, with no field: what cannot be edited here (the admin address, the site URL). `mono` is for an address or an identifier. */
function ReadValue({ label, children, mono = true }: { label: string; children: React.ReactNode; mono?: boolean }) {
	const id = useId();
	return (
		<FormField aria-labelledby={id}>
			<FormFieldLabel id={id}>{label}</FormFieldLabel>
			<div className="pt-monti-6">
				<Text mono={mono}>{children}</Text>
			</div>
		</FormField>
	);
}

export { ReadValue };
