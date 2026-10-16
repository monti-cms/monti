"use client";

import { errorText, useCmsMutation } from "@monti-cms/admin/api";
import {
	Button,
	commonMessages,
	DETAIL_PANE_FRAME,
	EditorFooter,
	EmptyState,
	Field,
	FieldGroup,
	FieldLabel,
	FieldTitle,
	IconButton,
	Input,
	ListPane,
	ListRow,
	LoadErrorAlert,
	MasterDetail,
	Textarea,
	useConfirm,
	useDraftEditor,
} from "@monti-cms/admin/kit";
import { type Translator, useSite, useTranslator } from "@monti-cms/core/site";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus, Quote, RotateCcw, Save } from "lucide-react";
import { useId, useState } from "react";
import type { AiSnippetItem, AiSnippetView } from "../snippets";
import { aiKeys, createAiSnippet, deleteAiSnippet, getAiSnippets, updateAiSnippet } from "./api";
import { snippetMessages } from "./snippet-editor.messages";

/** Shape of the instruction and prompt snippet input fields (both are text that goes into instructions). */
export const PROMPT_ROWS = 8;
export const PROMPT_TEXTAREA = "min-h-40 text-xs md:text-xs";

export function useAiSnippets() {
	const site = useSite();
	const t = useTranslator(snippetMessages);
	return useQuery({
		queryKey: aiKeys.snippets(),
		queryFn: ({ signal }) => getAiSnippets(site, { signal, fallback: t("error.load") }),
	});
}

/** Shape to put into instructions. */
const placeholderOf = (key: string) => `{{snippet.${key}}}`;

const detailOf = (t: Translator<"detail.added">, item: AiSnippetItem) =>
	`${placeholderOf(item.key)}${item.source === "added" ? ` · ${t("detail.added")}` : ""}`;

/**
 * AI screen Prompt snippets tab. The list and edit pane of texts (e.g. a style guide) that go into the instructions of several actions as `{{snippet.key}}`.
 * For a text written in the config, only the content is edited; for a text added by the admin, the name and content are edited or it is deleted. A saved text is used right away by
 * every action run afterwards. The AI screen holds the open text (`selected`), because the header's Add text and tab switching ask about
 * unsaved content.
 */
export function SnippetManager({
	selected,
	onOpen,
	onSelectedChange,
	onDirtyChange,
}: {
	selected: string | "new" | null;
	/** Opens from the list. If there is unsaved content, the AI screen asks first. */
	onOpen: (key: string | "new") => void;
	/** Switches without asking after save, delete or cancel. */
	onSelectedChange: (key: string | null) => void;
	onDirtyChange: (dirty: boolean) => void;
}) {
	const site = useSite();
	const t = useTranslator(snippetMessages);
	const queryClient = useQueryClient();
	const query = useAiSnippets();
	const view = query.data;
	const current = view?.items.find((item) => item.key === selected) ?? null;
	const applySaved = (saved: AiSnippetView) => queryClient.setQueryData(aiKeys.snippets(), saved);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{query.error && !view && (
				<LoadErrorAlert
					className="m-3"
					message={errorText(site, query.error, t("error.load"))}
					onRetry={() => void query.refetch()}
				/>
			)}
			<MasterDetail
				list={
					<ListPane
						label={t("list.label")}
						loading={query.isPending}
						skeletonRows={2}
						empty={view?.items.length === 0 ? <EmptyState compact title={t("list.empty")} /> : null}
					>
						{view?.items.map((item) => (
							<ListRow
								key={item.key}
								title={item.label}
								detail={detailOf(t, item)}
								current={selected === item.key}
								onClick={() => onOpen(item.key)}
							/>
						))}
					</ListPane>
				}
			>
				{view && (selected === "new" || current) ? (
					<SnippetEditor
						key={selected ?? "none"}
						version={view.version}
						item={current}
						onSaved={(saved, key) => {
							applySaved(saved);
							onSelectedChange(key);
						}}
						onDeleted={(saved) => {
							applySaved(saved);
							onSelectedChange(null);
						}}
						onCancel={() => onSelectedChange(null)}
						onConflict={() => void query.refetch()}
						onDirtyChange={onDirtyChange}
					/>
				) : (
					view && (
						<EmptyState
							icon={Quote}
							title={t("empty.title")}
							action={{ label: t("action.add"), onClick: () => onOpen("new"), icon: Plus }}
						/>
					)
				)}
			</MasterDetail>
		</div>
	);
}

interface Draft {
	key: string;
	label: string;
	text: string;
}

const NEW_DRAFT: Draft = { key: "", label: "", text: "" };

/** Shows the shape to put into instructions and copies it. */
function PlaceholderChip({ shareKey }: { shareKey: string }) {
	const t = useTranslator(snippetMessages);
	const [copied, setCopied] = useState(false);
	const text = placeholderOf(shareKey);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// If the clipboard is unavailable, leave it as is.
		}
	};
	return (
		<div className="flex items-center gap-1">
			<code className="rounded-md border bg-cms-muted px-2 py-1 font-mono text-xs">{text}</code>
			<IconButton label={copied ? t("copy.done") : t("copy.label")} size="icon-xs" onClick={() => void copy()}>
				{copied ? <Check aria-hidden className="text-cms-primary" /> : <Copy aria-hidden />}
			</IconButton>
		</div>
	);
}

