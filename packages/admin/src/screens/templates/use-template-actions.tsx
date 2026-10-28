"use client";

import { Copy, TrashCan } from "@carbon/icons-react";
import type { BodyTemplate } from "@monti-cms/core/site";
import { useTranslator } from "@monti-cms/core/site";
import { createTemplate, deleteTemplate, templatesKeys } from "../../api/templates";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { commonMessages } from "../../lib/common.messages";
import type { MenuAction } from "../shared/action-menu";
import { useConfirm } from "../shared/confirm-dialog";
import { templatesMessages } from "./messages";
import { duplicateInput } from "./template-model";

/**
 * What a template's menu does, on the list row and in the editor's header: duplicate it (a copy named after it, with block ids of its own) and delete it
 * (after a question, with the version that was seen). Render `dialog` once on the screen. `onDeleted` runs after the template is gone.
 */
export function useTemplateActions({ onDeleted }: { onDeleted?: (template: BodyTemplate) => void } = {}) {
	const t = useTranslator(templatesMessages);
	const tc = useTranslator(commonMessages);
	const { confirm, dialog } = useConfirm();
	const duplicate = useCmsMutation({
		fn: (template: BodyTemplate, { site }) =>
			createTemplate(site, duplicateInput(template, t("copyName", { name: template.name })), t("duplicate.failed")),
		success: (_copy, template) => t("duplicate.done", { name: template.name }),
		failure: t("duplicate.failed"),
		invalidate: [templatesKeys.all],
	});
	const remove = useCmsMutation({
		fn: (template: BodyTemplate, { site }) => deleteTemplate(site, template, tc("deleteFailed")),
		success: (_result, template) => t("delete.done", { name: template.name }),
		failure: tc("deleteFailed"),
		// Taken from the list first, then the request is sent. On failure it comes back; when done, it syncs to the server value.
		optimistic: {
			queryKey: templatesKeys.list(),
			update: (current: BodyTemplate[], template) => current.filter((item) => item.id !== template.id),
		},
		invalidate: [templatesKeys.all],
		onSuccess: (_result, template) => onDeleted?.(template),
	});

	const requestDelete = async (template: BodyTemplate) => {
		const ok = await confirm({
			title: t("delete.title"),
			description: t("delete.ask", { name: template.name }),
			confirmLabel: tc("delete"),
			destructive: true,
		});
		if (ok) remove.mutate(template);
	};

	/** The menu of a template: the same rows on the list row's `⋯` and right click and in the editor's `⋯`. */
	const menu = (template: BodyTemplate): MenuAction[] => [
		{ kind: "item", label: t("row.duplicate"), icon: Copy, onSelect: () => duplicate.mutate(template) },
		{
			kind: "item",
			label: t("row.delete"),
			icon: TrashCan,
			destructive: true,
			onSelect: () => void requestDelete(template),
		},
	];

	return { menu, dialog };
}
