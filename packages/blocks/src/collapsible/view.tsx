"use client";

import {
	AttributeInput,
	BlockFrame,
	BlockSettings,
	ContainerToolbar,
	Content,
	useBlockEditor,
	useTranslator,
} from "@monti-cms/admin";
import { cn, FormFieldLabel, Switch } from "@monti-cms/admin/kit";
import { ChevronRight } from "lucide-react";
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
		<BlockFrame className="my-spacious rounded-md border bg-monti-page">
			<div
				contentEditable={false}
				className={cn(
					"not-prose flex w-full items-center gap-condensed rounded-md px-normal py-condensed font-medium text-monti-body text-monti-default",
					open && "bg-monti-neutral",
				)}
			>
				<button
					type="button"
					aria-expanded={open}
					aria-label={open ? t("toggle.close") : t("toggle.open")}
					onClick={toggle}
					className="-m-tight rounded-md p-tight hover:bg-monti-hover"
				>
					<ChevronRight className={cn("size-4 shrink-0 text-monti-muted transition-transform", open && "rotate-90")} />
				</button>
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
					className="w-full flex-1"
				/>
			</div>
			<Content
				className={cn(
					"px-normal pt-condensed pb-normal text-monti-default",
					// Set the first and last inner block prose margins to 0 so they do not add to the box padding (for nested custom blocks, the wrapper inside react-renderer holds the margin).
					"[&>*>:first-child]:mt-0 [&>*>:last-child]:mb-0",
					"[&>*>:first-child>[data-node-view-wrapper]]:mt-0 [&>*>:last-child>[data-node-view-wrapper]]:mb-0",
					!open && "hidden",
				)}
				// The read-only source view shows the collapsed body expanded too (`data-monti-collapsed`).
				data-monti-collapsed={open ? undefined : ""}
			/>
			{editable ? (
				<ContainerToolbar label={t("toolbar")}>
					<BlockSettings>
						<FormFieldLabel htmlFor={defaultOpenId} className="w-full items-center justify-between font-normal">
							<span className="text-monti-muted">{t("defaultOpen.label")}</span>
							<Switch
								id={defaultOpenId}
								size="sm"
								checked={defaultOpen}
								onCheckedChange={(checked) => setValue("defaultOpen", checked)}
							/>
						</FormFieldLabel>
					</BlockSettings>
				</ContainerToolbar>
			) : null}
		</BlockFrame>
	);
}
