"use client";

import { adminUrl, cmsApiUrl } from "@monti-cms/core/client";
import { FileText, LayoutTemplate, RefreshCw, Settings } from "lucide-react";
import { useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { IconButton } from "../../ui/icon-button";
import { cmsFetch } from "../admin-api";
import { useConfirm } from "../shared/confirm-dialog";
import { t } from "./translate";

type Template = { id: string; name: string; mdx: string };

/**
 * 편집기 툴바 끝의 템플릿 메뉴. 처음 열 때 목록을 받는다.
 * 본문이 비었으면 고른 템플릿을 바로 넣고, 쓴 본문이 있으면 바꿀지 먼저 묻는다.
 */
export function TemplateMenu({
	currentMdx,
	disabled,
	onApply,
}: {
	currentMdx: string;
	disabled: boolean;
	onApply: (mdx: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [templates, setTemplates] = useState<Template[] | null>(null);
	const [loadFailed, setLoadFailed] = useState(false);
	const { confirm, dialog } = useConfirm();

	const load = async () => {
		setLoadFailed(false);
		try {
			const data = await cmsFetch<{ items: Template[] }>(cmsApiUrl("/v1/templates"));
			setTemplates(data.items);
		} catch {
			setLoadFailed(true);
		}
	};

	const openMenu = (next: boolean) => {
		setOpen(next);
		if (next && !templates) void load();
	};

	const choose = async (template: Template) => {
		setOpen(false);
		if (
			currentMdx.trim() &&
			!(await confirm({
				title: t("template.applyTitle"),
				description: t("template.applyAsk", { name: template.name }),
				confirmLabel: t("template.apply"),
				destructive: true,
			}))
		) {
			return;
		}
		onApply(template.mdx);
	};

	return (
		<>
			<DropdownMenu open={open} onOpenChange={openMenu}>
				<IconButton
					label={t("template.menu")}
					disabled={disabled}
					trigger={(button) => <DropdownMenuTrigger render={button} />}
				>
					<LayoutTemplate aria-hidden className="size-4" />
				</IconButton>
				<DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto">
					{loadFailed ? (
						<>
							<DropdownMenuItem disabled>{t("template.loadFailed")}</DropdownMenuItem>
							<DropdownMenuItem closeOnClick={false} onClick={() => void load()}>
								<RefreshCw aria-hidden />
								{t("retry")}
							</DropdownMenuItem>
						</>
					) : templates === null ? (
						<DropdownMenuItem disabled>{t("loading")}</DropdownMenuItem>
					) : templates.length === 0 ? (
						<DropdownMenuItem disabled>{t("template.none")}</DropdownMenuItem>
					) : (
						templates.map((template) => (
							<DropdownMenuItem key={template.id} onClick={() => void choose(template)}>
								<FileText aria-hidden />
								<span className="truncate">{template.name}</span>
							</DropdownMenuItem>
						))
					)}
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={() => window.open(adminUrl("/templates"), "_blank", "noopener")}>
						<Settings aria-hidden />
						{t("template.manage")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			{dialog}
		</>
	);
}