function SnippetEditor({
	version,
	item,
	onSaved,
	onDeleted,
	onCancel,
	onConflict,
	onDirtyChange,
}: {
	version: number;
	/** If `null`, a new text. */
	item: AiSnippetItem | null;
	onSaved: (saved: AiSnippetView, key: string) => void;
	onDeleted: (saved: AiSnippetView) => void;
	onCancel: () => void;
	onConflict: () => void;
	onDirtyChange: (dirty: boolean) => void;
}) {
	const site = useSite();
	const t = useTranslator(snippetMessages);
	const tc = useTranslator(commonMessages);
	const [error, setError] = useState<string | null>(null);
	const { confirm, dialog } = useConfirm();
	const ids = { label: useId(), key: useId(), keyTitle: useId(), text: useId() };
	const {
		draft,
		update: set,
		dirty,
	} = useDraftEditor({
		saved: item ? { key: item.key, label: item.label, text: item.text } : null,
		empty: NEW_DRAFT,
		onDirtyChange,
	});
	const fromConfig = item?.source === "config";

	const saveMutation = useCmsMutation({
		fn: (_: undefined, { site }) => {
			const key = item?.key ?? draft.key.trim();
			return item
				? updateAiSnippet(
						site,
						{
							expectedVersion: version,
							key,
							text: draft.text,
							...(fromConfig ? {} : { label: draft.label.trim() }),
						},
						tc("saveFailed"),
					)
				: createAiSnippet(
						site,
						{ expectedVersion: version, key, label: draft.label.trim(), text: draft.text },
						tc("saveFailed"),
					);
		},
		success: tc("saved"),
		failure: tc("saveFailed"),
		inline: true,
		onSuccess: (saved) => onSaved(saved, item?.key ?? draft.key.trim()),
		onError: (saveError) => {
			setError(errorText(site, saveError, tc("saveFailed")));
			onConflict();
		},
	});

	const deleteMutation = useCmsMutation({
		fn: (target: AiSnippetItem, { site }) => deleteAiSnippet(site, target.key, version, tc("deleteFailed")),
		success: tc("deleted"),
		failure: tc("deleteFailed"),
		inline: true,
		onSuccess: (saved) => onDeleted(saved),
		onError: (deleteError) => {
			setError(errorText(site, deleteError, tc("deleteFailed")));
			onConflict();
		},
	});
	const saving = saveMutation.isPending;
	const deleting = deleteMutation.isPending;

	const save = () => {
		setError(null);
		saveMutation.mutate(undefined);
	};

	const remove = async () => {
		if (!item) return;
		const ok = await confirm({
			title: t("confirm.title"),
			description: t("confirm.description", { name: item.label }),
			confirmLabel: tc("delete"),
			destructive: true,
		});
		if (!ok) return;
		setError(null);
		deleteMutation.mutate(item);
	};

	const shownKey = item?.key ?? draft.key.trim();

	return (
		<div className={DETAIL_PANE_FRAME}>
			<div className="min-w-0">
				<h2 className="truncate font-medium text-base">{(item ? item.label : draft.label.trim()) || t("new.title")}</h2>
				{(shownKey || item?.source === "added") && (
					<p className="truncate text-cms-muted-foreground text-xs">
						{item ? detailOf(t, item) : `${placeholderOf(shownKey)} · ${t("detail.added")}`}
					</p>
				)}
			</div>

			<FieldGroup className="gap-5">
				<Field>
					<FieldLabel htmlFor={ids.label}>{t("field.name")}</FieldLabel>
					<Input
						id={ids.label}
						value={draft.label}
						maxLength={40}
						disabled={fromConfig}
						onChange={(event) => set({ label: event.target.value })}
						className="h-8 text-xs md:text-xs"
					/>
				</Field>
				{item ? (
					<Field role="group" aria-labelledby={ids.keyTitle}>
						<FieldTitle id={ids.keyTitle}>{t("field.key")}</FieldTitle>
						<PlaceholderChip shareKey={item.key} />
					</Field>
				) : (
					<Field>
						<FieldLabel htmlFor={ids.key}>{t("field.key")}</FieldLabel>
						<Input
							id={ids.key}
							value={draft.key}
							maxLength={40}
							autoComplete="off"
							spellCheck={false}
							onChange={(event) => set({ key: event.target.value.trim() })}
							className="h-8 font-mono text-xs md:text-xs"
						/>
					</Field>
				)}
				<Field>
					<FieldLabel htmlFor={ids.text}>{t("field.content")}</FieldLabel>
					<Textarea
						id={ids.text}
						rows={PROMPT_ROWS}
						value={draft.text}
						onChange={(event) => set({ text: event.target.value })}
						className={PROMPT_TEXTAREA}
					/>
				</Field>
			</FieldGroup>

			<EditorFooter
				dirty={dirty}
				saving={saving}
				deleting={deleting}
				canSave={Boolean(draft.label.trim() && draft.key.trim())}
				error={error}
				saveIcon={<Save aria-hidden />}
				onSave={save}
				onCancel={item ? undefined : onCancel}
				onDelete={item?.source === "added" ? () => void remove() : undefined}
			>
				{item?.source === "config" && (
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={draft.text === item.defaultText}
						onClick={() => set({ text: item.defaultText })}
					>
						<RotateCcw aria-hidden />
						{t("action.resetDefault")}
					</Button>
				)}
			</EditorFooter>
			{dialog}
		</div>
	);
}
