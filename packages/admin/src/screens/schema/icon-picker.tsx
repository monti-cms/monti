"use client";

import { useTranslator } from "@monti-cms/core/site";
import { Box, Button, Grid, Inline, Input, Popover, PopoverContent, PopoverTrigger, Stack, Text } from "@monti-cms/ui";
import { ChevronDown, FileText, Tag } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { COLLECTION_ICON_NAMES, ICONS } from "../shared/collection-icon";
import { Labeled } from "../shared/labeled";
import { schemaCollectionMessages } from "./collection.messages";
import { RevertMark, useSchemaEdit } from "./controls";

/**
 * Picker for collection icons. Shows a button with the current icon and opens a popover with
 * a searchable grid of curated CMS icons.
 */
export function IconPicker({
	label,
	value,
	kind,
	onChange,
	revert,
}: {
	label: string;
	value: string | undefined;
	kind?: string;
	onChange: (value: string | undefined) => void;
	/** Puts the saved icon back; given only while the icon differs from the saved file. */
	revert?: () => void;
}) {
	const t = useTranslator(schemaCollectionMessages);
	const { disabled } = useSchemaEdit();
	const id = useId();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	const defaultIconName = kind === "item" ? "tag" : "file-text";
	const DefaultIcon = kind === "item" ? Tag : FileText;
	const CurrentIcon = value && ICONS[value] ? ICONS[value] : DefaultIcon;

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return COLLECTION_ICON_NAMES;
		return COLLECTION_ICON_NAMES.filter((name) => name.includes(q));
	}, [query]);

	return (
		<Labeled label={label} htmlFor={id} aside={revert && <RevertMark name={label} onRevert={revert} />}>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					render={
						<Button
							id={id}
							type="button"
							variant="outline"
							width="full"
							disabled={disabled}
							aria-label={`${label}: ${value || t("collection.iconDefault")}`}
						/>
					}
				>
					<Inline as="span" gap="condensed" grow minWidth={0}>
						<Text as="span" tone="muted">
							<CurrentIcon aria-hidden />
						</Text>
						<Text truncate>{value || t("collection.iconDefault")}</Text>
					</Inline>
					<Text as="span" tone="muted">
						<ChevronDown aria-hidden />
					</Text>
				</PopoverTrigger>
				<PopoverContent align="start" width="md">
					<Stack gap="condensed">
						<Input
							value={query}
							size="sm"
							placeholder={t("collection.iconSearch")}
							onChange={(e) => setQuery(e.target.value)}
							autoFocus
						/>
						{value && (
							<Button
								type="button"
								variant="ghost"
								size="xs"
								onClick={() => {
									onChange(undefined);
									setOpen(false);
								}}
							>
								{t("collection.iconClear")} ({defaultIconName})
							</Button>
						)}
						<Box maxHeight="list" overflow="y" padding="hair">
							<Grid columns={6} responsive={false} gap="tight" role="listbox">
								{filtered.map((name) => {
									const Icon = ICONS[name];
									if (!Icon) return null;
									const isSelected = value === name;
									return (
										<Button
											key={name}
											type="button"
											role="option"
											variant={isSelected ? "secondary" : "ghost"}
											size="icon"
											aria-selected={isSelected}
											title={name}
											aria-label={name}
											onClick={() => {
												onChange(name);
												setOpen(false);
											}}
										>
											<Icon aria-hidden />
										</Button>
									);
								})}
							</Grid>
						</Box>
						{filtered.length === 0 && (
							<Box paddingY="comfortable">
								<Text as="p" variant="caption" tone="muted">
									{t("collection.iconNone")}
								</Text>
							</Box>
						)}
					</Stack>
				</PopoverContent>
			</Popover>
		</Labeled>
	);
}
