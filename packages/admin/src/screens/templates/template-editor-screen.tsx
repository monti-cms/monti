"use client";

import { ChevronLeft } from "@carbon/icons-react";
import type { StoredDocument } from "@monti-cms/core/document";
import type { BodyTemplate } from "@monti-cms/core/site";
import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Banner,
	Box,
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
import { errorText, isConflict } from "../../api/client";
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
import { LoadErrorAlert } from "../shared/load-error-alert";
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
			<Inline as="header" gap={12} border="bottom" minHeight="header" paddingX={12}>
				<Box paddingX={12}>
					<BackLink />
				</Box>
			</Inline>
			{query.error ? (
				<LoadErrorAlert
					message={errorText(site, query.error, t("editor.loadFailed"))}
					onRetry={() => void query.refetch()}
				/>
			) : (
				<Stack gap={0} grow align="center" justify="center">
					<Text as="p" variant="note" tone="subtle" role="status">
						{tc("loading")}
					</Text>
				</Stack>
			)}
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
	// Someone saved the template first: a notice strip, with the way to take their version.
	const [conflict, setConflict] = useState(false);

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
		onError: (err) => {
			if (isConflict(err)) setConflict(true);
			else setError(errorText(site, err, tc("saveFailed")));
		},
	});
	const saved = template ? { name: template.name, doc: template.doc } : null;
	// A new template starts as the outline; it is not a change until the writer edits it.
	const [outline] = useState(() => newTemplateDoc(t));
	const { draft, update, replace, dirty } = useDraftEditor<TemplateDraft>({
		saved,
		empty: { name: "", doc: outline },
		equals: (a, b) => a.name === b.name && documentKey(site, a.doc) === documentKey(site, b.doc),
		saving: save.isPending,
	});
	const { dialog: guardDialog } = useUnsavedGuard(dirty);
	const actions = useTemplateActions({ onDeleted: () => router.navigate(templatesHref(site)) });

	const loadServerCopy = async () => {
		if (!template) return;
		const fresh = await queryClient.fetchQuery({
			queryKey: templatesKeys.detail(template.id),
			queryFn: ({ signal }) => getTemplate(site, template.id, signal, t("editor.loadFailed")),
			staleTime: 0,
		});
		queryClient.setQueryData(templatesKeys.detail(fresh.id), fresh);
		replace({ name: fresh.name, doc: fresh.doc });
		setConflict(false);
	};

	const handleSave = () => {
		if (!dirty || save.isPending) return;
		if (!draft.name.trim()) {
			setError(t("editor.nameRequired"));
			return;
		}
		setError(null);
		setConflict(false);
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
				gap={12}
				shrink={false}
				border="bottom"
				background="page"
				minHeight="header"
				paddingX={12}
			>
				<Inline gap={12} minWidth={0} paddingX={12}>
					<BackLink />
					{dirty && <EntryStatus status="editing">{t("editor.unsaved")}</EntryStatus>}
				</Inline>
				<Inline gap={12} justify="end">
					{/* Always there, like the entry editor's: ⌘S does the same. */}
					<TextButton type="button" disabled={save.isPending} onClick={handleSave}>
						{save.isPending ? tc("saving") : tc("save")}{" "}
						<Text variant="micro" tone="faint">
							⌘S
						</Text>
					</TextButton>
					<MoreActionsButton actions={template ? actions.menu(template) : []} label={t("editor.more")}>
						<EditorMenuRows />
					</MoreActionsButton>
					<Inline height="control-sm" paddingX={4}>
						<Separator orientation="vertical" aria-hidden />
					</Inline>
					<SidePanelToggle />
				</Inline>
			</Inline>

			{conflict && (
				<Banner tone="danger" role="alert" title={t("editor.conflict")} meta={t("editor.conflictMeta")} plainMeta>
					<TextButton onClick={() => void loadServerCopy()}>{t("editor.loadServer")}</TextButton>
				</Banner>
			)}

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
								{/* The one ink rule of the page: 20 above; the 32 below is the editor's own spacing under the title. */}
								<Box border="bottom-contrast" paddingTop={20} />
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
