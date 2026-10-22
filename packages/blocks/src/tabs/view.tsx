"use client";

import {
	AttributeInput,
	BlockFrame,
	ContainerToolbar,
	Content,
	ToolbarButton,
	useBlockEditor,
	useTranslator,
} from "@monti-cms/admin";
import { cn } from "@monti-cms/admin/kit";
import { PencilLine, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { tabsMessages } from "./messages";

// Look of the editor tab bar (theme colors). The public page tab look is decided by the site.
const TAB_TRIGGER =
	"relative inline-flex h-[calc(100%-1px)] items-center justify-center gap-tight whitespace-nowrap rounded-md border border-transparent px-condensed py-tight font-medium text-monti-muted text-monti-body transition-all hover:text-monti-default monti-dark:text-monti-muted monti-dark:hover:text-monti-default";
const TAB_TRIGGER_ACTIVE =
	"border-monti-border! bg-monti-page text-monti-default shadow-monti-floating monti-dark:border-monti-default monti-dark:text-monti-default";

const labelOf = (values: Readonly<Record<string, unknown>>) => (typeof values.label === "string" ? values.label : "");

/**
 * Shows only the tab bar and the selected tab's body, like the public page. The body is edited in place.
 * Clicking a tab moves the cursor to that tab's body, and entering another tab's body with the arrow keys opens that tab.
 * Tab names, the initially open tab, adding, and deleting are done from the block toolbar.
 */
export function TabsNodeView() {
	const t = useTranslator(tabsMessages);
	const block = useBlockEditor<{ defaultValue: string }>();
	const { children, editable, focusedChild } = block;
	const labels = children.map((child) => labelOf(child.values));
	const defaultLabel = typeof block.values.defaultValue === "string" ? block.values.defaultValue : "";
	const defaultIndex = Math.max(0, labels.indexOf(defaultLabel));
	const [active, setActive] = useState(defaultIndex);
	const [renaming, setRenaming] = useState<number | null>(null);
	const current = Math.min(active, children.length - 1);

	useEffect(() => {
		if (focusedChild !== null) setActive(focusedChild);
	}, [focusedChild]);

	const openTab = (index: number) => {
		setActive(index);
		block.focus({ child: index });
	};

	const renameTab = (index: number, label: string) => {
		block.transact((tx) => {
			const tab = tx.child(index);
			const previous = labelOf(tab.values);
			tab.setValue("label", label);
			// The initially open tab is referenced by name. Renaming a tab updates it too (based on the current document, not render time).
			if (tx.values.defaultValue && tx.values.defaultValue === previous) tx.setValue("defaultValue", label);
		});
	};

	const addTab = () => {
		let number = children.length + 1;
		while (labels.includes(t("tab.newName", { number }))) number += 1;
		const added = block.addChild({ values: { label: t("tab.newName", { number }) }, focus: true });
		if (added.ok) setActive(added.value.index);
	};

	const removeTab = (index: number) => {
		const removed = block.transact((tx) => {
			if (defaultLabel && defaultLabel === labelOf(tx.child(index).values)) tx.setValue("defaultValue", "");
			tx.removeChild(index);
		});
		if (removed.ok) openTab(Math.max(0, index - 1));
	};

	const toggleDefault = (index: number) => {
		// The first tab opens first even without being specified. Clicking an already specified tab again clears the specification.
		block.setValue("defaultValue", index === 0 || index === defaultIndex ? "" : (labels[index] ?? ""));
	};

	return (
		// design-system: drawing — the tab bar and body box as the public post draws them (editor tab triggers, rename input, body frame)
		<BlockFrame className="my-spacious rounded-lg">
			<div contentEditable={false} className="not-prose">
				<div
					role="tablist"
					aria-label={t("list")}
					className="relative inline-flex h-9 w-fit max-w-full items-center rounded-lg rounded-b-none border bg-monti-neutral p-[3px] text-monti-muted"
				>
					{labels.map((label, index) =>
						renaming === index ? (
							// biome-ignore lint/suspicious/noArrayIndexKey: the tab position is the identifier (names can overlap).
							<div key={index} className={cn(TAB_TRIGGER, TAB_TRIGGER_ACTIVE)}>
								<AttributeInput
									aria-label={t("rename.aria")}
									value={label}
									required
									autoFocus
									size={Math.max(4, label.length + 1)}
									onCommit={(next) => renameTab(index, next)}
									onEnter={() => {
										setRenaming(null);
										openTab(index);
									}}
									onEscape={() => setRenaming(null)}
									onBlur={() => setRenaming(null)}
									className="text-center"
								/>
							</div>
						) : (
							<button
								// biome-ignore lint/suspicious/noArrayIndexKey: the tab position is the identifier (names can overlap).
								key={index}
								type="button"
								role="tab"
								aria-selected={index === current}
								className={cn(TAB_TRIGGER, index === current && TAB_TRIGGER_ACTIVE)}
								onClick={() => openTab(index)}
							>
								{label || t("untitled")}
							</button>
						),
					)}
					<span className="pointer-events-none absolute right-0 -bottom-1 left-0 inline-block h-1 bg-monti-neutral" />
				</div>
			</div>
			<Content
				visibleChild={current}
				className="rounded-b-lg rounded-tr-lg border bg-monti-neutral px-comfortable py-normal text-monti-body"
			/>
			{editable ? (
				<ContainerToolbar label={t("toolbar")}>
					<ToolbarButton label={t("add")} disabled={!block.canAddChild} onClick={addTab}>
						<Plus aria-hidden />
					</ToolbarButton>
					<ToolbarButton label={t("rename")} onClick={() => setRenaming(current)}>
						<PencilLine aria-hidden />
					</ToolbarButton>
					<ToolbarButton label={t("default")} pressed={current === defaultIndex} onClick={() => toggleDefault(current)}>
						<Star aria-hidden fill={current === defaultIndex ? "currentColor" : "none"} />
					</ToolbarButton>
					<ToolbarButton
						label={t("delete")}
						tone="danger"
						disabled={!block.canRemoveChild(current)}
						onClick={() => removeTab(current)}
					>
						<Trash2 aria-hidden />
					</ToolbarButton>
				</ContainerToolbar>
			) : null}
		</BlockFrame>
	);
}

/** One tab. The parent (tab bar and body box) handles the look, and this view only provides the body slot. */
export function TabNodeView() {
	return (
		<BlockFrame framed={false} selectedRing={false}>
			<Content className="[&>*>:first-child]:mt-0 [&>*>:last-child]:mb-0" />
		</BlockFrame>
	);
}
