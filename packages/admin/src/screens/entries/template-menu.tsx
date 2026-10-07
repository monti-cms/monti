"use client";

import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { regenerateBlockIds, type StoredDocument } from "@monti-cms/core/document";
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
import { entriesMessages } from "./messages";

type Template = { id: string; name: string; doc: StoredDocument };

/**
 * Template menu at the end of the editor toolbar. Fetches the list on first open.
 * If the body is empty, inserts the chosen template right away; if there is body text, asks first whether to replace it.
 * A template is a document; applying one hands the entry a copy of it with new block ids (ids are unique within a body, and the translation and
 * diff views pair blocks by them, so the template's own ids must not end up in many entries).
 */
export function TemplateMenu({
	currentDoc,
	disabled,
	onApply,
}: {
	currentDoc: StoredDocument;
	disabled: boolean;
	onApply: (doc: StoredDocument) => void;
}) {
	const t = useTranslator(entriesMessages);
	const site = useSite();
	const [open, setOpen] = useState(false);
	const [templates, setTemplates] = useState<Template[] | null>(null);
	const [loadFailed, setLoadFailed] = useState(false);
	const { confirm, dialog } = useConfirm();

	const load = async () => {
		setLoadFailed(false);
		try {
			const data = await cmsFetch<{ items: Template[] }>(site, cmsApiUrl("/v1/templates"));
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
			currentDoc.content.length > 0 &&
			!(await confirm({
				title: t("template.applyTitle"),
				description: t("template.applyAsk", { name: template.name }),
				confirmLabel: t("template.apply"),
				destructive: true,
			}))
		) {
			return;
		}
		onApply({ ...template.doc, content: regenerateBlockIds(template.doc.content) });
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
					<DropdownMenuItem onClick={() => window.open(site.adminUrl("/templates"), "_blank", "noopener")}>
						<Settings aria-hidden />
						{t("template.manage")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			{dialog}
		</>
	);
}
