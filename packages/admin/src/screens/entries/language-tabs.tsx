"use client";

import { useSite, useTranslator } from "@monti-cms/core/client";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { errorText } from "../../api/client";
import { createEntryTranslation } from "../../api/entries";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { cn } from "../../lib/utils/cn";
import { useAdminRouter } from "../../router";
import { Button } from "../../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../ui/dropdown-menu";
import { IconButton } from "../../ui/icon-button";
import { StatusIndicator, type StatusTone } from "../../ui/status-indicator";
import { statusLabels } from "../shared/entry-status";
import { type EntryData, isTranslationEntry } from "./entry-form";
import { entriesMessages } from "./messages";

const STATUS_TONE: Record<string, StatusTone> = {
	published: "success",
	draft: "warning",
};

/**
 * Language tabs above the title. Switch between languages of the same translation group; for a missing language, create a translation.
 * A translation is a draft copied from the original's per-language values and body saved on the server.
 */
export function LanguageTabs({
	entry,
	disabled,
	onBeforeCreate,
	onTrashTranslation,
}: {
	entry: EntryData;
	disabled: boolean;
	/** Blocks translation creation when there are unsaved changes. */
	onBeforeCreate: () => Promise<boolean>;
	onTrashTranslation: () => void;
}) {
	const t = useTranslator(entriesMessages);
	const site = useSite();
	const router = useAdminRouter();
	const [creating, setCreating] = useState<string | null>(null);
	const members = entry.translations ?? [];
	const isTranslation = isTranslationEntry(entry);
	const createDisabled = disabled || entry.status === "trashed" || creating !== null;

	const translate = useCmsMutation<(typeof site.LOCALES)[number], { entry: { id: string } }>({
		fn: (target, { site }) => createEntryTranslation(site, entry.id, target, t("lang.createFailed")),
		success: (_created, target) => t("lang.created", { lang: site.localeLabel(target) }),
		failure: t("lang.createFailed"),
		onSuccess: (created) => {
			setCreating(null);
			router.navigate(site.adminEntryEditHref(created.entry.id));
		},
		onError: () => setCreating(null),
	});

	const create = async (target: (typeof site.LOCALES)[number]) => {
		if (creating) return;
		setCreating(target);
		try {
			if (!(await onBeforeCreate())) {
				toast.error(t("lang.saveFirst"));
				setCreating(null);
				return;
			}
		} catch (error) {
			toast.error(errorText(site, error, t("lang.createFailed")));
			setCreating(null);
			return;
		}
		translate.mutate(target);
	};

	return (
		<nav aria-label={t("lang.nav")} className="flex flex-wrap items-center gap-1 px-4 pt-2">
			{site.LOCALES.map((target) => {
				const member = members.find((item) => item.locale === target);
				if (!member) {
					return (
						<Button
							key={target}
							type="button"
							size="sm"
							variant="ghost"
							disabled={createDisabled}
							aria-label={t("lang.add", { lang: site.localeLabel(target) })}
							className="h-7 gap-1 border border-dashed px-2 text-cms-muted-foreground text-xs"
							onClick={() => void create(target)}
						>
							<Plus aria-hidden className="size-3" />
							{target.toUpperCase()}
						</Button>
					);
				}
				const current = member.id === entry.id;
				return (
					<div key={target} className="flex items-center">
						<Button
							type="button"
							size="sm"
							variant="ghost"
							aria-current={current ? "page" : undefined}
							aria-label={t(member.isSource ? "lang.currentSource" : "lang.current", {
								lang: site.localeLabel(target),
								status: statusLabels(site)[member.status],
							})}
							className={cn(
								"h-7 gap-1.5 px-2 text-xs",
								current ? "bg-cms-muted text-cms-foreground" : "text-cms-muted-foreground",
							)}
							onClick={() => {
								if (!current) router.navigate(site.adminEntryEditHref(member.id));
							}}
						>
							<StatusIndicator size="xs" tone={STATUS_TONE[member.status] ?? "neutral"} />
							<span aria-hidden className="font-medium">
								{target.toUpperCase()}
							</span>
							{member.isSource && (
								<span aria-hidden className="font-normal text-cms-muted-foreground">
									{t("source")}
								</span>
							)}
						</Button>
						{current && isTranslation && entry.status !== "trashed" && (
							<DropdownMenu>
								<IconButton
									label={t("lang.menu")}
									className="size-7 text-cms-muted-foreground"
									trigger={(button) => <DropdownMenuTrigger render={button} />}
								>
									<MoreHorizontal aria-hidden className="size-3.5" />
								</IconButton>
								<DropdownMenuContent align="start">
									<DropdownMenuItem variant="destructive" onClick={onTrashTranslation}>
										<Trash2 aria-hidden />
										{t("lang.trash")}
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
				);
			})}
		</nav>
	);
}
