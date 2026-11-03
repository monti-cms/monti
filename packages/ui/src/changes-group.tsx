import { type ReactNode, useState } from "react";
import { Button } from "./button";
import { Caret } from "./caret";
import { Count } from "./count";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./dropdown-menu";
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

/** What the assistant proposed and nobody has taken yet: the field's name and the button that discards the proposal. */
interface ProposalsItem {
	id: string;
	name: ReactNode;
	onDiscard: () => void;
}

/**
 * How the save group looks: "changes N" (and "· proposals N" in blue), then "undo all" and the one primary pill ("save and apply"). `list` is what
 * "changes N" opens, hanging from the whole group with its right edge on the group's; without it the group is drawn and opens nothing (a screen spec's
 * look, before its behavior is wired). The pill is disabled (not hidden) while something blocks saving.
 */
function ChangesBar({
	label,
	count,
	countLabel,
	listLabel,
	proposalsLabel,
	proposalsCount,
	proposalsCountLabel,
	discardLabel,
	onDiscard,
	saveLabel,
	onSave,
	saveDisabled,
	saveDanger,
	list,
	...props
}: {
	/** "changes". */
	label: string;
	count: number;
	/** The count spoken ("3 changes"). */
	countLabel?: string;
	/** The name of the list for a screen reader. */
	listLabel?: string;
	/** "proposals", while the assistant's proposals wait in the form. */
	proposalsLabel?: string;
	proposalsCount?: number;
	/** The count spoken ("2 proposals"). */
	proposalsCountLabel?: string;
	/** "undo all". */
	discardLabel: string;
	onDiscard?: () => void;
	saveLabel: string;
	onSave?: () => void;
	saveDisabled?: boolean;
	saveDanger?: boolean;
	/** The changes, as menu rows. */
	list?: ReactNode;
} & Omit<React.ComponentProps<"section">, "children" | "onSelect">) {
	const [group, setGroup] = useState<HTMLElement | null>(null);
	return (
		<section ref={setGroup} data-slot="changes-group" className="flex items-center gap-monti-16" {...props}>
			<DropdownMenu>
				<DropdownMenuTrigger render={<TextButton aria-label={listLabel} />}>
					{label}{" "}
					<Count tone="warning" aria-label={countLabel}>
						{count}
					</Count>
					{proposalsLabel && (proposalsCount ?? 0) > 0 && (
						<>
							{" "}
							<span className="text-monti-faint">·</span>{" "}
							<span className="text-monti-proposal">
								{proposalsLabel}{" "}
								<Count tone="proposal" aria-label={proposalsCountLabel}>
									{proposalsCount}
								</Count>
							</span>
						</>
					)}
					<Caret />
				</DropdownMenuTrigger>
				{list && (
					<DropdownMenuContent align="end" anchor={group ?? undefined} width="panel">
						{list}
					</DropdownMenuContent>
				)}
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

/**
 * The save group in the title row of a settings screen while the draft has changes: {@link ChangesBar} with the list of changes it opens, each with its
 * own undo. While the assistant's proposals wait in the form, `proposals` adds "· proposals N" in blue after the count, and the list ends with them, each
 * with its own discard.
 */
function ChangesGroup({
	label,
	listLabel,
	countLabel,
	items,
	undoLabel,
	proposals,
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
	/** The assistant's proposals in the form, not taken yet. */
	proposals?: {
		/** "proposals". */
		label: string;
		/** The count spoken ("2 proposals"). */
		countLabel: string;
		/** "discard". */
		discardLabel: string;
		items: readonly ProposalsItem[];
	};
} & Omit<React.ComponentProps<"section">, "children" | "onSelect">) {
	return (
		<ChangesBar
			label={label}
			count={items.length}
			countLabel={countLabel}
			listLabel={listLabel}
			proposalsLabel={proposals?.label}
			proposalsCount={proposals?.items.length}
			proposalsCountLabel={proposals?.countLabel}
			list={
				<>
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
					{proposals && proposals.items.length > 0 && (
						<>
							<DropdownMenuSeparator />
							{proposals.items.map((item) => (
								<DropdownMenuItem key={item.id} onClick={item.onDiscard}>
									<span className="inline-flex items-baseline gap-monti-4">
										{item.name}{" "}
										<Text variant="meta" tone="proposal">
											{proposals.label}
										</Text>
									</span>
									<MenuShortcut>{proposals.discardLabel}</MenuShortcut>
								</DropdownMenuItem>
							))}
						</>
					)}
				</>
			}
			{...props}
		/>
	);
}

export { ChangesBar, ChangesGroup, type ChangesItem, type ProposalsItem };
