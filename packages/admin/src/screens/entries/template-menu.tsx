"use client";

import { Document, Renew, Settings, Template as TemplateIcon } from "@carbon/icons-react";
import { regenerateBlockIds, type StoredDocument } from "@monti-cms/core/document";
import type { BodyTemplate } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	IconButton,
	Text,
} from "@monti-cms/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listTemplates, templatesKeys } from "../../api/templates";
import { commonMessages } from "../../lib/common.messages";
import { useConfirm } from "../shared/confirm-dialog";
import { entriesMessages } from "./messages";

type Template = BodyTemplate;

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
	const tc = useTranslator(commonMessages);
	const site = useSite();
	const [open, setOpen] = useState(false);
	const { confirm, dialog } = useConfirm();
	// Fetched on first open, then kept: the manager page shares the same cache.
	const templatesQuery = useQuery({
		queryKey: templatesKeys.list(),
		queryFn: ({ signal }) => listTemplates(site, signal),
		enabled: open,
	});
	const templates = templatesQuery.data ?? null;
	const loadFailed = templatesQuery.isError && templates === null;

	const openMenu = (next: boolean) => {
		setOpen(next);
		if (next && templatesQuery.isError) void templatesQuery.refetch();
	};

	const choose = async (template: Template) => {
		setOpen(false);
		if (
			currentDoc.content.length > 0 &&
			!(await confirm({
				title: t("template.applyTitle"),
				description: t("template.applyAsk", { name: template.name }),
				confirmLabel: tc("apply"),
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
					<TemplateIcon aria-hidden />
				</IconButton>
				<DropdownMenuContent align="end">
					{loadFailed ? (
						<>
							<DropdownMenuItem disabled>{t("template.loadFailed")}</DropdownMenuItem>
							<DropdownMenuItem closeOnClick={false} onClick={() => void templatesQuery.refetch()}>
								<Renew aria-hidden />
								{t("retry")}
							</DropdownMenuItem>
						</>
					) : templates === null ? (
						<DropdownMenuItem disabled>{tc("loading")}</DropdownMenuItem>
					) : templates.length === 0 ? (
						<DropdownMenuItem disabled>{t("template.none")}</DropdownMenuItem>
					) : (
						templates.map((template) => (
							<DropdownMenuItem key={template.id} onClick={() => void choose(template)}>
								<Document aria-hidden />
								<Text truncate>{template.name}</Text>
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
