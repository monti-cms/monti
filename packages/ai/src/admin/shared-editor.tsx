"use client";

import { cmsFetch, errorText } from "@monti-cms/admin/api";
import {
	Button,
	Empty,
	EmptyContent,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
	Field,
	FieldGroup,
	FieldLabel,
	FieldTitle,
	IconButton,
	Input,
	Textarea,
	useConfirm,
} from "@monti-cms/admin/kit";
import { cmsApiUrl, type Translator, useSite, useTranslator } from "@monti-cms/core/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Plus, Quote, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import type { AiSharedItem, AiSharedView } from "../shared";
import { DETAIL_PANE, InlineError, ListRow, ListSkeleton, LoadError } from "./connection-editor";
import { sharedMessages } from "./shared-editor.messages";

export const AI_SHARED_KEY = ["cms", "ai", "shared"] as const;

/** Shape of the instruction and shared text input fields (both are text that goes into instructions). */
export const PROMPT_ROWS = 8;
export const PROMPT_TEXTAREA = "min-h-40 text-xs md:text-xs";

const SHARED_API = cmsApiUrl("/v1/ai/shared");

export function useAiShared() {
	const site = useSite();
	const t = useTranslator(sharedMessages);
	return useQuery({
		queryKey: AI_SHARED_KEY,
		queryFn: ({ signal }) => cmsFetch<AiSharedView>(site, SHARED_API, { signal, fallback: t("error.load") }),
	});
}

/** Shape to put into instructions. */
const placeholderOf = (key: string) => `{{shared.${key}}}`;

const detailOf = (t: Translator<"detail.added">, item: AiSharedItem) =>
	`${placeholderOf(item.key)}${item.source === "added" ? ` · ${t("detail.added")}` : ""}`;

/**
 * AI screen Shared texts tab. The list and edit pane of texts (e.g. a style guide) that go into the instructions of several actions as `{{shared.key}}`.
 * For a text written in the config, only the content is edited; for a text added by the admin, the name and content are edited or it is deleted. A saved text is used right away by
 * every action run afterwards. The AI screen holds the open text (`selected`), because the header's Add text and tab switching ask about
 * unsaved content.
 */
export function SharedManager({
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
	const t = useTranslator(sharedMessages);
	const queryClient = useQueryClient();
	const query = useAiShared();
	const view = query.data;
	const current = view?.items.find((item) => item.key === selected) ?? null;
	const applySaved = (saved: AiSharedView) => queryClient.setQueryData(AI_SHARED_KEY, saved);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{query.error && !view && (
				<LoadError message={errorText(site, query.error, t("error.load"))} onRetry={() => void query.refetch()} />
			)}
			<div className="flex min-h-0 flex-1 overflow-hidden">
				<div className="flex w-72 shrink-0 flex-col border-r">
					<ul className="min-h-0 flex-1 divide-y overflow-y-auto" aria-label={t("list.label")}>
						{query.isPending ? (
							<ListSkeleton rows={2} />
						) : view?.items.length === 0 ? (
							<li className="px-3 py-6 text-center text-cms-muted-foreground text-xs">{t("list.empty")}</li>
						) : (
							view?.items.map((item) => (
								<ListRow
									key={item.key}
									title={item.label}
									detail={detailOf(t, item)}
									current={selected === item.key}
									onClick={() => onOpen(item.key)}
								/>
							))
						)}
					</ul>
				</div>

				<div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
					{view && (selected === "new" || current) ? (
						<SharedEditor
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
							<Empty className="flex-1">
								<EmptyHeader>
									<EmptyMedia variant="icon">
										<Quote aria-hidden />
									</EmptyMedia>
									<EmptyTitle>{t("empty.title")}</EmptyTitle>
								</EmptyHeader>
								<EmptyContent>
									<Button type="button" size="sm" onClick={() => onOpen("new")}>
										<Plus aria-hidden />
										{t("action.add")}
									</Button>
								</EmptyContent>
							</Empty>
						)
					)}
				</div>
			</div>
		</div>
	);
}

interface Draft {
	key: string;
	label: string;
	text: string;
}

