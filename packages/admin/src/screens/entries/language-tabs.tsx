"use client";

import { adminEntryEditHref, cmsApiUrl, LOCALES, localeLabel } from "@monti-cms/core/client";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "../../lib/utils/cn";
import { Button } from "../../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../ui/dropdown-menu";
import { IconButton } from "../../ui/icon-button";
import { cmsFetch, errorText } from "../admin-api";
import { STATUS_LABELS } from "../shared/entry-status";
import { type EntryData, isTranslationEntry } from "./entry-form";
import { t } from "./translate";

const STATUS_DOT: Record<string, string> = {
	published: "bg-emerald-500",
	draft: "bg-amber-500",
};

/**
 * 제목 위 언어 탭. 같은 번역 묶음의 언어 사이를 오가고, 없는 언어는 번역본을 만든다.
 * 번역본은 서버에 저장된 원문의 언어별 값과 본문을 복사한 초안이다.
 */
export function LanguageTabs({
	entry,
	disabled,
	onBeforeCreate,
	onTrashTranslation,
}: {
	entry: EntryData;
	disabled: boolean;
	/** 저장되지 않은 변경이 있으면 번역본 생성을 막는다. */
	onBeforeCreate: () => Promise<boolean>;
	onTrashTranslation: () => void;
}) {
	const router = useRouter();
	const [creating, setCreating] = useState<string | null>(null);
	const members = entry.translations ?? [];
	const isTranslation = isTranslationEntry(entry);
	const createDisabled = disabled || entry.status === "trashed" || creating !== null;

	const create = async (target: (typeof LOCALES)[number]) => {
		if (creating) return;
		setCreating(target);
		try {
			if (!(await onBeforeCreate())) {
				toast.error(t("lang.saveFirst"));
				return;
			}
			const created = await cmsFetch<{ id: string }>(cmsApiUrl(`/v1/entries/${entry.id}/translations`), {
				method: "POST",
				json: { locale: target },
				fallback: t("lang.createFailed"),
			});
			toast.success(t("lang.created", { lang: localeLabel(target) }));
			router.push(adminEntryEditHref(created.id) as Route);
		} catch (error) {
			toast.error(errorText(error, t("lang.createFailed")));
		} finally {
			setCreating(null);
		}
	};

	return (
		<nav aria-label={t("lang.nav")} className="flex flex-wrap items-center gap-1 px-4 pt-2">
			{LOCALES.map((target) => {
				const member = members.find((item) => item.locale === target);
				if (!member) {
					return (
						<Button
							key={target}
							type="button"
							size="sm"
							variant="ghost"
							disabled={createDisabled}
							aria-label={t("lang.add", { lang: localeLabel(target) })}
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
								lang: localeLabel(target),
								status: STATUS_LABELS[member.status],
							})}
							className={cn(
								"h-7 gap-1.5 px-2 text-xs",
								current ? "bg-cms-muted text-cms-foreground" : "text-cms-muted-foreground",
							)}
							onClick={() => {
								if (!current) router.push(adminEntryEditHref(member.id) as Route);
							}}
						>
							<span
								aria-hidden
								className={cn("size-1.5 rounded-full", STATUS_DOT[member.status] ?? "bg-cms-muted-foreground/50")}
							/>
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
