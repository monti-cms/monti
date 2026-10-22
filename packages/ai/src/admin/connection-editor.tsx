"use client";

import { errorText, useCmsMutation, useSite, useTranslator } from "@monti-cms/admin";
import {
	type ApiKeyChoice,
	ApiKeyField,
	Button,
	choiceReady,
	commonMessages,
	DETAIL_PANE_FRAME,
	EditorFooter,
	EmptyState,
	FormField,
	FormFieldDescription,
	FormFieldError,
	FormFieldGroup,
	FormFieldLabel,
	Input,
	ListPane,
	ListRow,
	LoadErrorAlert,
	MasterDetail,
	useConfirm,
	useDebounced,
	useDraftEditor,
} from "@monti-cms/admin/kit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug, PlugZap, Plus, Save } from "lucide-react";
import { useId, useState } from "react";
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
				<LoadErrorAlert
					className="m-normal"
					message={errorText(site, settingsQuery.error, t("error.loadList"))}
					onRetry={() => void settingsQuery.refetch()}
				/>
			)}
			<MasterDetail
				list={
					<ListPane
						label={t("list.label")}
						loading={settingsQuery.isPending}
						skeletonRows={2}
						header={
							settings?.fake && (
								<p className="border-b px-normal py-condensed text-monti-caption text-monti-muted">{t("badge.fake")}</p>
							)
						}
						empty={settings?.providers.length === 0 ? <EmptyState compact title={t("list.empty")} /> : null}
					>
						{settings?.providers.map((provider) => (
							<ListRow
								key={provider.id}
								title={provider.name}
								status={provider.ready ? null : t("status.needsSetup")}
								detail={`${providerKindLabel(provider.kind)} · ${provider.defaultModel || t("model.none")}`}
								current={selected === provider.id}
								onClick={() => onOpen(provider.id)}
							/>
						))}
					</ListPane>
				}
			>
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
						<EmptyState
							icon={Plug}
							title={settings.providers.length === 0 ? t("empty.none") : t("empty.title")}
							action={{ label: t("action.add"), onClick: () => onOpen("new"), icon: Plus }}
						/>
					)
				)}
			</MasterDetail>
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
	const tc = useTranslator(commonMessages);
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
				? updateAiProvider(site, provider.id, json, tc("saveFailed"))
				: createAiProvider(site, json, tc("saveFailed"));
		},
		success: tc("saved"),
		failure: tc("saveFailed"),
		inline: true,
		onSuccess: (saved) => {
			// A new connection is appended to the end of the list.
			onSaved(saved, provider?.id ?? saved.providers.at(-1)?.id ?? "");
		},
		onError: (saveError) => {
			setError(errorText(site, saveError, tc("saveFailed")));
			onConflict();
		},
	});

	const deleteMutation = useCmsMutation({
		fn: (target: AiProviderView, { site }) => deleteAiProvider(site, target.id, version, tc("deleteFailed")),
		success: tc("deleted"),
		failure: tc("deleteFailed"),
		inline: true,
		onSuccess: (saved) => onDeleted(saved),
		onError: (deleteError) => {
			setError(errorText(site, deleteError, tc("deleteFailed")));
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
			confirmLabel: tc("delete"),
			destructive: true,
		});
		if (!ok) return;
		setError(null);
		deleteMutation.mutate(provider);
	};

	const runCheck = () => checkMutation.mutate(undefined);

	return (
		<div className={DETAIL_PANE_FRAME}>
			<div className="min-w-0">
				<h2 className="truncate text-monti-title">
					{(provider ? provider.name : draft.name.trim()) || t("new.title")}
				</h2>
				<p className="truncate text-monti-caption text-monti-muted">
					{providerKindLabel(draft.kind)} · {provider?.defaultModel || draft.defaultModel || t("model.none")}
				</p>
			</div>

			<FormFieldGroup className="gap-comfortable">
				<FormField>
					<FormFieldLabel htmlFor={ids.name}>{t("field.name")}</FormFieldLabel>
					<Input
						id={ids.name}
						value={draft.name}
						placeholder="OpenRouter"
						onChange={(event) => set({ name: event.target.value })}
						className="h-8 text-monti-caption md:text-monti-caption"
					/>
					<FormFieldDescription>{t("field.name.hint")}</FormFieldDescription>
				</FormField>
				<FormField>
					<FormFieldLabel htmlFor={ids.kind}>{t("field.kind")}</FormFieldLabel>
					<OptionSelect
						id={ids.kind}
						value={draft.kind}
						disabled={Boolean(provider)}
						options={AI_PROVIDER_KINDS.map((kind) => ({ value: kind, label: providerKindLabel(kind) }))}
						onChange={(kind) => set({ kind: kind as AiProviderKind })}
					/>
					<FormFieldDescription>{t("field.kind.hint")}</FormFieldDescription>
				</FormField>
				<FormField>
					<FormFieldLabel htmlFor={ids.url}>{t("field.url")}</FormFieldLabel>
					<Input
						id={ids.url}
						value={draft.url}
						placeholder={example.url}
						onChange={(event) => set({ url: event.target.value.trim() })}
						className="h-8 font-mono text-monti-caption md:text-monti-caption"
					/>
					<FormFieldDescription>{t("field.url.hint")}</FormFieldDescription>
				</FormField>
				<div className="flex flex-col gap-condensed">
					<ApiKeyField
						label={t("field.key")}
						baseName={draft.name.trim() || "API"}
						value={draft.key}
						onChange={(key) => set({ key })}
					/>
					<p className="text-monti-caption text-monti-muted">{t("field.key.hint")}</p>
				</div>
				<FormField>
					<FormFieldLabel htmlFor={ids.model}>{t("field.model")}</FormFieldLabel>
					<ModelCombobox
						id={ids.model}
						value={draft.defaultModel}
						models={modelList.models}
						loading={modelList.loading}
						error={modelList.error}
						placeholder={example.model}
						onChange={(defaultModel) => set({ defaultModel })}
					/>
					<FormFieldDescription>{t("field.model.hint")}</FormFieldDescription>
				</FormField>
			</FormFieldGroup>

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
			{check &&
				(check.ok ? (
					<p className="text-monti-caption text-monti-muted">
						{t("check.ok", { model: check.model, seconds: (check.ms / 1000).toFixed(1) })}
					</p>
				) : (
					<FormFieldError>{check.message}</FormFieldError>
				))}
			{dialog}
		</div>
	);
}
