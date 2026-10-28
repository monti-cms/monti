import type { ComponentProps, ReactNode } from "react";
import { ChangeDot } from "./change-dot";
import { cn } from "./cn";
import { Grip } from "./grip";

/**
 * The outline of a collection's fields: one line per field, each with a grip, the name (mono), the label and, at the end, the kind. A list of
 * `FieldRow`. Inside a `FolderTabsBody` the box's own border takes the place of the outer rules.
 */
function FieldTree({ className, ...props }: ComponentProps<"ul">) {
	return <ul data-slot="field-tree" className={cn("m-0 list-none p-0", className)} {...props} />;
}

/**
 * One field. `name` is the key as written in the schema, `label` what the admin sees, `kind` at the end (mono; it can carry a mark such as a
 * required "!"). `nested` indents a field that sits in a group or a branch. `group` makes the line a group's: a grey band with its name in sans, bold.
 * A field that cannot be moved has no `grip`; its place stays empty so the names line up. `changed` is an unsaved change.
 */
function FieldRow({
	name,
	label,
	kind,
	nested = false,
	group = false,
	grip = true,
	changed = false,
	changedLabel,
	className,
	...props
}: Omit<ComponentProps<"li">, "children"> & {
	name: string;
	label?: ReactNode;
	kind?: ReactNode;
	nested?: boolean;
	group?: boolean;
	grip?: boolean;
	changed?: boolean;
	/** The name of the change dot for screen readers. */
	changedLabel?: string;
}) {
	return (
		<li
			data-slot="field-row"
			data-group={group || undefined}
			className={cn(
				"grid grid-cols-[8px_auto_minmax(0,1fr)_150px] items-center gap-monti-12 border-monti-muted border-b py-monti-10 pr-monti-12 first:border-t",
				nested ? "pl-[28px]" : "pl-monti-12",
				group && "bg-monti-muted py-monti-8",
				className,
			)}
			{...props}
		>
			<span className="flex text-monti-faint">{grip && <Grip />}</span>
			<span
				className={cn(
					"flex items-center gap-monti-8 whitespace-nowrap",
					group ? "font-semibold text-monti-default text-monti-note" : "font-mono text-monti-note",
				)}
			>
				{name}
				{changed && <ChangeDot label={changedLabel} />}
			</span>
			<span className="min-w-0 truncate text-monti-note text-monti-subtle">{label}</span>
			<span className="flex items-center justify-end gap-monti-6 font-mono text-monti-meta text-monti-muted">
				{kind}
			</span>
		</li>
	);
}

export { FieldRow, FieldTree };
