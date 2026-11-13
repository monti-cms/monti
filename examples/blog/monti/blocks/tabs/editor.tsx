"use client";

import {
	BlockBar,
	BlockBarButton,
	BlockContent,
	BlockFrame,
	BlockTitle,
	FolderTab,
	FolderTabEdit,
	FolderTabs,
	FolderTabsAdd,
	FolderTabsBody,
	FolderTabsList,
	useBlock,
} from "@monti-cms/admin/blocks";
import { Star, TrashCan } from "@monti-cms/admin/icons";
import { useEffect, useState } from "react";
import { style } from "./style";
import { words } from "./words";

/** Two tabs at least, eight at most (the old block's). */
const FEWEST = 2;
const MOST = 8;

/**
 * Tabs in the editor (doc 18): the admin's folder tabs on the tab's box, the picked tab joined to it. The picked tab's name is typed where it stands;
 * another tab is picked by pressing it, or by the cursor going into it. The + at the end adds a tab; the tool row makes the picked tab the one shown first
 * (★) or deletes it.
 */
export default function TabsEditor() {
	const block = useBlock();
	const say = (label: { ko: string; en: string }) => label[block.language];
	const labels = block.children.map((tab) => (typeof tab.attrs.label === "string" ? tab.attrs.label : ""));
	const first = Math.max(
		0,
		labels.indexOf(typeof block.attrs.defaultValue === "string" ? block.attrs.defaultValue : ""),
	);
	const [current, setCurrent] = useState(first);
	const shown = Math.min(current, labels.length - 1);
	useEffect(() => {
		if (block.childAt !== null) setCurrent(block.childAt);
	}, [block.childAt]);
	const isFirst = labels[shown] !== undefined && shown === first;
	return (
		<BlockFrame
			bar={
				<BlockBar label={say(words.tools)}>
					<BlockBarButton
						label={say(words.first)}
						pressed={isFirst}
						onClick={() => block.setAttrs({ defaultValue: shown === 0 ? undefined : labels[shown] })}
					>
						<Star aria-hidden />
					</BlockBarButton>
					{labels.length > FEWEST && (
						<BlockBarButton
							label={say(words.remove)}
							tone="danger"
							onClick={() => {
								block.removeChild(shown);
								setCurrent(Math.max(0, shown - 1));
							}}
						>
							<TrashCan aria-hidden />
						</BlockBarButton>
					)}
				</BlockBar>
			}
		>
			<style href="monti-block-tabs" precedence="monti-blocks">
				{style}
			</style>
			<div className="monti-block-tabs-editor">
				<FolderTabs value={shown} onValueChange={(value) => setCurrent(Number(value))}>
					<div contentEditable={false}>
						<FolderTabsList
							add={
								block.editable && labels.length < MOST ? (
									<FolderTabsAdd
										aria-label={say(words.add)}
										onClick={() => {
											block.insertChild({
												type: "tab",
												attrs: { label: `${say(words.newTab)} ${labels.length + 1}` },
												children: [{ type: "paragraph" }],
											});
											setCurrent(labels.length);
										}}
									/>
								) : undefined
							}
						>
							{labels.map((label, index) =>
								index === shown && block.editable ? (
									// biome-ignore lint/suspicious/noArrayIndexKey: two tabs may share a name; a tab is its place
									<FolderTabEdit key={index}>
										<BlockTitle
											className="monti-block-title-input"
											label={say(words.name)}
											value={label}
											placeholder={say(words.unnamed)}
											onChange={(name) => block.setChildAttrs(index, { label: name })}
											onDone={() => block.focusChild(index)}
										/>
									</FolderTabEdit>
								) : (
									// biome-ignore lint/suspicious/noArrayIndexKey: two tabs may share a name; a tab is its place
									<FolderTab key={index} value={index} draggable={false}>
										{label === "" ? say(words.unnamed) : label}
									</FolderTab>
								),
							)}
						</FolderTabsList>
					</div>
					<FolderTabsBody value={shown} keepMounted>
						<div className="monti-block-tabs-content" data-current={shown}>
							<BlockContent />
						</div>
					</FolderTabsBody>
				</FolderTabs>
			</div>
		</BlockFrame>
	);
}

/** One tab in the editor: its blocks. Which tab shows is the tabs' to say. */
export function TabEditor() {
	return <BlockContent className="monti-block-tabs-panel" />;
}
