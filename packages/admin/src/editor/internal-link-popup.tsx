"use client";

import { type Site, useSite, useTranslator } from "@monti-cms/core/site";
import { Box, cn, FormFieldError, Inline, Spinner, Stack, Text } from "@monti-cms/ui";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CollectionIcon } from "../screens/shared/collection-icon";
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
		// design-system: drawing — a list floating at the caret (fixed coordinates, z-index, scrolls the highlighted row into view); needs a floating list part
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
			className="max-h-80 w-72 overflow-y-auto rounded-lg border bg-monti-overlay p-tight text-monti-default shadow-monti-floating"
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
					// design-system: needs a selectable list option (highlighted row, hover) for a listbox
					className={cn(
						"flex cursor-pointer items-center gap-condensed rounded-md px-condensed py-condensed outline-none",
						index === selectedIndex ? "bg-monti-selected text-monti-default" : "hover:bg-monti-hover",
					)}
				>
					<Inline
						as="span"
						aria-hidden
						justify="center"
						padding="condensed"
						border="all"
						radius="md"
						background="page"
						shrink={false}
					>
						<CollectionIcon collection={item.collection} />
					</Inline>
					<Stack as="span" gap="none" minWidth={0}>
						<Text weight="medium" truncate>
							{item.title}
						</Text>
						<Text variant="caption" tone="muted" truncate>
							{itemMeta(site, item)}
						</Text>
					</Stack>
				</div>
			))}
			{isLoading ? (
				<Box as="div" paddingX="condensed" paddingY="condensed">
					<Inline as="div" gap="condensed" role="status">
						<Spinner size="sm" />
						<Text variant="caption" tone="muted">
							{t("internalLink.searching")}
						</Text>
					</Inline>
				</Box>
			) : error ? (
				<Box paddingX="condensed" paddingY="condensed">
					<FormFieldError>{error}</FormFieldError>
				</Box>
			) : (
				items.length === 0 && (
					<Box paddingX="condensed" paddingY="condensed">
						<Text as="p" variant="caption" tone="muted">
							{t("internalLink.empty")}
						</Text>
					</Box>
				)
			)}
		</div>,
		document.body,
	);
}
