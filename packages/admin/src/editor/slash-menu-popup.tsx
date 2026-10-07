"use client";

import { useTranslator } from "@monti-cms/core/client";
import { Puzzle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils/cn";
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
	const Icon = (typeof icon === "string" ? iconByName(icon) : icon) ?? Puzzle;
	return <Icon aria-hidden className="size-4" />;
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
			className="max-h-80 w-72 overflow-y-auto rounded-lg border bg-cms-popover p-1 text-cms-popover-foreground shadow-lg"
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
						"flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 outline-none",
						index === selectedIndex ? "bg-cms-accent text-cms-accent-foreground" : "hover:bg-cms-accent/50",
					)}
				>
					<span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-cms-background text-cms-muted-foreground">
						<ItemIcon icon={item.icon} />
					</span>
					<span className="min-w-0">
						<span className="block truncate font-medium text-sm">{item.title}</span>
						<span className="block truncate text-cms-muted-foreground text-xs">{item.description}</span>
					</span>
				</div>
			))}
		</div>,
		document.body,
	);
}
