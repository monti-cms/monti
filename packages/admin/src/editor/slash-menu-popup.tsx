"use client";

import { useTranslator } from "@monti-cms/core/site";
import { cn, Icon, Inline, Stack, Text } from "@monti-cms/ui";
import { Puzzle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIconByName } from "../screens/shared/collection-icon";
import { editorMessages } from "./messages";
import type { SlashCommandItem } from "./slash-command";

interface SlashMenuPopupProps {
	items: SlashCommandItem[];
	coords: { top: number; left: number };
	selectedIndex: number;
	onSelect: (item: SlashCommandItem) => void;
	onClose: () => void;
}

/** Item icon. A name (the block definition's `editor.icon`) or a component; a puzzle icon if absent. */
function ItemIcon({ icon }: { icon: SlashCommandItem["icon"] }) {
	const iconByName = useIconByName();
	const Glyph = (typeof icon === "string" ? iconByName(icon) : icon) ?? Puzzle;
	return <Icon icon={Glyph} tone="muted" />;
}

/**
 * `/` block insert menu. The editor handles focus and arrow keys (it does not steal focus during Korean IME composition);
 * this only draws the highlighted item (`selectedIndex`) and scrolls it into view.
 */
export function SlashMenuPopup({ items, coords, selectedIndex, onSelect, onClose }: SlashMenuPopupProps) {
	const t = useTranslator(editorMessages);
	const [mounted, setMounted] = useState(false);
	const listRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		listRef.current
			?.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, [selectedIndex]);

	if (!mounted || items.length === 0) return null;

	return createPortal(
		<div
			ref={listRef}
			role="listbox"
			aria-label={t("slashMenu.label")}
			tabIndex={-1}
			style={{ position: "fixed", top: `${coords.top + 24}px`, left: `${coords.left}px`, zIndex: 9999 }}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					onClose();
				}
			}}
			className="max-h-80 w-72 overflow-y-auto rounded-monti-lg border bg-monti-page p-monti-4 text-monti-default shadow-monti-floating"
		>
			{items.map((item, index) => (
				<div
					key={item.id ?? item.title}
					role="option"
					aria-selected={index === selectedIndex}
					data-index={index}
					tabIndex={-1}
					onMouseDown={(event) => event.preventDefault()}
					onClick={() => onSelect(item)}
					onKeyDown={(event) => {
						if (event.key === "Enter") onSelect(item);
					}}
					className={cn(
						"flex cursor-pointer items-center gap-monti-8 rounded-monti-md px-monti-8 py-monti-8 outline-none",
						index === selectedIndex ? "bg-monti-selected text-monti-default" : "hover:bg-monti-selected",
					)}
				>
					<Inline
						as="span"
						justify="center"
						padding="condensed"
						border="all"
						radius="md"
						background="page"
						shrink={false}
					>
						<ItemIcon icon={item.icon} />
					</Inline>
					<Stack as="span" gap="none" minWidth={0}>
						<Text weight="medium" truncate>
							{item.title}
						</Text>
						<Text variant="caption" tone="muted" truncate>
							{item.description}
						</Text>
					</Stack>
				</div>
			))}
		</div>,
		document.body,
	);
}
