"use client";

import { ChevronLeft } from "@carbon/icons-react";
import type { StoredDocument } from "@monti-cms/core/document";
import type { BodyTemplate } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Button,
	EntryStatus,
	FormFieldError,
	FormFieldLabel,
	Inline,
	Input,
	Separator,
	Stack,
	StatusBar,
	StatusBarCell,
	StatusBarSpacer,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
import { errorText } from "../../api/client";
import { createTemplate, getTemplate, templatesKeys, updateTemplate } from "../../api/templates";
import { useCmsMutation } from "../../api/use-cms-mutation";
import { documentKey } from "../../editor/document-key";
import { EditorMenuRows } from "../../editor/editor-menu";
import { CmsEditor } from "../../editor/tiptap-editor";
import { commonMessages } from "../../lib/common.messages";
import { useSaveShortcut } from "../../lib/hooks/use-save-shortcut";
import { AdminLink as Link, useAdminRouter } from "../../router";
import { bodyChars } from "../entries/body-stats";
import { MoreActionsButton } from "../shared/action-menu";
import { SidePanelPane, SidePanelToggle } from "../shared/side-panel-slot";
import { statusBarMessages } from "../shared/status-bar.messages";
import { useDraftEditor } from "../shared/use-draft-editor";
import { useUnsavedGuard } from "../shared/use-unsaved-guard";
import { templatesMessages } from "./messages";
import { editTemplateHref, templatesHref } from "./template-hrefs";
import { newTemplateDoc } from "./template-model";
import { useTemplateActions } from "./use-template-actions";

type TemplateDraft = { name: string; doc: StoredDocument };

/**
 * The page of one template (or a new one when it has no `id`): its own full page, not a pane of the tools page. Back link and, once something changed,
 * the "unsaved" status and the save button (⌘S) in the header; the name over the body; and a status bar with the character count.
 */
export function TemplateEditorScreen({ id }: { id?: string }) {
	const site = useSite();
	const t = useTranslator(templatesMessages);
	const tc = useTranslator(commonMessages);
	const query = useQuery({
		queryKey: templatesKeys.detail(id ?? ""),
		queryFn: ({ signal }) => getTemplate(site, id as string, signal, t("editor.loadFailed")),
		enabled: id !== undefined,
	});
	if (id === undefined) return <TemplatePage />;
	if (query.data) return <TemplatePage key={query.data.id} template={query.data} />;
	return (
		<Stack gap={0} height="screen" background="page">
			<Inline as="header" gap={8} border="bottom" paddingX={16} paddingY={8}>
				<BackLink />
			</Inline>
			<Stack gap={0} grow align="center" justify="center">
				<Text as="p" variant="note" tone="subtle" role={query.error ? "alert" : "status"}>
					{query.error ? errorText(site, query.error, t("editor.loadFailed")) : tc("loading")}
				</Text>
			</Stack>
		</Stack>
	);
}

function BackLink() {
	const site = useSite();
	const t = useTranslator(templatesMessages);
	return (
		<TextButton variant="quiet" render={<Link href={templatesHref(site)} />}>
			<ChevronLeft aria-hidden />
			{t("editor.back")}
		</TextButton>
	);
}

function TemplatePage({ template }: { template?: BodyTemplate }) {
	const site = useSite();
	const t = useTranslator(templatesMessages);
	const tc = useTranslator(commonMessages);
	const ts = useTranslator(statusBarMessages);
	const router = useAdminRouter();
	const queryClient = useQueryClient();
	const nameId = useId();
	const [error, setError] = useState<string | null>(null);

	const save = useCmsMutation({
		fn: ({ name, doc }: TemplateDraft, { site }) =>
			template
				? updateTemplate(site, template.id, { name, doc, expectedVersion: template.version }, tc("saveFailed"))
				: createTemplate(site, { name, doc }, tc("saveFailed")),
		success: tc("saved"),
		failure: tc("saveFailed"),
		inline: true,
		invalidate: [templatesKeys.all],
		onSuccess: (saved) => {
			// The page follows what the server holds; a new template moves to the page of its own.
			queryClient.setQueryData(templatesKeys.detail(saved.id), saved);
			if (!template) router.replace(editTemplateHref(site, saved.id));
		},
		onError: (err) => setError(errorText(site, err, tc("saveFailed"))),
	});
	const saved = template ? { name: template.name, doc: template.doc } : null;
	// A new template starts as the outline; it is not a change until the writer edits it.
	const [outline] = useState(() => newTemplateDoc(t));
	const { draft, update, dirty } = useDraftEditor<TemplateDraft>({
		saved,
		empty: { name: "", doc: outline },
		equals: (a, b) => a.name === b.name && documentKey(site, a.doc) === documentKey(site, b.doc),
		saving: save.isPending,
	});
	const { dialog: guardDialog } = useUnsavedGuard(dirty);
	const actions = useTemplateActions({ onDeleted: () => router.navigate(templatesHref(site)) });

	const handleSave = () => {
		if (!dirty || save.isPending) return;
		if (!draft.name.trim()) {
			setError(t("editor.nameRequired"));
			return;
		}
		setError(null);
		save.mutate({ name: draft.name.trim(), doc: draft.doc });
	};
	useSaveShortcut(handleSave);

	const chars = useMemo(() => bodyChars(draft.doc), [draft.doc]);

	return (
		<Stack gap={0} height="screen" overflow="clip" background="page">
			<Inline
				as="header"
				wrap
				justify="between"
				gap={4}
				shrink={false}
				border="bottom"
				background="page"
				paddingX={16}
				paddingY={8}
			>
				<Inline gap={16} minWidth={0}>
					<BackLink />
					{dirty && <EntryStatus status="editing">{t("editor.unsaved")}</EntryStatus>}
				</Inline>
				<Inline gap={4} justify="end">
					{dirty && (
						<Button type="button" shortcut="⌘S" loading={save.isPending} onClick={handleSave}>
							{save.isPending ? tc("saving") : tc("save")}
						</Button>
					)}
					<MoreActionsButton actions={template ? actions.menu(template) : []} label={t("editor.more")}>
						<EditorMenuRows />
					</MoreActionsButton>
					<Inline height="control-sm" paddingX={4}>
						<Separator orientation="vertical" aria-hidden />
					</Inline>
					<SidePanelToggle />
				</Inline>
			</Inline>

			<Inline align="stretch" gap={0} grow minHeight={0} overflow="hidden" position="relative">
				<Stack gap={0} grow minWidth={0} minHeight={0} overflow="y">
					<CmsEditor
						doc={draft.doc}
						onChange={(doc) => update({ doc })}
						titleField={
							<>
								<FormFieldLabel htmlFor={nameId}>{t("editor.nameLabel")}</FormFieldLabel>
								<Input
									id={nameId}
									value={draft.name}
									aria-invalid={error ? true : undefined}
									onChange={(event) => update({ name: event.target.value })}
									size="display"
									appearance="inline"
								/>
								{error && <FormFieldError>{error}</FormFieldError>}
							</>
						}
					/>
				</Stack>
				<SidePanelPane />
			</Inline>

			<StatusBar aria-label={ts("label")}>
				<StatusBarSpacer />
				<StatusBarCell end render={<span />}>
					{ts("chars", { count: chars.toLocaleString() })}
				</StatusBarCell>
			</StatusBar>
			{actions.dialog}
			{guardDialog}
		</Stack>
	);
}
