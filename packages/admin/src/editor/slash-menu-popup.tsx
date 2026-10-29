"use client";

import { AppConnectivity, Template } from "@carbon/icons-react";
import { useTranslator } from "@monti-cms/core/site";
import {
	Command,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	MenuShortcut,
	Popover,
	PopoverContent,
	Stack,
	Text,
} from "@monti-cms/ui";
import { useMemo } from "react";
import { useIconByName } from "../screens/shared/collection-icon";
import { editorMessages } from "./messages";
import { SLASH_GROUPS, type SlashCommandItem, type SlashGroup } from "./slash-command";

/** Where the caret is on screen: the menu opens under this line, or over it where there is no room under. */
export interface CaretRect {
	top: number;
	bottom: number;
	left: number;
}

interface SlashMenuPopupProps {
	items: SlashCommandItem[];
	/** What is typed after the `/`. The search line shows it; the text itself is typed in the body. */
	query: string;
	caret: CaretRect;
	/** Reads the caret again each time the menu is placed (falls back to `caret`). */
	measureCaret?: () => CaretRect;
	selectedIndex: number;
	onSelect: (item: SlashCommandItem) => void;
	/** The pointer is on the row at this index. */
	onHighlight: (index: number) => void;
	onClose: () => void;
}

/** Item icon. A name (the block definition's `editor.icon`) or a component; a puzzle icon if absent, the template icon for a template. */
function ItemIcon({ item }: { item: SlashCommandItem }) {
	const iconByName = useIconByName();
	const named = typeof item.icon === "string" ? iconByName(item.icon) : item.icon;
	const Glyph = named ?? (item.group === "templates" ? Template : AppConnectivity);
	return <Glyph aria-hidden />;
}

/**
 * The "/" menu: a card under the caret with a search line that shows what was typed, group titles, and one row per block with the Markdown that makes it. The editor
 * keeps the focus and handles the arrow keys and Enter (it does not steal focus during Korean IME composition), so this only draws the row the keyboard is on
 * (`selectedIndex`) and tells which row the pointer is on.
 */
export function SlashMenuPopup({
	items,
	query,
	caret,
	measureCaret,
	selectedIndex,
	onSelect,
	onHighlight,
	onClose,
}: SlashMenuPopupProps) {
	const t = useTranslator(editorMessages);
	const anchor = useMemo(
		() => ({
			getBoundingClientRect: () => {
				const at = measureCaret?.() ?? caret;
				return new DOMRect(at.left, at.top, 1, Math.max(0, at.bottom - at.top));
			},
		}),
		[caret, measureCaret],
	);
	const titles: Record<SlashGroup, string> = {
		text: t("slash.group.text"),
		insert: t("slash.group.insert"),
		components: t("slash.group.components"),
		templates: t("slash.group.templates"),
	};
	if (items.length === 0) return null;

	return (
		<Popover open onOpenChange={(open) => !open && onClose()}>
			<PopoverContent
				anchor={anchor}
				side="bottom"
				align="start"
				padding="menu"
				width="md"
				initialFocus={false}
				finalFocus={false}
				// Keep the focus in the body: pressing a row must not take it.
				onMouseDown={(event) => event.preventDefault()}
			>
				<Command
					shouldFilter={false}
					value={String(selectedIndex)}
					onValueChange={(value) => onHighlight(Number(value))}
				>
					<CommandInput value={query} readOnly placeholder={t("slash.find")} aria-label={t("slash.find")} />
					<CommandList label={t("slashMenu.label")}>
						{SLASH_GROUPS.map((group) => {
							const rows = items.flatMap((item, index) => (item.group === group ? [{ item, index }] : []));
							if (rows.length === 0) return null;
							return (
								<CommandGroup key={group} heading={titles[group]}>
									{rows.map(({ item, index }) => (
										<CommandItem key={item.id ?? item.title} value={String(index)} onSelect={() => onSelect(item)}>
											<ItemIcon item={item} />
											{item.caption ? (
												<Stack as="span" gap={2} minWidth={0}>
													<Text tone="default" truncate>
														{item.title}
													</Text>
													<Text variant="caption" tone="subtle" truncate>
														{item.caption}
													</Text>
												</Stack>
											) : (
												<Text truncate>{item.title}</Text>
											)}
											{item.shortcut && <MenuShortcut>{item.shortcut}</MenuShortcut>}
										</CommandItem>
									))}
								</CommandGroup>
							);
						})}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
