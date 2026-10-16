"use client";

import {
	assignBlockIds,
	type CmsNode,
	emptyStoredDocument,
	STORED_DOCUMENT_VERSION,
	type StoredDocument,
} from "@monti-cms/core/document";
import type { BodyTemplate } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutTemplate, Plus, SquarePen, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { errorText } from "../../api/client";
import { createTemplate, deleteTemplate, listTemplates, templatesKeys, updateTemplate } from "../../api/templates";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { documentKey } from "../../editor/document-key";
import { CmsEditor } from "../../editor/tiptap-editor";
import { commonMessages } from "../../lib/common.messages";
import { useSaveShortcut } from "../../lib/hooks/use-save-shortcut";
import { isComposingKey } from "../../lib/keyboard";
import type { TranslatorFor } from "../../translator";
import { Button } from "../../ui/button";
import { FormFieldError } from "../../ui/field";
import { Input } from "../../ui/input";
import type { MenuAction } from "../shared/action-menu";
import { PageActions } from "../shared/admin-shell";
import { useConfirm } from "../shared/confirm-dialog";
import { EditorFooter } from "../shared/editor-footer";
import { EmptyState } from "../shared/empty-state";
import { formatDateOnly } from "../shared/format-date";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { ListPane, ListRow, MasterDetail } from "../shared/master-detail";
import { useDraftEditor } from "../shared/use-draft-editor";
import { useUnsavedGuard } from "../shared/use-unsaved-guard";
import { templatesMessages } from "./messages";

const textNode = (text: string): CmsNode => ({ type: "text", text });
const heading = (text: string): CmsNode => ({ type: "heading", attrs: { level: 2 }, content: [textNode(text)] });
const paragraph = (text: string): CmsNode => ({ type: "paragraph", content: [textNode(text)] });
const item = (text: string): CmsNode => ({ type: "listItem", content: [paragraph(text)] });

/** Initial body of a new template: an outline with three sections. */
const newTemplateDoc = (t: TranslatorFor<typeof templatesMessages>): StoredDocument => ({
	type: "doc",
	version: STORED_DOCUMENT_VERSION,
	content: assignBlockIds([
		heading(t("newBody.introduction")),
		paragraph(t("newBody.enterContent")),
		heading(t("newBody.body")),
		{ type: "bulletList", content: [item(t("newBody.item1")), item(t("newBody.item2"))] },
		heading(t("newBody.conclusion")),
		paragraph(t("newBody.summary")),
	]),
});

type TemplateDraft = { name: string; doc: StoredDocument };

/**
 * The edit panel of one template (a new template has no id). It keeps the name and body being edited, saves them, and tells the list
 * whether there are unsaved changes. The list keys it by template, so another template starts from its own values.
 */
function TemplateEditPanel({
	template,
	onSaved,
	onCancel,
	onDirtyChange,
}: {
	template: Partial<BodyTemplate>;
	onSaved: (saved: BodyTemplate) => void;
	onCancel: () => void;
	onDirtyChange: (dirty: boolean) => void;
}) {
	const site = useSite();
	const t = useTranslator(templatesMessages);
	const tc = useTranslator(commonMessages);
	const [saveError, setSaveError] = useState<string | null>(null);
	const save = useCmsMutation({
		fn: ({ name, doc }: TemplateDraft, { site }) =>
			template.id
				? updateTemplate(site, template.id, { name, doc, expectedVersion: template.version }, tc("saveFailed"))
				: createTemplate(site, { name, doc }, tc("saveFailed")),
		success: tc("saved"),
		failure: tc("saveFailed"),
		inline: true,
		invalidate: [templatesKeys.all],
		onSuccess: onSaved,
		onError: (err) => setSaveError(errorText(site, err, tc("saveFailed"))),
	});
	const saved = template.id ? { name: template.name ?? "", doc: template.doc ?? emptyStoredDocument() } : null;
	// A new template starts as the outline; it is not a change until the user edits it.
	const [outline] = useState(() => template.doc ?? emptyStoredDocument());
	const { draft, update, dirty, isNew } = useDraftEditor<TemplateDraft>({
		saved,
		empty: { name: template.name ?? "", doc: outline },
		equals: (a, b) => a.name === b.name && documentKey(site, a.doc) === documentKey(site, b.doc),
		onDirtyChange,
		saving: save.isPending,
	});

	const handleSave = () => {
		if (save.isPending) return;
		if (!draft.name.trim()) {
			setSaveError(t("edit.nameRequired"));
			return;
		}
		setSaveError(null);
		save.mutate({ name: draft.name.trim(), doc: draft.doc });
	};

	useSaveShortcut(handleSave);

	return (
		// The body editor also contains buttons and inputs, so it is not wrapped in a <form>. Enter in the name field and ⌘S save.
		<section
			aria-label={template.id ? t("edit.label") : t("edit.addLabel")}
			className="flex h-full flex-1 flex-col overflow-hidden"
		>
			<div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
				<Input
					type="text"
					aria-label={t("edit.nameLabel")}
					value={draft.name}
					onChange={(e) => update({ name: e.target.value })}
					onKeyDown={(event) => {
						// Enter during Korean IME composition ends the character. Do not save.
						if (event.key !== "Enter" || isComposingKey(event)) return;
						event.preventDefault();
						handleSave();
					}}
					placeholder={t("edit.nameLabel")}
					className="h-8 min-w-0 max-w-2xl flex-1"
				/>
				<EditorFooter dirty={dirty || isNew} saving={save.isPending} onSave={handleSave} onCancel={onCancel} />
			</div>
			{saveError && <FormFieldError className="border-b bg-cms-destructive-soft px-6 py-2">{saveError}</FormFieldError>}
			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
				<CmsEditor doc={draft.doc} onChange={(doc) => update({ doc })} />
			</div>
		</section>
	);
}

