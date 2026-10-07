"use client";

import { cmsFetch, errorText } from "@monti-cms/admin/api";
import {
	Alert,
	AlertDescription,
	Button,
	cn,
	Empty,
	EmptyContent,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
	Field,
	FieldGroup,
	FieldLabel,
	Input,
	Skeleton,
	useConfirm,
	useDebounced,
} from "@monti-cms/admin/kit";
import { cmsApiUrl, useSite, useTranslator } from "@monti-cms/core/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug, PlugZap, Plus, Save, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import {
	AI_PROVIDER_KINDS,
	type AiCheckResult,
	type AiProviderKind,
	type AiProviderView,
	type AiSettingsView,
	PROVIDER_EXAMPLES,
} from "../connection";
import { AI_ACTIONS_KEY } from "./ai-slot-provider";
import { connectionMessages } from "./connection-editor.messages";
import { OptionSelect } from "./custom-editor";
import { useLabels } from "./labels.messages";
import { ModelCombobox, type ModelSource, useModelList } from "./model-combobox";

export const AI_SETTINGS_KEY = ["cms", "ai", "settings"] as const;

export function useAiSettings() {
	const site = useSite();
	const t = useTranslator(connectionMessages);
	return useQuery({
		queryKey: AI_SETTINGS_KEY,
		queryFn: ({ signal }) =>
			cmsFetch<AiSettingsView>(site, cmsApiUrl("/v1/ai/settings"), { signal, fallback: t("error.loadList") }),
		// Not re-fetched every time an action is opened. Saving a connection updates the cache from the response.
		staleTime: 60_000,
	});
}

/** Pieces shared by the three tabs of the AI screen. The open-item shape of the list is the same as the admin screen's `OPEN_ITEM`. */
export const OPEN_ITEM = "bg-cms-accent text-cms-accent-foreground";

/** Frame of the detail pane (shared by actions, connections and shared texts). */
export const DETAIL_PANE = "mx-auto flex w-full max-w-3xl flex-col gap-5 p-6 text-sm";

/** Load failure. Reports it in place and allows fetching again. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
	const t = useTranslator(connectionMessages);
	return (
		<Alert variant="danger" className="m-3 flex w-auto items-center justify-between gap-3">
			<AlertDescription className="col-start-auto">{message}</AlertDescription>
			<Button type="button" variant="outline" size="xs" onClick={onRetry}>
				{t("action.retry")}
			</Button>
		</Alert>
	);
}

/** One list row. Status text to the right of the name, and a dim description below. */
export function ListRow({
	title,
	status,
	detail,
	current,
	onClick,
}: {
	title: string;
	status?: string | null;
	detail: ReactNode;
	current: boolean;
	onClick: () => void;
}) {
	return (
		<li>
			<button
				type="button"
				aria-current={current ? "true" : undefined}
				onClick={onClick}
				className={cn(
					"flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors",
					current ? OPEN_ITEM : "hover:bg-cms-accent/50",
				)}
			>
				<span className="flex w-full items-center gap-2">
					<span className="truncate font-medium text-sm">{title}</span>
					{status && <span className="ml-auto shrink-0 text-cms-muted-foreground text-xs">{status}</span>}
				</span>
				<span className="w-full truncate text-cms-muted-foreground text-xs">{detail}</span>
			</button>
		</li>
	);
}

/** Placeholder while the list loads. */
export function ListSkeleton({ rows }: { rows: number }) {
	return Array.from({ length: rows }, (_, index) => (
		// biome-ignore lint/suspicious/noArrayIndexKey: placeholder
		<li key={index} className="p-3" aria-hidden>
			<Skeleton className="h-9 w-full" />
		</li>
	));
}

/** One error line (inside the edit pane). */
export function InlineError({ children }: { children: ReactNode }) {
	return (
		<p role="alert" className="text-cms-destructive text-xs">
			{children}
		</p>
	);
}

/** Time to wait for URL/key input to pause before fetching the model list. */
const LIST_INPUT_DEBOUNCE_MS = 400;

