import type * as React from "react";
import { useId } from "react";
import { FormField, FormFieldLabel } from "./field";
import { Text } from "./text";

/**
 * A value shown as text under its label, with no field: what cannot be edited here (the admin address, the site URL). `mono` is for an address or an identifier.
 * `size="label"`: a settings page's field (2026-11 redesign): the label as `FormFieldLabel size="label"`, the value on a 32px row (as tall as the inputs
 * beside it) in 14px, a mono identifier in 12px (as a key's identifier); `aside` after it says why it cannot change ("바꿀 수 없음", 12px faint, 4px after a `LockMark`).
 */
function ReadValue({
	label,
	children,
	mono = true,
	size = "caption",
	aside,
}: {
	label: string;
	children: React.ReactNode;
	mono?: boolean;
	size?: "caption" | "label";
	aside?: React.ReactNode;
}) {
	const id = useId();
	if (size === "label")
		return (
			<FormField spacing="label" aria-labelledby={id}>
				<FormFieldLabel id={id} size="label">
					{label}
				</FormFieldLabel>
				<div className="flex h-monti-control-md items-center gap-monti-4 text-monti-body text-monti-default">
					<span className={mono ? "font-mono text-monti-caption" : undefined}>{children}</span>
					{aside && <span className="text-monti-caption text-monti-faint">{aside}</span>}
				</div>
			</FormField>
		);
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