export function TemplateManager() {
	const site = useSite();
	const t = useTranslator(templatesMessages);
	const tc = useTranslator(commonMessages);
	const queryClient = useQueryClient();
	// If there is a cache, render it right away and refetch in the background. Placeholders show only when there is no cache.
	const templatesQuery = useQuery({
		queryKey: templatesKeys.list(),
		queryFn: ({ signal }) => listTemplates(site, signal, t("list.loadFailed")),
	});
	const templates = templatesQuery.data ?? [];
	const error =
		templatesQuery.error && !templatesQuery.data ? errorText(site, templatesQuery.error, t("list.loadFailed")) : null;

	// The template open in the edit panel (a new template has no id). `editorKey` makes a panel start over when another template (or a fresh new one) opens.
	const [activeTemplate, setActiveTemplate] = useState<Partial<BodyTemplate> | null>(null);
	const [newCount, setNewCount] = useState(0);
	/** Whether the open template has unsaved changes. The edit panel reports it. */
	const dirtyRef = useRef(false);
	const { confirm, confirmDiscard, dialog } = useConfirm();
	// The same as state, for the guard on links that leave the screen.
	const [dirty, setDirtyState] = useState(false);
	const { dialog: guardDialog } = useUnsavedGuard(dirty);
	const setDirty = (next: boolean) => {
		dirtyRef.current = next;
		setDirtyState(next);
	};

	const show = (template: Partial<BodyTemplate> | null) => {
		setDirty(false);
		setActiveTemplate(template);
	};

	/** Opens another template. If there are unsaved changes, asks first whether to discard them. */
	const openTemplate = async (template: BodyTemplate) => {
		if (template.id === activeTemplate?.id) return;
		if (await confirmDiscard(dirtyRef.current)) show(template);
	};

	const openNew = async () => {
		if (!(await confirmDiscard(dirtyRef.current))) return;
		setNewCount((count) => count + 1);
		show({ name: "", doc: newTemplateDoc(t) });
	};

	const closeEditor = async () => {
		if (await confirmDiscard(dirtyRef.current)) show(null);
	};

	const saved = (template: BodyTemplate) => {
		// Keep the saved template open.
		const isNew = activeTemplate?.id === undefined;
		setActiveTemplate(template);
		queryClient.setQueryData<BodyTemplate[]>(templatesKeys.list(), (current) =>
			isNew
				? current && !current.some((item) => item.id === template.id)
					? [template, ...current]
					: current
				: current?.map((item) => (item.id === template.id ? template : item)),
		);
	};

	const remove = useCmsMutation({
		fn: (template: BodyTemplate, { site }) => deleteTemplate(site, template, tc("deleteFailed")),
		success: (_result, template) => t("delete.done", { name: template.name }),
		failure: tc("deleteFailed"),
		// Remove from the list first, then send the request. On failure it comes back; when done, it syncs to the server value.
		optimistic: {
			queryKey: templatesKeys.list(),
			update: (current: BodyTemplate[], template) => current.filter((item) => item.id !== template.id),
		},
		invalidate: [templatesKeys.all],
	});

	const requestDelete = async (template: BodyTemplate) => {
		const ok = await confirm({
			title: t("delete.title"),
			description: t("delete.ask", { name: template.name }),
			confirmLabel: tc("delete"),
			destructive: true,
		});
		if (!ok) return;
		if (activeTemplate?.id === template.id) show(null);
		remove.mutate(template);
	};

	/** Right-click and `⋯` menu of a template list row. */
	const templateMenu = (template: BodyTemplate): MenuAction[] => [
		{ kind: "item", label: tc("open"), icon: SquarePen, onSelect: () => void openTemplate(template) },
		{ kind: "separator" },
		{
			kind: "item",
			label: tc("delete"),
			icon: Trash2,
			shortcut: "Del",
			destructive: true,
			onSelect: () => void requestDelete(template),
		},
	];

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<PageActions>
				<Button type="button" size="sm" onClick={() => void openNew()}>
					<Plus aria-hidden />
					{t("add")}
				</Button>
			</PageActions>
			{error && (
				<LoadErrorAlert message={error} onRetry={() => void templatesQuery.refetch()} className="mx-5 mt-3 w-auto" />
			)}
			<MasterDetail
				list={
					<ListPane
						label={t("list.label")}
						loading={templatesQuery.isPending}
						empty={error ? null : <EmptyState compact title={t("list.empty")} />}
					>
						{templates.map((row) => (
							<ListRow
								key={row.id}
								title={row.name}
								detail={formatDateOnly(site, row.updatedAt)}
								current={activeTemplate?.id === row.id}
								onClick={() => void openTemplate(row)}
								actions={templateMenu(row)}
								actionsLabel={t("list.itemActions", { name: row.name })}
								onDelete={() => void requestDelete(row)}
							/>
						))}
					</ListPane>
				}
			>
				{activeTemplate ? (
					<TemplateEditPanel
						key={activeTemplate.id ?? `new-${newCount}`}
						template={activeTemplate}
						onSaved={saved}
						onCancel={() => void closeEditor()}
						onDirtyChange={setDirty}
					/>
				) : (
					<EmptyState
						icon={LayoutTemplate}
						title={t("edit.empty")}
						action={{ label: t("add"), icon: Plus, onClick: () => void openNew() }}
					/>
				)}
			</MasterDetail>
			{dialog}
			{guardDialog}
		</div>
	);
}
