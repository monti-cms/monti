"use client";

import { type Site, useSite, useTranslator } from "@monti-cms/core/client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils/cn";
import { CollectionIcon } from "../screens/shared/collection-icon";
import { Spinner } from "../ui/spinner";
import { type InternalLinkItem, internalLinkHref } from "./internal-link";
import { editorMessages } from "./messages";

interface InternalLinkPopupProps {
	items: InternalLinkItem[];
	isLoading: boolean;
	/** Message to show in place of the result list when the search request failed. */
	error?: string | null;
	coords: { top: number; left: number };
	selectedIndex: number;
	onSelect: (item: InternalLinkItem) => void;
	onClose: () => void;
}

/** Line under the entry: collection name · address · draft status. */
function itemMeta(site: Site, item: InternalLinkItem): string {
	const t = site.createTranslator(editorMessages);
	const collection = site.isCollection(item.collection)
		? site.COLLECTION_DEFINITIONS[item.collection].label
		: item.collection;
	// Links to draft targets are allowed while editing but flagged. The target must be public to publish.
	const status =
		item.status && item.status !== "published"
			? item.status === "draft"
				? t("internalLink.draft")
				: item.status
			: null;
	// Show the public path (collection `path`) the link will actually point to.
	return [collection, internalLinkHref(site, item), status].filter(Boolean).join(" · ");
}

/**
 * `[[` internal entry link search results. Same look as the slash menu.
 * The editor handles focus and arrow keys; this only draws the highlighted item (`selectedIndex`) and scrolls it into view.
 */
export function InternalLinkPopup({
	items,
	isLoading,
	error,
	coords,
	selectedIndex,
	onSelect,
	onClose,
}: InternalLinkPopupProps) {
	const site = useSite();
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

	if (!mounted) return null;

	return createPortal(
		<div
			ref={listRef}
			role="listbox"
			aria-label={t("internalLink.label")}
			aria-busy={isLoading}
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
					key={item.id}
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
					<span
						aria-hidden
						className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-cms-background text-cms-muted-foreground [&_svg]:size-4"
					>
						<CollectionIcon collection={item.collection} />
					</span>
					<span className="min-w-0">
						<span className="block truncate font-medium text-sm">{item.title}</span>
						<span className="block truncate text-cms-muted-foreground text-xs">{itemMeta(site, item)}</span>
					</span>
				</div>
			))}
			{isLoading ? (
				<output className="flex items-center gap-2 px-2 py-1.5 text-cms-muted-foreground text-xs">
					<Spinner className="size-3.5" />
					{t("internalLink.searching")}
				</output>
			) : error ? (
				<p role="alert" className="px-2 py-1.5 text-cms-destructive text-xs">
					{error}
				</p>
			) : (
				items.length === 0 && <p className="px-2 py-1.5 text-cms-muted-foreground text-xs">{t("internalLink.empty")}</p>
			)}
		</div>,
		document.body,
	);
}