const NEW_DRAFT: Draft = { key: "", label: "", text: "" };

const sameDraft = (a: Draft, b: Draft) => a.key === b.key && a.label === b.label && a.text === b.text;

/** Shows the shape to put into instructions and copies it. */
function PlaceholderChip({ shareKey }: { shareKey: string }) {
	const t = useTranslator(sharedMessages);
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

function SharedEditor({
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
	item: AiSharedItem | null;
	onSaved: (saved: AiSharedView, key: string) => void;
	onDeleted: (saved: AiSharedView) => void;
	onCancel: () => void;
	onConflict: () => void;
	onDirtyChange: (dirty: boolean) => void;
}) {
	const site = useSite();
	const t = useTranslator(sharedMessages);
	const initial: Draft = item ? { key: item.key, label: item.label, text: item.text } : NEW_DRAFT;
	const [draft, setDraft] = useState<Draft>(initial);
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { confirm, dialog } = useConfirm();
	const ids = { label: useId(), key: useId(), keyTitle: useId(), text: useId() };
	const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
	const fromConfig = item?.source === "config";
	const dirty = item === null || !sameDraft(draft, initial);
	// A new text with nothing entered has nothing to discard.
	const unsaved = item === null ? !sameDraft(draft, NEW_DRAFT) : dirty;
	useEffect(() => onDirtyChange(unsaved), [unsaved, onDirtyChange]);
	useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

	const save = async () => {
		setSaving(true);
		setError(null);
		try {
			const key = item?.key ?? draft.key.trim();
			const saved = item
				? await cmsFetch<AiSharedView>(site, SHARED_API, {
						method: "PATCH",
						json: {
							expectedVersion: version,
							key,
							text: draft.text,
							...(fromConfig ? {} : { label: draft.label.trim() }),
						},
						fallback: t("error.save"),
					})
				: await cmsFetch<AiSharedView>(site, SHARED_API, {
						method: "POST",
						json: { expectedVersion: version, key, label: draft.label.trim(), text: draft.text },
						fallback: t("error.save"),
					});
			onSaved(saved, key);
			toast.success(t("toast.saved"));
		} catch (saveError) {
			setError(errorText(site, saveError, t("error.save")));
			onConflict();
		} finally {
			setSaving(false);
		}
	};

	const remove = async () => {
		if (!item) return;
		const ok = await confirm({
			title: t("confirm.title"),
			description: t("confirm.description", { name: item.label }),
			confirmLabel: t("action.delete"),
			destructive: true,
		});
		if (!ok) return;
		setDeleting(true);
		setError(null);
		try {
			onDeleted(
				await cmsFetch<AiSharedView>(
					site,
					`${SHARED_API}?key=${encodeURIComponent(item.key)}&expectedVersion=${version}`,
					{
						method: "DELETE",
						fallback: t("error.delete"),
					},
				),
			);
			toast.success(t("toast.deleted"));
		} catch (deleteError) {
			setError(errorText(site, deleteError, t("error.delete")));
			onConflict();
		} finally {
			setDeleting(false);
		}
	};

	const shownKey = item?.key ?? draft.key.trim();

	return (
		<div className={DETAIL_PANE}>
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

			{error && <InlineError>{error}</InlineError>}

			<div className="flex flex-wrap items-center gap-2">
				<Button
					type="button"
					size="sm"
					disabled={saving || !dirty || !draft.label.trim() || !draft.key.trim()}
					onClick={() => void save()}
				>
					<Save aria-hidden />
					{saving ? t("action.saving") : t("action.save")}
				</Button>
				{!item && (
					<Button type="button" size="sm" variant="outline" onClick={onCancel}>
						{t("action.cancel")}
					</Button>
				)}
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
				{item?.source === "added" && (
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="ml-auto text-cms-destructive hover:bg-cms-destructive/10 hover:text-cms-destructive"
						disabled={deleting}
						onClick={() => void remove()}
					>
						<Trash2 aria-hidden />
						{deleting ? t("action.deleting") : t("action.delete")}
					</Button>
				)}
			</div>
			{dialog}
		</div>
	);
}
