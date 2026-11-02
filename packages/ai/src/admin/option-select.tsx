"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@monti-cms/admin/kit";

type Option = { value: string; label: string };

/** A small select of the AI plugin's screens (the translation dialog). The closed field shows the name, not the value. */
export function OptionSelect({
	id,
	value,
	options,
	onChange,
	disabled,
	width = "full",
	"aria-label": ariaLabel,
}: {
	id?: string;
	value: string;
	options: readonly Option[];
	onChange: (value: string) => void;
	disabled?: boolean;
	width?: "fit" | "full";
	"aria-label"?: string;
}) {
	return (
		<Select
			value={value}
			items={options}
			disabled={disabled}
			onValueChange={(next) => typeof next === "string" && onChange(next)}
		>
			<SelectTrigger id={id} size="sm" width={width} aria-label={ariaLabel}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
