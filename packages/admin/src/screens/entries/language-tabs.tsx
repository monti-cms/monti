"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	EntryStatus,
	IconButton,
	Inline,
	TabLink,
	TabLinks,
	Text,
	TextButton,
	toast,
} from "@monti-cms/ui";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { errorText } from "../../api/client";
import { createEntryTranslation } from "../../api/entries";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { commonMessages } from "../../lib/common.messages";
import { AdminLink, useAdminRouter } from "../../router";
import { entryStatusKind, statusLabels } from "../shared/entry-status";
import { type EntryData, isTranslationEntry } from "./entry-form";
import { entriesMessages } from "./messages";

/** Stands in for the locale code while the "add translation" text is split around it. */
const CODE_MARK = "\u0000";

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

	const present = site.LOCALES.flatMap((target) => {
		const member = members.find((item) => item.locale === target);
		return member ? [{ target, member }] : [];
	});
	const missing = site.LOCALES.filter((target) => !members.some((item) => item.locale === target));

	return (
		<Box as="nav" aria-label={t("lang.nav")} paddingX={16} paddingTop={8} paddingBottom={12}>
			<Inline wrap gap={20} align="end">
				{present.length > 0 && (
					<TabLinks>
						{present.map(({ target, member }) => {
							const current = member.id === entry.id;
							return (
								<TabLink
									key={target}
									current={current}
									render={<AdminLink href={site.adminEntryEditHref(member.id)} />}
									aria-label={t(member.isSource ? "lang.currentSource" : "lang.current", {
										lang: site.localeLabel(target),
										status: statusLabels(site)[member.status],
									})}
								>
									<EntryStatus status={entryStatusKind(member.status)} ink={current} />
									<Text aria-hidden>{target.toUpperCase()}</Text>
									{member.isSource && (
										<Text aria-hidden tone="muted">
											{t("source")}
										</Text>
									)}
								</TabLink>
							);
						})}
					</TabLinks>
				)}
				{missing.map((target) => (
					<TextButton key={target} variant="quiet" disabled={createDisabled} onClick={() => void create(target)}>
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
					</TextButton>
				))}
				{isTranslation && entry.status !== "trashed" && (
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
		</Box>
	);
}
