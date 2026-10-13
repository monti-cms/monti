"use client";

import { errorText, useCmsMutation } from "@monti-cms/admin/api";
import {
	Alert,
	AlertDescription,
	type ApiKeyChoice,
	ApiKeyField,
	Button,
	choiceReady,
	cn,
	EditorFooter,
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
	useDraftEditor,
} from "@monti-cms/admin/kit";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug, PlugZap, Plus, Save } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import {
	AI_PROVIDER_KINDS,
	type AiCheckResult,
	type AiProviderKind,
	type AiProviderView,
	type AiSettingsView,
	PROVIDER_EXAMPLES,
} from "../connection";
import {
	aiKeys,
	checkAiProvider,
	createAiProvider,
	deleteAiProvider,
	getAiSettings,
	type ModelSource,
	updateAiProvider,
} from "./api";
import { connectionMessages } from "./connection-editor.messages";
import { OptionSelect } from "./custom-editor";
import { useLabels } from "./labels.messages";
import { ModelCombobox, useModelList } from "./model-combobox";

export function useAiSettings() {
	const site = useSite();
	const t = useTranslator(connectionMessages);
	return useQuery({
		queryKey: aiKeys.settings(),
		queryFn: ({ signal }) => getAiSettings(site, { signal, fallback: t("error.loadList") }),
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
		<Alert variant="destructive" className="m-3 flex w-auto items-center justify-between gap-3">
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

/** Time to wait for URL/key input to pause before fetching the model list. */
const LIST_INPUT_DEBOUNCE_MS = 400;

interface Draft {
	name: string;
	kind: AiProviderKind;
	url: string;
	key: ApiKeyChoice;
	defaultModel: string;
}

const NEW_DRAFT: Draft = { name: "", kind: "chat", url: "", key: { use: "new", value: "" }, defaultModel: "" };

const draftOf = (provider: AiProviderView): Draft => ({
	name: provider.name,
	kind: provider.kind,
	url: provider.url,
	key: provider.key ? { use: "saved", keyId: provider.key.id } : { use: "new", value: "" },
	defaultModel: provider.defaultModel,
});

/** The draft as the server takes it: a new key with nothing typed yet is left out, so the connection keeps the key it had. */
const payload = ({ key, ...rest }: Draft) => (choiceReady(key) && key.use !== "none" ? { ...rest, key } : rest);

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
		queryClient.setQueryData(aiKeys.settings(), saved);
		void queryClient.invalidateQueries({ queryKey: aiKeys.actions() });
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
	const [error, setError] = useState<string | null>(null);
	const [check, setCheck] = useState<AiCheckResult | null>(null);
	const { confirm, dialog } = useConfirm();
	const ids = { name: useId(), kind: useId(), url: useId(), model: useId() };
	const editor = useDraftEditor({ saved: provider ? draftOf(provider) : null, empty: NEW_DRAFT, onDirtyChange });
	const { draft, dirty } = editor;
	const set = (patch: Partial<Draft>) => {
		editor.update(patch);
		setCheck(null);
	};

	const example = PROVIDER_EXAMPLES[draft.kind];
	// While typing the URL or key the list is not fetched; it is fetched once typing pauses. If the saved key is used as is, it is fetched by connection id.
	const listUrl = useDebounced(draft.url, LIST_INPUT_DEBOUNCE_MS);
	const typedKey = useDebounced(draft.key.use === "new" ? draft.key.value : undefined, LIST_INPUT_DEBOUNCE_MS);
	const modelSource: ModelSource | null =
		draft.kind !== "chat" || !listUrl
			? null
			: typedKey
				? { url: listUrl, apiKey: typedKey }
				: draft.key.use === "saved"
					? { url: listUrl, keyId: draft.key.keyId }
					: null;
	const modelList = useModelList(modelSource);

	const saveMutation = useCmsMutation({
		fn: (_: undefined, { site }) => {
			const json = { expectedVersion: version, provider: payload(draft) };
			return provider
				? updateAiProvider(site, provider.id, json, t("error.save"))
				: createAiProvider(site, json, t("error.save"));
		},
		success: t("toast.saved"),
		failure: t("error.save"),
		inline: true,
		onSuccess: (saved) => {
			// A new connection is appended to the end of the list.
			onSaved(saved, provider?.id ?? saved.providers.at(-1)?.id ?? "");
		},
		onError: (saveError) => {
			setError(errorText(site, saveError, t("error.save")));
			onConflict();
		},
	});

	const deleteMutation = useCmsMutation({
		fn: (target: AiProviderView, { site }) => deleteAiProvider(site, target.id, version, t("error.delete")),
		success: t("toast.deleted"),
		failure: t("error.delete"),
		inline: true,
		onSuccess: (saved) => onDeleted(saved),
		onError: (deleteError) => {
			setError(errorText(site, deleteError, t("error.delete")));
			onConflict();
		},
	});

	/** Checks with the current input before saving. If no new key was entered, uses the saved key. */
	const checkMutation = useCmsMutation({
		fn: (_: undefined, { site }) =>
			checkAiProvider(site, { providerId: provider?.id, provider: payload(draft) }, t("error.check")),
		failure: t("error.check"),
		inline: true,
		onSuccess: setCheck,
		onError: (checkError) => setCheck({ ok: false, message: errorText(site, checkError, t("error.check")) }),
	});
	const saving = saveMutation.isPending;
	const deleting = deleteMutation.isPending;
	const checking = checkMutation.isPending;

	const save = () => {
		setError(null);
		saveMutation.mutate(undefined);
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
		setError(null);
		deleteMutation.mutate(provider);
	};

	const runCheck = () => checkMutation.mutate(undefined);

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
				<ApiKeyField
					label={t("field.key")}
					baseName={draft.name.trim() || "API"}
					value={draft.key}
					onChange={(key) => set({ key })}
				/>
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

			<EditorFooter
				dirty={dirty}
				saving={saving}
				deleting={deleting}
				canSave={Boolean(draft.name.trim())}
				error={error}
				saveIcon={<Save aria-hidden />}
				onSave={save}
				onCancel={provider ? undefined : onCancel}
				onDelete={provider ? () => void remove() : undefined}
			>
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
			</EditorFooter>
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
