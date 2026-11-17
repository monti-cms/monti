import { FormField, FormFieldLabel } from "@monti-cms/ui";
import type { ComponentProps, ReactNode } from "react";
import { SwitchRow } from "./field-input";

/**
 * One property of the panel, the way every property stands (ST-22): the entry editor's panel and the settings' preview of it assemble their rows here,
 * so the two cannot differ. A choice made by a switch is a `SwitchRow` (the switch at the row's end); every other kind is its name over its input.
 * `label` and `field` are what a row adds to its name and to its box (a proposal's mark, a count, a key the box hears); `children` are the input and
 * what stands under it.
 */
export function PropertyRow({
	id,
	name,
	required,
	toggle,
	proposed,
	after,
	label,
	field,
	children,
}: {
	/** The input's id: the name labels it, or is labelled by it. */
	id: string;
	name: string;
	required?: boolean;
	/** The switch of a choice made by a switch: the row is a `SwitchRow`, and `children` are not drawn. */
	toggle?: ReactNode;
	proposed?: ComponentProps<typeof SwitchRow>["proposed"];
	/** Under a switch row (what saving drops, the saved value). */
	after?: ReactNode;
	label?: Omit<ComponentProps<typeof FormFieldLabel>, "children" | "required">;
	field?: Omit<ComponentProps<typeof FormField>, "children">;
	children?: ReactNode;
}) {
	if (toggle !== undefined) return <SwitchRow id={id} name={name} toggle={toggle} proposed={proposed} after={after} />;
	return (
		<FormField {...field}>
			<FormFieldLabel {...(label?.id === undefined ? { htmlFor: id } : {})} required={required} {...label}>
				{name}
			</FormFieldLabel>
			{children}
		</FormField>
	);
}
