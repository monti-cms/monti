import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@monti-cms/ui";

/** A select of a few values with their labels: the field sheet's settings and the review's answers. */
export function PickOne({
	id,
	items,
	value,
	onChange,
	width = "full",
	size,
	disabled,
	label,
	placeholder,
}: {
	id?: string;
	items: { value: string; label: string }[];
	value: string | null;
	onChange: (value: string) => void;
	width?: "full" | "fit" | "choice";
	size?: "sm" | "default";
	disabled?: boolean;
	/** The name for screen readers when no label points at it. */
	label?: string;
	placeholder?: string;
}) {
	return (
		<Select
			items={items}
			value={value}
			onValueChange={(next) => next !== null && onChange(String(next))}
			disabled={disabled}
		>
			<SelectTrigger id={id} width={width} size={size} aria-label={label}>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				{items.map((item) => (
					<SelectItem key={item.value} value={item.value}>
						{item.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
