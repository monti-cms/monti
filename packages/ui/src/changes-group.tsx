import { type ReactNode, useCallback, useState } from "react";
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
import { Text } from "./text";
import { TextButton } from "./text-button";

/** One change in the list: its name, how it changed (the tag is colored by `tone`), where pressing the row goes (`onOpen`: the field, the tab) and the button that puts it back. */
interface ChangesItem {
	id: string;
	name: ReactNode;
	tag: ReactNode;
	tone: "warning" | "danger" | "success";
	onOpen?: () => void;
	onUndo: () => void;
}

/** What the assistant proposed and nobody has taken yet: the field's name, where pressing the row goes, and the button that discards the proposal. */
interface ProposalsItem {
	id: string;
	name: ReactNode;
	onOpen?: () => void;
	onDiscard: () => void;
}

/**
 * One row of the list: pressing the row goes to the place (`onOpen`); the button at its end puts it back and keeps the list open, so several can be undone
 * in a row. Delete or Backspace on the row does the same as its button.
 */
function ChangeRow({
	children,
	onOpen,
	action,
	onAction,
}: {
	children: ReactNode;
	onOpen?: () => void;
	action: string;
	onAction: () => void;
}) {
	return (
		<DropdownMenuItem
			onClick={onOpen}
			closeOnClick={Boolean(onOpen)}
			onKeyDown={(event) => {
				if (event.key !== "Delete" && event.key !== "Backspace") return;
				event.preventDefault();
				onAction();
			}}
		>
			{children}
			<TextButton
				variant="quiet"
				size="meta"
				className="ml-auto"
				tabIndex={-1}
				onClick={(event) => {
					event.stopPropagation();
					onAction();
				}}
			>
				{action}
			</TextButton>
		</DropdownMenuItem>
	);
}

/**
 * A ref for the two things that leave with the last change: the group, and the list it opens (which is drawn outside it). A screen gives one
 * callback, the same for the group's whole life, and hears each of them come and go: that is where it hands the keyboard's focus on when the
 * button that was pressed goes with them.
 */
type LeavingRef = React.RefCallback<HTMLElement>;

/**
 * How the save group looks: "changes N" (and "· proposals N" in blue), then "undo all" and the one primary pill ("save and apply"). `list` is what
 * "changes N" opens, hanging from the whole group with its right edge on the group's; without it the group is drawn and opens nothing (a screen spec's
 * look, before its behavior is wired). The pill is never greyed: what blocks saving is shown when it is pressed, and while the save is on its way it
 * says so (`saving`) and keeps the focus.
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
	saving,
	saveDanger,
	list,
	leavingRef,
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
	/** While the save is on its way: what the pill says ("Saving…"). It keeps its fill and the focus, shows the spinner and cannot be pressed again. */
	saving?: string;
	saveDanger?: boolean;
	/** The changes, as menu rows. */
	list?: ReactNode;
	leavingRef?: LeavingRef;
} & Omit<React.ComponentProps<"section">, "children" | "onSelect">) {
	const [group, setGroup] = useState<HTMLElement | null>(null);
	// One callback for the group's life: drawn anew each time, it would be let go and taken again with every change of the screen.
	const groupRef = useCallback(
		(node: HTMLElement | null) => {
			setGroup(node);
			const left = leavingRef?.(node);
			return () => {
				if (typeof left === "function") left();
				setGroup(null);
			};
		},
		[leavingRef],
	);
	return (
		<section ref={groupRef} data-slot="changes-group" className="flex items-center gap-monti-16" {...props}>
			<DropdownMenu>
				<DropdownMenuTrigger render={<Button variant="ghost" aria-label={listLabel} />}>
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
					<DropdownMenuContent ref={leavingRef} align="end" anchor={group ?? undefined} width="panel">
						{list}
					</DropdownMenuContent>
				)}
			</DropdownMenu>
			<Button type="button" variant="ghost" onClick={onDiscard}>
				{discardLabel}
			</Button>
			<Button type="button" variant={saveDanger ? "danger" : "primary"} loading={saving !== undefined} onClick={onSave}>
				{saving ?? saveLabel}
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
	/** While the save is on its way: what the pill says ("Saving…"). */
	saving?: string;
	saveDanger?: boolean;
	/** Given to the group and to the list it opens ({@link LeavingRef}). */
	leavingRef?: LeavingRef;
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
						<ChangeRow key={item.id} onOpen={item.onOpen} action={undoLabel} onAction={item.onUndo}>
							<span className="inline-flex items-baseline gap-monti-4">
								{item.name}{" "}
								<Text variant="meta" tone={item.tone}>
									{item.tag}
								</Text>
							</span>
						</ChangeRow>
					))}
					{proposals && proposals.items.length > 0 && (
						<>
							<DropdownMenuSeparator />
							{proposals.items.map((item) => (
								<ChangeRow key={item.id} onOpen={item.onOpen} action={proposals.discardLabel} onAction={item.onDiscard}>
									<span className="inline-flex items-baseline gap-monti-4">
										{item.name}{" "}
										<Text variant="meta" tone="proposal">
											{proposals.label}
										</Text>
									</span>
								</ChangeRow>
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
