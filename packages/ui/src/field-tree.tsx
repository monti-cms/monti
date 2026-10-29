import type { ComponentProps, ReactNode } from "react";
import { ChangeDot } from "./change-dot";
import { cn } from "./cn";
import { Grip } from "./grip";
import { LockMark } from "./lock-mark";

/**
 * The outline of a collection's fields: one line per field, each with a grip, the name (mono), the label and, at the end, the kind. A list of
 * `FieldRow`. Inside a `FolderTabsBody` the box's own border takes the place of the outer rules.
 */
function FieldTree({ className, ...props }: ComponentProps<"ul">) {
	return <ul data-slot="field-tree" className={cn("m-0 list-none p-0", className)} {...props} />;
}

/** The ink of a name: `warning` is a renamed field, `success` a new one, `faint` one that goes, `danger` one that cannot be saved as it is. */
const NAME_TONE = {
	default: "",
	warning: "text-monti-warning",
	success: "text-monti-success",
	danger: "text-monti-danger",
	faint: "text-monti-faint",
} as const;
const REMOVED = "text-monti-faint line-through decoration-1";

/**
 * One field. `name` is the key as written in the schema (a required field ends it with " !"), `label` what the admin sees, with the field's help text
 * after it in the faint ink (`description`) and a short note of what is special about it (`note`: "renamed from", "new", "not in the panel"); `kind` at the end
 * (mono; it can carry a mark such as "→ Tag"). `tone` colors the name for a change. `depth` indents a field that sits in a group (1) or in a branch of one (2).
 * `group` makes the line a group's: a grey band with its name in sans, bold. A field that cannot be moved has no `grip`; its place stays empty so the names
 * line up. With `gripProps` the grip is the button the field is dragged by. `changed` is an unsaved change; `locked` (its name) puts a lock after the kind
 * for a field a plugin placed. `onOpen` makes the line open the field: its name is the button, and the whole line is its target. `children` sit at the end of
 * the line, over the kind (the row's own buttons). `motion` and `dragging` are the line while it is dragged or while others move aside for it.
 */
function FieldRow({
	name,
	label,
	description,
	note,
	kind,
	depth = 0,
	group = false,
	grip = true,
	gripProps,
	tone = "default",
	removed = false,
	locked,
	changed = false,
	changedLabel,
	onOpen,
	openLabel,
	motion,
	dragging = false,
	className,
	children,
	...props
}: Omit<ComponentProps<"li">, "children" | "style"> & {
	name: ReactNode;
	label?: ReactNode;
	description?: ReactNode;
	note?: ReactNode;
	kind?: ReactNode;
	depth?: 0 | 1 | 2;
	group?: boolean;
	grip?: boolean;
	gripProps?: ComponentProps<"button">;
	tone?: keyof typeof NAME_TONE;
	/** A field that goes when the draft is saved: it stays in the list, its name struck through and faint, and it cannot be opened. */
	removed?: boolean;
	locked?: string;
	changed?: boolean;
	/** The name of the change dot for screen readers. */
	changedLabel?: string;
	onOpen?: () => void;
	/** The name of the button that opens the field. */
	openLabel?: string;
	motion?: { transform?: string; transition?: string };
	dragging?: boolean;
	children?: ReactNode;
}) {
	return (
		<li
			data-slot="field-row"
			data-group={group || undefined}
			style={motion}
			className={cn(
				"group/row relative grid grid-cols-[8px_auto_minmax(0,1fr)_150px] items-center gap-monti-12 border-monti-muted border-b py-monti-10 pr-monti-12 first:border-t",
				depth === 0 && "pl-monti-12",
				depth === 1 && "pl-[28px]",
				depth === 2 && "pl-[44px]",
				group && "bg-monti-muted py-monti-8",
				onOpen && !group && "hover:bg-monti-muted",
				dragging && "z-10 bg-monti-page opacity-80",
				className,
			)}
			{...props}
		>
			<span className="flex text-monti-faint">
				{grip &&
					(gripProps ? (
						<button
							type="button"
							{...gripProps}
							className="relative z-1 flex cursor-grab touch-none border-0 bg-transparent p-0 text-monti-faint outline-none after:absolute after:-inset-2 after:content-[''] hover:text-monti-default focus-visible:rounded-monti-sm focus-visible:ring-2 focus-visible:ring-monti-contrast/20"
						>
							<Grip />
						</button>
					) : (
						<Grip />
					))}
			</span>
			<span
				className={cn(
					"flex items-center gap-monti-8 whitespace-nowrap",
					group ? "font-semibold text-monti-default text-monti-note" : "font-mono text-monti-note",
					!group && (removed ? REMOVED : NAME_TONE[tone]),
				)}
			>
				{onOpen ? (
					<button
						type="button"
						aria-label={openLabel}
						onClick={onOpen}
						className="cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-inherit outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-monti-contrast/20 focus-visible:after:ring-inset"
					>
						{name}
					</button>
				) : (
					name
				)}
				{changed && <ChangeDot label={changedLabel} />}
			</span>
			<span className="min-w-0 truncate text-monti-note text-monti-subtle">
				{label}
				{description && <span className="ml-monti-12 text-monti-faint">{description}</span>}
				{note && <span className="ml-monti-8 text-monti-faint text-monti-micro">{note}</span>}
			</span>
			<span className="flex items-center justify-end gap-monti-6 font-mono text-monti-meta text-monti-muted">
				{kind}
				{locked && <LockMark label={locked} flush className="size-[11px]" />}
			</span>
			{children}
		</li>
	);
}

export { FieldRow, FieldTree };
