"use client";

import { useTranslator } from "@monti-cms/core/site";
import { ChevronDown, FileText, Tag } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
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
							disabled={disabled}
							aria-label={`${label}: ${value || t("collection.iconDefault")}`}
							className="h-9 w-full max-w-sm justify-start gap-2.5 font-normal"
						/>
					}
				>
					<span className="flex size-5 items-center justify-center text-monti-muted-foreground">
						<CurrentIcon className="size-4" />
					</span>
					<span className="truncate">{value || t("collection.iconDefault")}</span>
					<ChevronDown aria-hidden className="ml-auto size-4 shrink-0 text-monti-muted-foreground" />
				</PopoverTrigger>
				<PopoverContent align="start" className="w-72 p-3">
					<div className="flex flex-col gap-2.5">
						<Input
							value={query}
							placeholder={t("collection.iconSearch")}
							onChange={(e) => setQuery(e.target.value)}
							className="h-8 text-xs"
							autoFocus
						/>
						{value && (
							<Button
								type="button"
								variant="ghost"
								size="xs"
								className="justify-start text-monti-muted-foreground text-xs hover:text-monti-foreground"
								onClick={() => {
									onChange(undefined);
									setOpen(false);
								}}
							>
								{t("collection.iconClear")} ({defaultIconName})
							</Button>
						)}
						<div className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto p-0.5" role="listbox">
							{filtered.map((name) => {
								const Icon = ICONS[name];
								if (!Icon) return null;
								const isSelected = value === name;
								return (
									<button
										key={name}
										type="button"
										role="option"
										aria-selected={isSelected}
										title={name}
										aria-label={name}
										onClick={() => {
											onChange(name);
											setOpen(false);
										}}
										className={cn(
											"flex size-9 items-center justify-center rounded-md transition-colors hover:bg-monti-accent",
											isSelected && "bg-monti-accent text-monti-foreground ring-1 ring-monti-primary",
										)}
									>
										<Icon className="size-4" />
									</button>
								);
							})}
						</div>
						{filtered.length === 0 && (
							<p className="py-4 text-center text-monti-muted-foreground text-xs">{t("collection.iconNone")}</p>
						)}
					</div>
				</PopoverContent>
			</Popover>
		</Labeled>
	);
}
