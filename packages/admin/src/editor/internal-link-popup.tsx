"use client";

import { type Site, useSite, useTranslator } from "@monti-cms/core/site";
import {
	Command,
	CommandEmpty,
	CommandItem,
	CommandList,
	FormFieldError,
	Popover,
	PopoverContent,
	Stack,
	Text,
} from "@monti-cms/ui";
import { useMemo } from "react";
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
	/** The pointer is on the row at this index. */
	onHighlight: (index: number) => void;
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
 * `[[` internal entry link search results, in the slash menu's card under the caret (`Popover` + `Command`). The editor keeps the focus and handles the
 * arrow keys and Enter, so this only draws the row the keyboard is on (`selectedIndex`) and tells which row the pointer is on.
 */
export function InternalLinkPopup({
	items,
	isLoading,
	error,
	coords,
	selectedIndex,
	onSelect,
	onHighlight,
	onClose,
}: InternalLinkPopupProps) {
	const site = useSite();
	const t = useTranslator(editorMessages);
	// The caret's line: the card opens under it (24px is the line the coordinates start).
	const anchor = useMemo(
		() => ({ getBoundingClientRect: () => new DOMRect(coords.left, coords.top, 1, 24) }),
		[coords.left, coords.top],
	);

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
					<CommandList label={t("internalLink.label")} aria-busy={isLoading}>
						{items.map((item, index) => (
							<CommandItem key={item.id} value={String(index)} onSelect={() => onSelect(item)}>
								<CollectionIcon collection={item.collection} />
								<Stack as="span" gap={2} minWidth={0}>
									<Text tone="default" truncate>
										{item.title}
									</Text>
									<Text variant="caption" tone="subtle" truncate>
										{itemMeta(site, item)}
									</Text>
								</Stack>
							</CommandItem>
						))}
						{isLoading ? (
							<CommandEmpty role="status">{t("internalLink.searching")}</CommandEmpty>
						) : error ? (
							<CommandEmpty>
								<FormFieldError>{error}</FormFieldError>
							</CommandEmpty>
						) : (
							<CommandEmpty>{t("internalLink.empty")}</CommandEmpty>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
