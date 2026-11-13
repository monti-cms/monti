"use client";

import { BlockBar, BlockBarToggle, BlockContent, BlockFrame, BlockTitle, useBlock } from "@monti-cms/admin/blocks";
import { ChevronDown, ChevronRight, View } from "@monti-cms/admin/icons";
import { useEffect, useState } from "react";
import { style } from "./style";
import { words, wordsIn } from "./words";

/**
 * The collapsible in the editor (doc 18): it folds and opens here too (as it is set to start, and on its own when the cursor goes in), its title typed in
 * it, and its tool row's "open at first", a toggle named on itself.
 */
export default function CollapsibleEditor() {
	const block = useBlock();
	const say = (label: { ko: string; en: string }) => label[block.language];
	const [open, setOpen] = useState(block.attrs.defaultOpen === true || !block.editable);
	useEffect(() => {
		if (block.childAt !== null) setOpen(true);
	}, [block.childAt]);
	const Chevron = open ? ChevronDown : ChevronRight;
	return (
		<BlockFrame
			bar={
				<BlockBar label={say(words.tools)}>
					<BlockBarToggle
						label={say(words.openAtFirst)}
						icon={<View aria-hidden />}
						pressed={block.attrs.defaultOpen === true}
						onPressedChange={(on) => block.setAttrs({ defaultOpen: on ? true : undefined })}
					/>
				</BlockBar>
			}
		>
			<style href="monti-block-collapsible" precedence="monti-blocks">
				{style}
			</style>
			<div className="monti-block-collapsible" data-open={open || undefined}>
				<div className="monti-block-collapsible-summary monti-block-collapsible-head" contentEditable={false}>
					<button
						type="button"
						className="monti-block-collapsible-toggle"
						aria-expanded={open}
						aria-label={say(open ? words.close : words.open)}
						onMouseDown={(event) => event.preventDefault()}
						onClick={() => {
							setOpen(!open);
							if (!open) block.focusChild(0);
							// Closed over the cursor: the cursor goes after the fold, so nothing is typed where it cannot be seen.
							else if (block.childAt !== null) block.leave();
						}}
					>
						<Chevron aria-hidden />
					</button>
					<BlockTitle
						label={say(words.title)}
						value={typeof block.attrs.title === "string" ? block.attrs.title : ""}
						placeholder={wordsIn(block.locale)}
						onChange={(title) => block.setAttrs({ title: title === "" ? undefined : title })}
						onDone={() => {
							setOpen(true);
							block.focusChild(0);
						}}
					/>
				</div>
				<BlockContent className="monti-block-collapsible-body" hidden={!open} />
			</div>
		</BlockFrame>
	);
}