/** Key input state. `undefined` keeps the saved key, `null` clears it. */
type KeyDraft = string | null | undefined;

interface Draft {
	name: string;
	kind: AiProviderKind;
	url: string;
	apiKey: KeyDraft;
	defaultModel: string;
}

const NEW_DRAFT: Draft = { name: "", kind: "chat", url: "", apiKey: undefined, defaultModel: "" };

const draftOf = (provider: AiProviderView): Draft => ({
	name: provider.name,
	kind: provider.kind,
	url: provider.url,
	apiKey: undefined,
	defaultModel: provider.defaultModel,
});

const sameDraft = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

/**
 * AI screen Connections tab. Keeps several connections (name, mode, URL, key, default model) and lets each action pick which connection to use.
 * The key is stored encrypted by the server, and only the last four characters are shown here.
 * The AI screen holds the open connection (`selected`), because the header's Add connection and tab switching ask about unsaved content.
 */
export function ConnectionManager({
	selected,
	onOpen,
	onSelectedChange,
	onDirtyChange,
}: {
	selected: string | "new" | null;
	/** Opens from the list. If there is unsaved content, the AI screen asks first. */
	onOpen: (id: string | "new") => void;
	/** Switches without asking after save, delete or cancel. */
	onSelectedChange: (id: string | null) => void;
	onDirtyChange: (dirty: boolean) => void;
}) {
	const site = useSite();
	const t = useTranslator(connectionMessages);
	const { providerKindLabel } = useLabels();
	const queryClient = useQueryClient();
	const settingsQuery = useAiSettings();
	const settings = settingsQuery.data;

	const applySaved = (saved: AiSettingsView) => {
		queryClient.setQueryData(AI_SETTINGS_KEY, saved);
		void queryClient.invalidateQueries({ queryKey: AI_ACTIONS_KEY });
	};

	const current = settings?.providers.find((provider) => provider.id === selected) ?? null;

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{settingsQuery.error && !settings && (
				<LoadError
					message={errorText(site, settingsQuery.error, t("error.loadList"))}
					onRetry={() => void settingsQuery.refetch()}
				/>
			)}
			<div className="flex min-h-0 flex-1 overflow-hidden">
				<div className="flex w-72 shrink-0 flex-col border-r">
					{settings?.fake && <p className="border-b px-3 py-2 text-cms-muted-foreground text-xs">{t("badge.fake")}</p>}
					<ul className="min-h-0 flex-1 divide-y overflow-y-auto" aria-label={t("list.label")}>
						{settingsQuery.isPending ? (
							<ListSkeleton rows={2} />
						) : settings?.providers.length === 0 ? (
							<li className="px-3 py-6 text-center text-cms-muted-foreground text-xs">{t("list.empty")}</li>
						) : (
							settings?.providers.map((provider) => (
								<ListRow
									key={provider.id}
									title={provider.name}
									status={provider.ready ? null : t("status.needsSetup")}
									detail={`${providerKindLabel(provider.kind)} · ${provider.defaultModel || t("model.none")}`}
									current={selected === provider.id}
									onClick={() => onOpen(provider.id)}
								/>
							))
						)}
					</ul>
				</div>

				<div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
					{settings && (selected === "new" || current) ? (
						<ProviderEditor
							key={selected ?? "none"}
							version={settings.version}
							provider={current}
							onSaved={(saved, id) => {
								applySaved(saved);
								onSelectedChange(id);
							}}
							onDeleted={(saved) => {
								applySaved(saved);
								onSelectedChange(null);
							}}
							onCancel={() => onSelectedChange(null)}
							onConflict={() => void settingsQuery.refetch()}
							onDirtyChange={onDirtyChange}
						/>
					) : (
						settings && (
							<Empty className="flex-1">
								<EmptyHeader>
									<EmptyMedia variant="icon">
										<Plug aria-hidden />
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

function ProviderEditor({
	version,
	provider,
	onSaved,
	onDeleted,
	onCancel,
	onConflict,
	onDirtyChange,
}: {
	version: number;
	provider: AiProviderView | null;
	onSaved: (saved: AiSettingsView, id: string) => void;
	onDeleted: (saved: AiSettingsView) => void;
	onCancel: () => void;
	onConflict: () => void;
	onDirtyChange: (dirty: boolean) => void;
}) {
	const site = useSite();
	const t = useTranslator(connectionMessages);
	const { providerKindLabel } = useLabels();
	const initial = provider ? draftOf(provider) : NEW_DRAFT;
	const [draft, setDraft] = useState<Draft>(initial);
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [checking, setChecking] = useState(false);
	const [check, setCheck] = useState<AiCheckResult | null>(null);
	const { confirm, dialog } = useConfirm();
	const ids = { name: useId(), kind: useId(), url: useId(), key: useId(), model: useId() };
	const set = (patch: Partial<Draft>) => {
		setDraft({ ...draft, ...patch });
		setCheck(null);
	};
	const dirty = provider === null || !sameDraft(draft, initial);
	// A new connection with nothing entered has nothing to discard.
	const unsaved = provider === null ? !sameDraft(draft, NEW_DRAFT) : dirty;
	useEffect(() => onDirtyChange(unsaved), [unsaved, onDirtyChange]);
	useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

	const example = PROVIDER_EXAMPLES[draft.kind];
	// While typing the URL or key the list is not fetched; it is fetched once typing pauses. If the saved key is used as is, it is fetched by connection id.
	const listUrl = useDebounced(draft.url, LIST_INPUT_DEBOUNCE_MS);
	const listKey = useDebounced(typeof draft.apiKey === "string" ? draft.apiKey : undefined, LIST_INPUT_DEBOUNCE_MS);
	const modelSource: ModelSource | null =
		draft.kind !== "chat" || !listUrl
			? null
			: listKey
				? { url: listUrl, apiKey: listKey }
				: provider?.keyHint && provider.url === listUrl && draft.apiKey === undefined
					? { providerId: provider.id }
					: null;
	const modelList = useModelList(modelSource);

	const save = async () => {
		setSaving(true);
		setError(null);
		try {
			const json = { expectedVersion: version, provider: draft };
			const saved = provider
				? await cmsFetch<AiSettingsView>(site, cmsApiUrl(`/v1/ai/providers/${provider.id}`), {
						method: "PATCH",
						json,
						fallback: t("error.save"),
					})
				: await cmsFetch<AiSettingsView>(site, cmsApiUrl("/v1/ai/providers"), {
						method: "POST",
						json,
						fallback: t("error.save"),
					});
			// A new connection is appended to the end of the list.
			const id = provider?.id ?? saved.providers.at(-1)?.id ?? "";
			onSaved(saved, id);
			toast.success(t("toast.saved"));
		} catch (saveError) {
			setError(errorText(site, saveError, t("error.save")));
			onConflict();
		} finally {
			setSaving(false);
		}
	};

	const remove = async () => {
		if (!provider) return;
		const ok = await confirm({
			title: t("confirm.title"),
			description: t("confirm.description", { name: provider.name }),
			confirmLabel: t("action.delete"),
			destructive: true,
		});
		if (!ok) return;
		setDeleting(true);
		setError(null);
		try {
			onDeleted(
				await cmsFetch<AiSettingsView>(site, cmsApiUrl(`/v1/ai/providers/${provider.id}?expectedVersion=${version}`), {
					method: "DELETE",
					fallback: t("error.delete"),
				}),
			);
			toast.success(t("toast.deleted"));
		} catch (deleteError) {
			setError(errorText(site, deleteError, t("error.delete")));
			onConflict();
		} finally {
			setDeleting(false);
		}
	};

	/** Checks with the current input before saving. If no new key was entered, uses the saved key. */
	const runCheck = async () => {
		setChecking(true);
		try {
			setCheck(
				await cmsFetch<AiCheckResult>(site, cmsApiUrl("/v1/ai/providers/check"), {
					method: "POST",
					json: { providerId: provider?.id, provider: draft },
					fallback: t("error.check"),
				}),
			);
		} catch (checkError) {
			setCheck({ ok: false, message: errorText(site, checkError, t("error.check")) });
		} finally {
			setChecking(false);
		}
	};

	return (
		<div className={DETAIL_PANE}>
			<div className="min-w-0">
				<h2 className="truncate font-medium text-base">
					{(provider ? provider.name : draft.name.trim()) || t("new.title")}
				</h2>
				<p className="truncate text-cms-muted-foreground text-xs">
					{providerKindLabel(draft.kind)} · {provider?.defaultModel || draft.defaultModel || t("model.none")}
				</p>
			</div>

			<FieldGroup className="gap-5">
				<Field>
					<FieldLabel htmlFor={ids.name}>{t("field.name")}</FieldLabel>
					<Input
						id={ids.name}
						value={draft.name}
						placeholder="OpenRouter"
						onChange={(event) => set({ name: event.target.value })}
						className="h-8 text-xs md:text-xs"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={ids.kind}>{t("field.kind")}</FieldLabel>
					<OptionSelect
						id={ids.kind}
						value={draft.kind}
						disabled={Boolean(provider)}
						options={AI_PROVIDER_KINDS.map((kind) => ({ value: kind, label: providerKindLabel(kind) }))}
						onChange={(kind) => set({ kind: kind as AiProviderKind })}
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={ids.url}>{t("field.url")}</FieldLabel>
					<Input
						id={ids.url}
						value={draft.url}
						placeholder={example.url}
						onChange={(event) => set({ url: event.target.value.trim() })}
						className="h-8 font-mono text-xs md:text-xs"
					/>
				</Field>
				<Field>
					<FieldLabel htmlFor={ids.key}>{t("field.key")}</FieldLabel>
					<div className="flex items-center gap-2">
						<Input
							id={ids.key}
							type="password"
							autoComplete="off"
							value={typeof draft.apiKey === "string" ? draft.apiKey : ""}
							placeholder={
								draft.apiKey === null
									? t("key.cleared")
									: provider?.keyHint
										? t("key.saved", { hint: provider.keyHint })
										: t("field.key")
							}
							onChange={(event) => set({ apiKey: event.target.value || undefined })}
							className="h-8 font-mono text-xs md:text-xs"
						/>
						{provider?.keyHint && draft.apiKey !== null && (
							<Button type="button" variant="ghost" size="xs" onClick={() => set({ apiKey: null })}>
								{t("action.clear")}
							</Button>
						)}
					</div>
				</Field>
				<Field>
					<FieldLabel htmlFor={ids.model}>{t("field.model")}</FieldLabel>
					<ModelCombobox
						id={ids.model}
						value={draft.defaultModel}
						models={modelList.models}
						loading={modelList.loading}
						error={modelList.error}
						placeholder={example.model}
						onChange={(defaultModel) => set({ defaultModel })}
					/>
				</Field>
			</FieldGroup>

			{error && <InlineError>{error}</InlineError>}

			<div className="flex flex-wrap items-center gap-2">
				<Button type="button" size="sm" disabled={saving || !dirty || !draft.name.trim()} onClick={() => void save()}>
					<Save aria-hidden />
					{saving ? t("action.saving") : t("action.save")}
				</Button>
				{!provider && (
					<Button type="button" size="sm" variant="outline" onClick={onCancel}>
						{t("action.cancel")}
					</Button>
				)}
				<Button
					type="button"
					size="sm"
					variant="outline"
					disabled={checking || !draft.url || !draft.defaultModel}
					onClick={() => void runCheck()}
				>
					<PlugZap aria-hidden />
					{checking ? t("action.checking") : t("action.check")}
				</Button>
				{provider && (
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
			{check && (
				<p
					className={cn("text-xs", check.ok ? "text-cms-muted-foreground" : "text-cms-destructive")}
					role={check.ok ? undefined : "alert"}
				>
					{check.ok ? t("check.ok", { model: check.model, seconds: (check.ms / 1000).toFixed(1) }) : check.message}
				</p>
			)}
			{dialog}
		</div>
	);
}
