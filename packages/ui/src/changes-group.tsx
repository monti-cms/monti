import { type ReactNode, useState } from "react";
import { Button } from "./button";
import { Caret } from "./caret";
import { Count } from "./count";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";
import { MenuShortcut } from "./menu-parts";
import { Text } from "./text";
import { TextButton } from "./text-button";

/** One change in the list: its name, how it changed (the tag is colored by `tone`) and the button that puts it back. */
interface ChangesItem {
	id: string;
	name: ReactNode;
	tag: ReactNode;
	tone: "warning" | "danger" | "success";
	onUndo: () => void;
}

/**
 * The save group in the title row of a settings screen while the draft has changes: "changes N" opens the list of changes, each with its own undo; then
 * "undo all" and the one primary pill ("save and apply"). The pill is disabled (not hidden) while something blocks saving. The list hangs from the whole
 * group, its right edge on the group's.
 */
function ChangesGroup({
	label,
	listLabel,
	countLabel,
	items,
	undoLabel,
	discardLabel,
	onDiscard,
	saveLabel,
	onSave,
	saveDisabled,
	saveDanger,
	...props
}: {
	/** "changes". */
	label: string;
	/** The name of the list for a screen reader. */
	listLabel: string;
	/** The count spoken ("3 changes"). */
	countLabel: string;
	items: readonly ChangesItem[];
	/** "undo". */
	undoLabel: string;
	discardLabel: string;
	onDiscard: () => void;
	saveLabel: string;
	onSave: () => void;
	saveDisabled?: boolean;
	saveDanger?: boolean;
} & Omit<React.ComponentProps<"section">, "children" | "onSelect">) {
	const [group, setGroup] = useState<HTMLElement | null>(null);
	return (
		<section ref={setGroup} data-slot="changes-group" className="flex items-center gap-monti-16" {...props}>
			<DropdownMenu>
				<DropdownMenuTrigger render={<TextButton aria-label={listLabel} />}>
					{label}{" "}
					<Count tone="warning" aria-label={countLabel}>
						{items.length}
					</Count>
					<Caret />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" anchor={group ?? undefined} width="panel">
					{items.map((item) => (
						<DropdownMenuItem key={item.id} onClick={item.onUndo}>
							<span className="inline-flex items-baseline gap-monti-4">
								{item.name}{" "}
								<Text variant="meta" tone={item.tone}>
									{item.tag}
								</Text>
							</span>
							<MenuShortcut>{undoLabel}</MenuShortcut>
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
			<TextButton type="button" onClick={onDiscard}>
				{discardLabel}
			</TextButton>
			<Button type="button" variant={saveDanger ? "danger" : "primary"} disabled={saveDisabled} onClick={onSave}>
				{saveLabel}
			</Button>
		</section>
	);
}

export { ChangesGroup, type ChangesItem };
