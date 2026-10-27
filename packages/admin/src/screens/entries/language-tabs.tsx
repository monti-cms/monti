"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	IconButton,
	Inline,
	StatusIndicator,
	type StatusTone,
	Text,
} from "@monti-cms/ui";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { errorText } from "../../api/client";
import { createEntryTranslation } from "../../api/entries";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { commonMessages } from "../../lib/common.messages";
import { useAdminRouter } from "../../router";
import { statusLabels } from "../shared/entry-status";
import { type EntryData, isTranslationEntry } from "./entry-form";
import { entriesMessages } from "./messages";

/** Stands in for the locale code while the "add translation" text is split around it. */
const CODE_MARK = "\u0000";

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
	const tc = useTranslator(commonMessages);
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
		<Box as="nav" aria-label={t("lang.nav")} paddingX={16} paddingTop={8} paddingBottom={12}>
			<Inline wrap gap={4}>
				{site.LOCALES.map((target) => {
					const member = members.find((item) => item.locale === target);
					if (!member) {
						return (
							<Button
								key={target}
								type="button"
								size="xs"
								variant="outline"
								disabled={createDisabled}
								onClick={() => void create(target)}
							>
								<Plus aria-hidden />
								{/* The visible text is the button's name; the locale code stays in mono. */}
								{t("lang.addTab", { code: CODE_MARK })
									.split(CODE_MARK)
									.flatMap((part, index) => [
										index > 0 ? (
											<Text key={`code-${target}`} mono>
												{target.toUpperCase()}
											</Text>
										) : null,
										part,
									])}
							</Button>
						);
					}
					const current = member.id === entry.id;
					return (
						<Inline key={target}>
							<Button
								type="button"
								size="xs"
								variant={current ? "secondary" : "ghost"}
								aria-current={current ? "page" : undefined}
								aria-label={t(member.isSource ? "lang.currentSource" : "lang.current", {
									lang: site.localeLabel(target),
									status: statusLabels(site)[member.status],
								})}
								onClick={() => {
									if (!current) router.navigate(site.adminEntryEditHref(member.id));
								}}
							>
								<StatusIndicator size="xs" tone={STATUS_TONE[member.status] ?? "neutral"} />
								<Text aria-hidden weight="medium">
									{target.toUpperCase()}
								</Text>
								{member.isSource && (
									<Text aria-hidden tone="muted">
										{t("source")}
									</Text>
								)}
							</Button>
							{current && isTranslation && entry.status !== "trashed" && (
								<DropdownMenu>
									<IconButton label={t("lang.menu")} trigger={(button) => <DropdownMenuTrigger render={button} />}>
										<MoreHorizontal aria-hidden />
									</IconButton>
									<DropdownMenuContent align="start">
										<DropdownMenuItem variant="danger" onClick={onTrashTranslation}>
											<Trash2 aria-hidden />
											{tc("lifecycle.trash")}
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							)}
						</Inline>
					);
				})}
			</Inline>
		</Box>
	);
}
