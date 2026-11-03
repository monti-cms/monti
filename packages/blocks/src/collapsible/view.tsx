"use client";

import { ChevronDown, ChevronRight } from "@carbon/icons-react";
import {
	AttributeInput,
	BlockFrame,
	BlockSettings,
	ContainerToolbar,
	Content,
	useBlockEditor,
	useTranslator,
} from "@monti-cms/admin";
import { cn, IconButton, Inline, Label, Switch } from "@monti-cms/admin/kit";
import { useEffect, useId, useState } from "react";
import { collapsibleMessages } from "./messages";

/**
 * Collapsible editing view (theme colors). The initial state follows `defaultOpen`, and the arrow next to the title toggles it while editing.
 * It expands automatically when the cursor enters it (arrow keys, undo, find).
 */
export function CollapsibleNodeView() {
	const t = useTranslator(collapsibleMessages);
	const block = useBlockEditor();
	const { values, editable, setValue } = block;
	const defaultOpen = values.defaultOpen === true;
	const [open, setOpen] = useState(defaultOpen);
	const selectionInside = block.focusedChild !== null;
	const defaultOpenId = useId();

	useEffect(() => {
		if (selectionInside) setOpen(true);
	}, [selectionInside]);

	const toggle = () => {
		if (open) {
			// Leaving the cursor inside the hidden body would put text where it cannot be seen. Select the whole collapsible block instead.
			if (selectionInside) block.select();
			setOpen(false);
		} else {
			setOpen(true);
			block.focus();
		}
	};

	return (
		<BlockFrame boxed>
			<div
				contentEditable={false}
				className={cn(
					"not-prose flex w-full items-center gap-monti-8 rounded-monti-md px-monti-12 py-monti-8 font-medium text-monti-body text-monti-default",
					open && "bg-monti-muted",
				)}
			>
				<IconButton label={open ? t("toggle.close") : t("toggle.open")} aria-expanded={open} onClick={toggle}>
					{open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
				</IconButton>
				<AttributeInput
					aria-label={t("title.aria")}
					value={typeof values.title === "string" ? values.title : ""}
					placeholder={t("title.placeholder")}
					readOnly={!editable}
					onCommit={(title) => setValue("title", title)}
					onEnter={() => {
						setOpen(true);
						block.focus();
					}}
				/>
			</div>
			<Content
				padded
				className={cn(!open && "hidden")}
				// The read-only source view shows the collapsed body expanded too (`data-monti-collapsed`).
				data-monti-collapsed={open ? undefined : ""}
			/>
			{editable ? (
				<ContainerToolbar label={t("toolbar")}>
					<BlockSettings>
						<Inline justify="between" width="full">
							<Label htmlFor={defaultOpenId} tone="muted">
								{t("defaultOpen.label")}
							</Label>
							<Switch
								id={defaultOpenId}
								checked={defaultOpen}
								onCheckedChange={(checked) => setValue("defaultOpen", checked)}
							/>
						</Inline>
					</BlockSettings>
				</ContainerToolbar>
			) : null}
		</BlockFrame>
	);
}
