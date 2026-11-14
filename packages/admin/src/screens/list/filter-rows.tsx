import { DropdownMenuCheckboxItem, DropdownMenuGroup, DropdownMenuLabel, MenuShortcut } from "@monti-cms/ui";

/**
 * One value of a column's filter, in every table's column menu (components/list.md): a box that is ticked or not, and at the end how many rows it would show. The
 * menu stays open as values are ticked.
 */
export function ValueRow({
	checked,
	onToggle,
	label,
	counted,
}: {
	checked: boolean;
	onToggle: () => void;
	label: string;
	/** How many rows the value holds; `null` while the counts are being read. */
	counted: number | null;
}) {
	return (
		<DropdownMenuCheckboxItem box checked={checked} closeOnClick={false} onCheckedChange={onToggle}>
			{label}
			{counted !== null && <MenuShortcut>{counted}</MenuShortcut>}
		</DropdownMenuCheckboxItem>
	);
}

/** Toggles one value of a filter that takes several. */
export function toggled<T>(chosen: readonly T[], value: T): T[] {
	return chosen.includes(value) ? chosen.filter((each) => each !== value) : [...chosen, value];
}

export type FilterProps<Value extends string> = {
	values: readonly { value: Value; label: string; count: number }[];
	chosen: readonly Value[];
	onChange: (chosen: Value[]) => void;
	/** Where the counts are counted, said over the rows when it is more than the screen shows (a folder's files and those below it). */
	countedWhere?: string;
};

/** A filter's values as a column menu's rows. */
export function FilterRows<Value extends string>({ values, chosen, onChange, countedWhere }: FilterProps<Value>) {
	const rows = values.map((each) => (
		<ValueRow
			key={each.value}
			checked={chosen.includes(each.value)}
			onToggle={() => onChange(toggled(chosen, each.value))}
			label={each.label}
			counted={each.count}
		/>
	));
	return countedWhere ? (
		<DropdownMenuGroup>
			<DropdownMenuLabel>{countedWhere}</DropdownMenuLabel>
			{rows}
		</DropdownMenuGroup>
	) : (
		rows
	);
}
