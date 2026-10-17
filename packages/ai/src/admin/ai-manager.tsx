"use client";

import { errorText, issueMessages, useCmsMutation, useSite, useTranslator } from "@monti-cms/admin";
import {
	Button,
	Checkbox,
	cn,
	commonMessages,
	DETAIL_PANE_FRAME,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	EditorFooter,
	EmptyState,
	FormField,
	FormFieldError,
	FormFieldGroup,
	FormFieldLabel,
	FormFieldTitle,
	IconButton,
	Input,
	isComposingKey,
	Label,
	ListPane,
	ListRow,
	LoadErrorAlert,
	MasterDetail,
	PageActions,
	PageTabs,
	Switch,
	Tabs,
	TabsContent,
	TabsTrigger,
	Textarea,
	useConfirm,
	useDraftEditor,
	useHydratedQuery,
	useUnsavedGuard,
} from "@monti-cms/admin/kit";
import { SLOT_CHIP } from "@monti-cms/admin/slots";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Eye, EyeOff, Plug, Plus, Quote, RotateCcw, Save, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { draftCustomView } from "../action-view";
import type { AiActionView } from "../actions";
import type { CustomBase } from "../custom";
import { ADDABLE_CHECKS, type AddableCheckKind, type AiCheck, type AiRunResult, checkKey } from "../definition";
import { aiManagerMessages } from "./ai-manager.messages";
import { runAiAction, useAiActions } from "./ai-slot-provider";
import { missingRequired, SampleInputs, sampleDefaults, sampleFields, sampleRun } from "./ai-test-sample";
import { type AiActionsResponse, aiKeys, createAiAction, deleteAiAction, updateAiAction } from "./api";
import { ConnectionManager, useAiSettings } from "./connection-editor";
import { CustomBaseFields, NEW_CUSTOM_BASE, OptionSelect } from "./custom-editor";
import { useLabels } from "./labels.messages";
import { ModelCombobox, useModelList } from "./model-combobox";
import { PROMPT_ROWS, PROMPT_TEXTAREA, SnippetManager, useAiSnippets } from "./snippet-editor";

/** Visible name of the attach target. For a field, it is the name in the collection definition. */
function usePlaceLabel() {
	const site = useSite();
	const t = useTranslator(aiManagerMessages);
	const { slotLabel, slotTargetLabel } = useLabels();
	return (action: Pick<AiActionView, "attach">): string => {
		const attach = action.attach[0];
		if (!attach) return t("place.direct");
		switch (attach.slot) {
			case "field": {
				for (const collection of site.COLLECTIONS) {
					const field = site.schemaOf(collection).fields[attach.field];
					if (field) return `${slotLabel("field")} · ${field.label}`;
				}
				return `${slotLabel("field")} · ${attach.field}`;
			}
			case "translation":
			case "selection":
			case "insert":
				return slotLabel(attach.slot);
			case "block":
				return `${slotLabel("block")} · ${site.BLOCK_BY_NAME.get(attach.block)?.label ?? attach.block}`;
			default: {
				return `${slotLabel(attach.slot)} · ${slotTargetLabel(attach.slot, attach.target)}`;
			}
		}
	};
}

type FeatureGroup = "editor" | "fields" | "media" | "custom";
const GROUP_ORDER: readonly FeatureGroup[] = ["editor", "fields", "media", "custom"];

function groupOf(feature: Pick<AiActionView, "custom" | "attach">): FeatureGroup {
	if (feature.custom) return "custom";
	const slot = feature.attach[0]?.slot;
	if (slot === "selection" || slot === "insert" || slot === "block" || slot === "codeRules") return "editor";
	if (slot === "image" || slot === "media") return "media";
	return "fields";
}

/** Values editable in the admin screen. Sent with save and test. */
type Editable = Pick<
	AiActionView,
	| "enabled"
	| "hidden"
	| "label"
	| "askInstruction"
	| "instant"
	| "providerId"
	| "modelName"
	| "prompt"
	| "send"
	| "threshold"
	| "maxCount"
	| "checks"
>;

const editableOf = (action: AiActionView): Editable => ({
	enabled: action.enabled,
	hidden: action.hidden,
	label: action.label,
	askInstruction: action.askInstruction,
	instant: action.instant,
	providerId: action.providerId,
	modelName: action.modelName,
	prompt: action.prompt,
	send: action.send,
	threshold: action.threshold,
	maxCount: action.maxCount,
	checks: action.checks,
});

/** What the editor holds: the action as shown, the values being edited and, for a screen action, its basic info. */
interface FeatureDraft {
	feature: AiActionView;
	spec: Editable;
	base?: CustomBase;
}

const draftOfFeature = (feature: AiActionView): FeatureDraft => ({
	feature,
	spec: editableOf(feature),
	...(feature.custom ? { base: feature.custom } : {}),
});

/** Two drafts read the same when the edited values and the action's version are the same. A different version means the server's copy moved on. */
const sameFeatureDraft = (a: FeatureDraft | null, b: FeatureDraft | null) =>
	a === b ||
	(a !== null &&
		b !== null &&
		a.feature.key === b.feature.key &&
		a.feature.version === b.feature.version &&
		JSON.stringify({ spec: a.spec, base: a.base }) === JSON.stringify({ spec: b.spec, base: b.base }));

/** Sample input for the test (input name -> value) and the extra request. Fields are built from the action's input types (`ai-test-sample`). */
type Sample = { values: Record<string, string>; request: string };
const EMPTY_SAMPLE: Sample = { values: {}, request: "" };

/** The open action as the screen uses it: the draft and whether it is new. */
type Editing = FeatureDraft & { isNew: boolean };

type AiTab = "features" | "connections" | "snippets";

/**
 * Admin AI screen. The Actions tab lists actions defined in code and actions created in the screen; for each action you edit enabled, ask-for-request,
 * connection, model, content to send, instructions and checks, then test before saving. The Connections tab stores several service URLs, keys and default models.
 * The Prompt snippets tab edits and adds the text that goes into `{{snippet.key}}` in instructions. All three tabs are a list + a detail pane.
 * Opening another item or tab with unsaved content asks whether to discard it.
 */
export function AiManager() {
	const site = useSite();
	const t = useTranslator(aiManagerMessages);
	const tc = useTranslator(commonMessages);
	const placeLabel = usePlaceLabel();
	const queryClient = useQueryClient();
	// The layout's AI slot provider asks for the same list, so it can be in the cache before this page hydrates.
	const featuresQuery = useHydratedQuery(useAiActions());
	const _settingsQuery = useAiSettings();
	const _snippetsQuery = useAiSnippets();
	const features = featuresQuery.data?.items ?? [];
	const usable = new Set(featuresQuery.data?.usable ?? []);
	const [tab, setTab] = useState<AiTab>("features");
	/** The action opened for editing, as it was at open time. If `isNew`, it is a new screen action not yet saved (saving creates it). */
	const [opened, setOpened] = useState<{ saved: FeatureDraft; isNew: boolean } | null>(null);
	const [formError, setFormError] = useState<string | null>(null);
	/** The open connection. The header's Add connection changes it, so it lives outside the Connections tab. */
	const [connection, setConnection] = useState<string | "new" | null>(null);
	const [connectionDirty, setConnectionDirty] = useState(false);
	/** The open prompt snippet. The header's Add snippet changes it, so it lives outside the Prompt snippets tab. */
	const [snippet, setSnippet] = useState<string | "new" | null>(null);
	const [snippetDirty, setSnippetDirty] = useState(false);
	const { confirm, confirmDiscard, dialog } = useConfirm();
	const [collapsedGroups, setCollapsedGroups] = useState<Set<FeatureGroup>>(new Set());
	const toggleGroup = useCallback((group: FeatureGroup) => {
		setCollapsedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(group)) next.delete(group);
			else next.add(group);
			return next;
		});
	}, []);

	const replaceInCache = (feature: AiActionView) =>
		queryClient.setQueryData<AiActionsResponse>(aiKeys.actions(), (data) =>
			data ? { ...data, items: data.items.map((item) => (item.key === feature.key ? feature : item)) } : data,
		);

	const removeMutation = useCmsMutation({
		fn: (feature: AiActionView, { site }) => deleteAiAction(site, feature.key, feature.version, tc("deleteFailed")),
		success: tc("deleted"),
		failure: tc("deleteFailed"),
		inline: true,
		onSuccess: (_result, feature) => {
			queryClient.setQueryData<AiActionsResponse>(aiKeys.actions(), (data) =>
				data ? { ...data, items: data.items.filter((item) => item.key !== feature.key) } : data,
			);
			setOpened(null);
		},
		onError: (error) => setFormError(errorText(site, error, tc("deleteFailed"))),
	});

	const saveMutation = useCmsMutation({
		fn: (current: Editing, { site }) => {
			const label = (current.base ? current.base.label : (current.spec.label ?? current.feature.label)).trim();
			const spec = { ...current.spec, label };
			return current.isNew && current.base
				? createAiAction(site, { base: { ...current.base, label }, value: spec }, tc("saveFailed"))
				: updateAiAction(
						site,
						current.feature.key,
						{
							expectedVersion: current.feature.version,
							value: spec,
							...(current.base ? { base: { ...current.base, label } } : {}),
						},
						tc("saveFailed"),
					);
		},
		success: tc("saved"),
		failure: tc("saveFailed"),
		inline: true,
		invalidate: [aiKeys.actions()],
		onSuccess: (saved, current) => {
			if (current.isNew && current.base) {
				queryClient.setQueryData<AiActionsResponse>(aiKeys.actions(), (data) =>
					data ? { ...data, items: [...data.items, saved] } : data,
				);
			} else replaceInCache(saved);
			open(saved);
		},
		onError: (error) => setFormError(errorText(site, error, tc("saveFailed"))),
	});
	const saving = saveMutation.isPending;
	const deleting = removeMutation.isPending;

	const [showHidden, setShowHidden] = useState(false);

	const quickPatchMutation = useCmsMutation<{ feature: AiActionView; patch: Record<string, unknown> }, AiActionView>({
		fn: ({ feature, patch }, { site }) =>
			updateAiAction(
				site,
				feature.key,
				{
					expectedVersion: feature.version,
					value: patch,
				},
				tc("saveFailed"),
			),
		failure: tc("saveFailed"),
		inline: true,
		invalidate: [aiKeys.actions()],
		onSuccess: (saved) => {
			replaceInCache(saved);
			if (editing && !editing.isNew && editing.feature.key === saved.key) {
				setOpened({ saved: draftOfFeature(saved), isNew: false });
			}
		},
		onError: (error) => setFormError(errorText(site, error, tc("saveFailed"))),
	});

	const handleToggle = (feature: AiActionView, enabled: boolean) => {
		if (editing && !editing.isNew && editing.feature.key === feature.key) {
			changeDraft((draft) => ({ ...draft, spec: { ...draft.spec, enabled } }));
		}
		queryClient.setQueryData<AiActionsResponse>(aiKeys.actions(), (data) =>
			data
				? {
						...data,
						items: data.items.map((item) => (item.key === feature.key ? { ...item, enabled } : item)),
					}
				: data,
		);
		quickPatchMutation.mutate({ feature, patch: { enabled } });
	};

	const restoreAllHidden = async () => {
		const hiddenFeatures = features.filter((f) => f.hidden);
		for (const f of hiddenFeatures) {
			await updateAiAction(site, f.key, {
				expectedVersion: f.version,
				value: { hidden: false },
			});
		}
		void queryClient.invalidateQueries({ queryKey: aiKeys.actions() });
	};

	// The draft follows what was opened; a closed editor holds no draft.
	const editor = useDraftEditor<FeatureDraft | null>({
		saved: opened && !opened.isNew ? opened.saved : null,
		empty: opened?.isNew ? opened.saved : null,
		equals: sameFeatureDraft,
		saving,
		deleting,
	});
	// Until the draft catches up with a newly opened action, show the action as opened.
	const shown = opened ? (editor.draft ?? opened.saved) : null;
	const editing: Editing | null = opened && shown ? { ...shown, isNew: opened.isNew } : null;
	const featureDirty = opened !== null && editor.dirty;
	// A link that leaves the screen (the sidebar) asks first while any open editor has changes.
	const { dialog: guardDialog } = useUnsavedGuard(featureDirty || connectionDirty || snippetDirty);
	const changeDraft = (change: (draft: FeatureDraft) => FeatureDraft) =>
		editor.update((draft) => change(draft ?? (opened as { saved: FeatureDraft }).saved));

	/** Opens without asking (e.g. after saving). */
	const open = (feature: AiActionView) => {
		setOpened({ saved: draftOfFeature(feature), isNew: false });
		setFormError(null);
	};

	/** Opens from the list. If there is unsaved content, asks first. */
	const openFeature = async (feature: AiActionView) => {
		if (editing && !editing.isNew && editing.feature.key === feature.key) return;
		if (await confirmDiscard(featureDirty)) open(feature);
	};

	/** Opens a new screen action on the right. Saving after editing basic info, connection, instructions, etc. creates it. */
	const startNew = async () => {
		if (!(await confirmDiscard(featureDirty))) return;
		const base = NEW_CUSTOM_BASE(site);
		const feature = draftCustomView(site, base);
		setOpened({ saved: { feature, spec: editableOf(feature), base }, isNew: true });
		setFormError(null);
	};

	const openConnection = async (id: string | "new") => {
		if (id === connection) return;
		if (await confirmDiscard(connectionDirty)) setConnection(id);
	};

	const openSnippet = async (key: string | "new") => {
		if (key === snippet) return;
		if (await confirmDiscard(snippetDirty)) setSnippet(key);
	};

	/** Switches tabs. Closing the Connections or Prompt snippets tab discards the input, so it asks if there is unsaved content. */
	const changeTab = async (next: AiTab) => {
		const dirty = (tab === "connections" && connectionDirty) || (tab === "snippets" && snippetDirty);
		if (await confirmDiscard(dirty)) setTab(next);
	};

	/**
	 * Changes the basic info of a screen action. Changing the attach target, result shape or mode changes the inputs and checks, so the screen shape is rebuilt,
	 * while the edited enabled, ask-for-request, insert-directly and instructions are kept (connection and model are also kept if the mode is unchanged).
	 */
	const changeBase = (base: CustomBase) => {
		if (!editing) return;
		const { label: _before, ...restBefore } = editing.base ?? base;
		const { label: _after, ...restAfter } = base;
		if (JSON.stringify(restBefore) === JSON.stringify(restAfter)) {
			changeDraft((draft) => ({
				...draft,
				base,
				spec: { ...draft.spec, label: base.label },
			}));
			return;
		}
		const draft = draftCustomView(site, base);
		const feature: AiActionView = editing.isNew
			? draft
			: { ...draft, key: editing.feature.key, version: editing.feature.version, updatedAt: editing.feature.updatedAt };
		const sameEngine = feature.engine === editing.feature.engine;
		const { spec } = editing;
		changeDraft(() => ({
			base,
			feature,
			spec: {
				...editableOf(feature),
				label: base.label,
				enabled: spec.enabled,
				askInstruction: spec.askInstruction,
				instant: spec.instant,
				prompt: spec.prompt,
				...(sameEngine ? { providerId: spec.providerId, modelName: spec.modelName } : {}),
			},
		}));
	};

	const remove = async (feature: AiActionView) => {
		const ok = await confirm({
			title: t("remove.title"),
			description: t("remove.description", { label: feature.label }),
			confirmLabel: tc("delete"),
			destructive: true,
		});
		if (!ok) return;
		setFormError(null);
		removeMutation.mutate(feature);
	};

	const save = () => {
		if (!editing) return;
		const label = (editing.base ? editing.base.label : (editing.spec.label ?? editing.feature.label)).trim();
		if (!label) {
			setFormError(site.createTranslator(issueMessages)("field.missing", { label: t("field.name") }));
			return;
		}
		if (!editing.spec.prompt?.trim()) {
			setFormError(site.createTranslator(issueMessages)("field.missing", { label: t("field.prompt") }));
			return;
		}
		setFormError(null);
		const spec = { ...editing.spec, label };
		saveMutation.mutate({
			...editing,
			spec,
			...(editing.base ? { base: { ...editing.base, label } } : {}),
		});
	};

	const toggleHide = (feature: AiActionView, hidden: boolean) => {
		if (editing && !editing.isNew && editing.feature.key === feature.key) {
			const nextEditing: Editing = {
				...editing,
				spec: { ...editing.spec, hidden },
			};
			changeDraft((draft) => ({ ...draft, spec: { ...draft.spec, hidden } }));
			setFormError(null);
			saveMutation.mutate(nextEditing);
		} else {
			queryClient.setQueryData<AiActionsResponse>(aiKeys.actions(), (data) =>
				data
					? {
							...data,
							items: data.items.map((item) => (item.key === feature.key ? { ...item, hidden } : item)),
						}
					: data,
			);
			quickPatchMutation.mutate({ feature, patch: { hidden } });
		}
	};

	const onConnectionDirty = useCallback((dirty: boolean) => setConnectionDirty(dirty), []);
	const onSnippetDirty = useCallback((dirty: boolean) => setSnippetDirty(dirty), []);

	const headerActions =
		tab === "features" ? (
			<Button type="button" size="sm" onClick={() => void startNew()}>
				<Plus aria-hidden />
				{t("add.feature")}
			</Button>
		) : tab === "connections" ? (
			<Button type="button" size="sm" onClick={() => void openConnection("new")}>
				<Plus aria-hidden />
				{t("add.connection")}
			</Button>
		) : (
			<Button type="button" size="sm" onClick={() => void openSnippet("new")}>
				<Plus aria-hidden />
				{t("add.snippet")}
			</Button>
		);
	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
			<PageActions>{headerActions}</PageActions>
			<Tabs
				value={tab}
				onValueChange={(value) => void changeTab(value as AiTab)}
				className="flex min-h-0 flex-1 flex-col gap-0"
			>
				<PageTabs>
					<TabsTrigger value="features" className="flex-none px-0 text-xs">
						<Sparkles aria-hidden />
						{t("tab.features")}
					</TabsTrigger>
					<TabsTrigger value="connections" className="flex-none px-0 text-xs">
						<Plug aria-hidden />
						{t("tab.connections")}
					</TabsTrigger>
					<TabsTrigger value="snippets" className="flex-none px-0 text-xs">
						<Quote aria-hidden />
						{t("tab.snippets")}
					</TabsTrigger>
				</PageTabs>
				<TabsContent value="features" className="flex min-h-0 flex-1 flex-col">
					{featuresQuery.error && !featuresQuery.data && (
						<LoadErrorAlert
							className="m-3"
							message={errorText(site, featuresQuery.error, t("list.loadFailed"))}
							onRetry={() => void featuresQuery.refetch()}
						/>
					)}
					<MasterDetail
						list={
							<ListPane
								label={t("list.label")}
								loading={featuresQuery.isPending}
								skeletonRows={4}
								className="w-80 lg:w-88"
								header={
									featuresQuery.data && usable.size === 0 ? (
										<div className="flex items-center justify-between gap-2 border-b bg-monti-muted/40 p-2.5 text-xs">
											<span className="text-monti-muted-foreground">{t("banner.needsConnection")}</span>
											<Button type="button" size="xs" variant="outline" onClick={() => void changeTab("connections")}>
												{t("banner.goToConnections")}
											</Button>
										</div>
									) : null
								}
								empty={
									featuresQuery.data && features.length === 0 && !editing?.isNew ? (
										<EmptyState compact title={t("list.empty")} />
									) : null
								}
							>
								{GROUP_ORDER.flatMap((group) => {
									const groupFeatures = features.filter((f) => !f.hidden && groupOf(f) === group);
									if (groupFeatures.length === 0) return [];
									const isCollapsed = collapsedGroups.has(group);
									return [
										<li
											key={`group-${group}`}
											className="sticky top-0 z-10 border-monti-border border-y bg-monti-muted/80 backdrop-blur"
										>
											<button
												type="button"
												onClick={() => toggleGroup(group)}
												className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left transition-colors hover:bg-monti-muted"
											>
												<ChevronDown
													className={cn(
														"size-3.5 text-monti-muted-foreground transition-transform duration-150",
														isCollapsed && "-rotate-90",
													)}
												/>
												<span className="font-semibold text-monti-foreground text-xs">{t(`group.${group}`)}</span>
											</button>
										</li>,
										...(isCollapsed
											? []
											: groupFeatures.map((feature) => (
													<ListRow
														key={feature.key}
														title={feature.label}
														detail={`${placeLabel(feature)}${feature.custom ? ` · ${t("detail.custom")}` : ""}`}
														current={editing !== null && !editing.isNew && editing.feature.key === feature.key}
														onClick={() => void openFeature(feature)}
														trailing={
															<Switch
																size="sm"
																checked={feature.enabled}
																aria-label={t("toggle.enableAction", { label: feature.label })}
																onClick={(e) => e.stopPropagation()}
																onCheckedChange={(checked) => handleToggle(feature, checked)}
															/>
														}
													/>
												))),
									];
								})}
								{showHidden &&
									features
										.filter((feature) => feature.hidden)
										.map((feature) => (
											<ListRow
												key={feature.key}
												title={feature.label}
												status={t("status.hidden")}
												detail={`${placeLabel(feature)}${feature.custom ? ` · ${t("detail.custom")}` : ""}`}
												current={editing !== null && !editing.isNew && editing.feature.key === feature.key}
												onClick={() => void openFeature(feature)}
												trailing={
													<Switch
														size="sm"
														checked={feature.enabled}
														aria-label={t("toggle.enableAction", { label: feature.label })}
														onClick={(e) => e.stopPropagation()}
														onCheckedChange={(checked) => handleToggle(feature, checked)}
													/>
												}
											/>
										))}
								{editing?.isNew && (
									<ListRow
										key="new"
										title={editing.base?.label.trim() || t("title.new")}
										status={t("status.unsaved")}
										detail={placeLabel(editing.feature)}
										current
										onClick={() => {}}
									/>
								)}
								{features.some((feature) => feature.hidden) && (
									<li key="hidden-toggle" className="flex items-center justify-between border-t p-2">
										<Button
											type="button"
											size="xs"
											variant="ghost"
											className="text-monti-muted-foreground hover:text-monti-foreground"
											onClick={() => setShowHidden(!showHidden)}
										>
											{showHidden
												? t("list.hideHidden", {
														count: features.filter((feature) => feature.hidden).length,
													})
												: t("list.showHidden", {
														count: features.filter((feature) => feature.hidden).length,
													})}
										</Button>
										{showHidden && (
											<Button type="button" size="xs" variant="outline" onClick={() => void restoreAllHidden()}>
												<RotateCcw aria-hidden />
												{t("button.restoreHidden")}
											</Button>
										)}
									</li>
								)}
							</ListPane>
						}
					>
						{editing ? (
							<FeatureEditor
								key={editing.isNew ? "new" : editing.feature.key}
								feature={editing.feature}
								spec={editing.spec}
								saving={saving}
								deleting={deleting}
								dirty={featureDirty}
								error={formError}
								onChange={(spec) => changeDraft((draft) => ({ ...draft, spec }))}
								onSave={() => void save()}
								onToggleHide={(hidden) => toggleHide(editing.feature, hidden)}
								custom={
									editing.base
										? {
												base: editing.base,
												onBaseChange: changeBase,
												isNew: editing.isNew === true,
												onCancel: () => setOpened(null),
												onDelete: () => void remove(editing.feature),
											}
										: undefined
								}
							/>
						) : (
							featuresQuery.data && (
								<EmptyState
									icon={Sparkles}
									title={t("empty.pick")}
									action={{ label: t("add.feature"), onClick: () => void startNew(), icon: Plus }}
								/>
							)
						)}
					</MasterDetail>
				</TabsContent>
				<TabsContent value="snippets" className="flex min-h-0 flex-1 flex-col">
					<SnippetManager
						selected={snippet}
						onOpen={(key) => void openSnippet(key)}
						onSelectedChange={setSnippet}
						onDirtyChange={onSnippetDirty}
					/>
				</TabsContent>
				<TabsContent value="connections" className="flex min-h-0 flex-1 flex-col">
					<ConnectionManager
						selected={connection}
						onOpen={(id) => void openConnection(id)}
						onSelectedChange={setConnection}
						onDirtyChange={onConnectionDirty}
					/>
				</TabsContent>
			</Tabs>
			{dialog}
			{guardDialog}
		</div>
	);
}

/** Chip input for the allowed values check. Users can add tags by typing and pressing Enter or comma, and remove tags with backspace or clicking x. */
function OneOfInput({
	items,
	disabled,
	onChange,
}: {
	items: readonly string[];
	disabled: boolean;
	onChange: (items: string[]) => void;
}) {
	const t = useTranslator(aiManagerMessages);
	const [input, setInput] = useState("");

	const addItem = (value: string) => {
		const trimmed = value.trim();
		if (trimmed && !items.includes(trimmed)) {
			onChange([...items, trimmed]);
			setInput("");
		}
	};

	const removeItem = (index: number) => {
		onChange(items.filter((_, i) => i !== index));
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (isComposingKey(event)) return;
		if (event.key === "Enter" || event.key === ",") {
			event.preventDefault();
			addItem(input);
		} else if (event.key === "Backspace" && !input && items.length > 0) {
			removeItem(items.length - 1);
		}
	};

	return (
		<div
			className={cn(
				"flex min-h-8 max-w-md flex-1 flex-wrap items-center gap-1.5 rounded-md border border-monti-input bg-monti-background p-1 text-xs shadow-sm transition-colors focus-within:ring-1 focus-within:ring-monti-ring",
				disabled && "cursor-not-allowed opacity-50",
			)}
		>
			{items.map((item, index) => (
				<span
					key={item}
					className="inline-flex items-center gap-1 rounded bg-monti-muted px-2 py-0.5 font-mono text-monti-foreground text-xs"
				>
					<span className="max-w-40 truncate">{item}</span>
					{!disabled && (
						<button
							type="button"
							aria-label={t("check.oneOfRemove", { item })}
							onClick={() => removeItem(index)}
							className="rounded-sm opacity-70 hover:opacity-100 focus:outline-none"
						>
							<X className="size-3" aria-hidden />
						</button>
					)}
				</span>
			))}
			{!disabled && (
				<input
					type="text"
					value={input}
					placeholder={items.length === 0 ? t("check.oneOfPlaceholder") : ""}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					onBlur={() => {
						if (input.trim()) addItem(input);
					}}
					className="h-6 min-w-28 flex-1 border-0 bg-transparent px-1 font-mono text-xs shadow-none outline-none placeholder:text-monti-muted-foreground/60 focus:ring-0"
				/>
			)}
		</div>
	);
}

/** One check row. Toggle it on/off; edit a regex for format, a character count for length, or a value list for one-of. Added checks can be deleted. */
function CheckRow({
	check,
	label,
	onChange,
	onRemove,
}: {
	check: AiCheck;
	label: string;
	onChange: (check: AiCheck) => void;
	onRemove?: () => void;
}) {
	const t = useTranslator(aiManagerMessages);
	const id = useId();
	const multiline = check.kind === "oneOf" && check.items.length > 2;
	return (
		<li className={cn("flex min-h-8 gap-2.5", multiline ? "items-start pt-1" : "items-center")}>
			<Switch
				id={id}
				size="sm"
				checked={check.enabled}
				onCheckedChange={(enabled) => onChange({ ...check, enabled })}
				className={cn(multiline && "mt-1")}
			/>
			<Label htmlFor={id} className={cn("w-28 shrink-0 font-normal text-xs", multiline && "pt-1.5")}>
				{label}
			</Label>
			<div className="flex min-w-0 max-w-md flex-1 items-center gap-2">
				{check.kind === "pattern" && (
					<Input
						aria-label={t("check.pattern")}
						value={check.pattern}
						disabled={!check.enabled}
						onChange={(event) => onChange({ ...check, pattern: event.target.value })}
						className="h-8 min-w-0 flex-1 font-mono text-xs"
					/>
				)}
				{check.kind === "maxLength" && (
					<span className="flex items-center gap-2">
						<Input
							type="number"
							aria-label={t("check.maxChars")}
							min={1}
							max={5000}
							value={check.max}
							disabled={!check.enabled}
							onChange={(event) =>
								onChange({ ...check, max: Math.min(5000, Math.max(1, Number(event.target.value) || 1)) })
							}
							className="h-8 w-20 text-xs"
						/>
						<span className="text-monti-muted-foreground text-xs">{t("check.charsOrLess")}</span>
					</span>
				)}
				{check.kind === "oneOf" && (
					<OneOfInput
						items={check.items}
						disabled={!check.enabled}
						onChange={(items) => onChange({ ...check, items })}
					/>
				)}
			</div>
			{onRemove ? (
				<IconButton
					label={t("check.remove", { label })}
					size="icon-xs"
					destructive
					onClick={onRemove}
					className={cn(multiline && "mt-1")}
				>
					<Trash2 aria-hidden />
				</IconButton>
			) : (
				<div className="w-6 shrink-0" aria-hidden />
			)}
		</li>
	);
}

function FeatureEditor({
	feature,
	spec,
	saving,
	deleting,
	dirty,
	error,
	onChange,
	onSave,
	onToggleHide,
	custom,
}: {
	feature: AiActionView;
	spec: Editable;
	saving: boolean;
	deleting: boolean;
	dirty: boolean;
	error: string | null;
	onChange: (spec: Editable) => void;
	onSave: () => void;
	onToggleHide?: (hidden: boolean) => void;
	/** For a screen action: edit basic info and delete. For a new action (`isNew`), cancel instead of delete. */
	custom?: {
		base: CustomBase;
		onBaseChange: (base: CustomBase) => void;
		onCancel: () => void;
		onDelete: () => void;
		isNew: boolean;
	};
}) {
	const site = useSite();
	const t = useTranslator(aiManagerMessages);
	const { checkLabel, engineLabel } = useLabels();
	const placeLabel = usePlaceLabel();
	const ids = {
		name: useId(),
		provider: useId(),
		prompt: useId(),
		threshold: useId(),
		sendTitle: useId(),
		checksTitle: useId(),
	};
	const deciding = feature.engine === "decide";
	const settings = useAiSettings().data;
	const kind = deciding ? "decisions" : "chat";
	const providers = (settings?.providers ?? []).filter((provider) => provider.kind === kind);
	const chosen = spec.providerId
		? providers.find((provider) => provider.id === spec.providerId)
		: providers.find((provider) => provider.ready);
	const canRun =
		Boolean(settings?.fake) || Boolean(chosen?.url && chosen.key?.readable && (spec.modelName || chosen.defaultModel));
	// Model list of the selected generation connection. A list that was fetched once is remembered and not fetched again.
	const modelList = useModelList(!deciding && chosen?.key?.readable ? { providerId: chosen.id } : null);
	const [sample, setSample] = useState<Sample>(EMPTY_SAMPLE);
	const [test, setTest] = useState<
		{ status: "running" } | { status: "done"; result: AiRunResult } | { status: "error"; message: string } | null
	>(null);
	const set = (patch: Partial<Editable>) => onChange({ ...spec, ...patch });
	// Defaults of a code action. Reset to default only reverts the input fields (enabled stays as is); saving is a separate click.
	const defaults = custom ? null : feature.defaults;
	const atDefaults =
		defaults !== null &&
		JSON.stringify({ ...defaults, enabled: spec.enabled, hidden: spec.hidden }) === JSON.stringify(spec);
	// Checks that can be added: those among format, length and one-of that are not present yet. An MDX result (body fragment) gets no character checks.
	const addableChecks = (Object.keys(ADDABLE_CHECKS) as AddableCheckKind[]).filter(
		(kind) =>
			feature.result !== "mdx" && feature.result !== "note" && !spec.checks.some((check) => check.kind === kind),
	);
	const uses = (input: string) => spec.send.includes(input);
	const inputs = Object.entries(feature.input).filter(
		([, input]) => input.kind !== "locale" && !(deciding && input.kind === "image"),
	);
	const providerOptions = [
		{ value: "", label: t("connection.first", { engine: engineLabel(feature.engine) }) },
		...(spec.providerId && !providers.some((provider) => provider.id === spec.providerId)
			? [{ value: spec.providerId, label: t("connection.deleted") }]
			: []),
		...providers.map((provider) => ({ value: provider.id, label: provider.name })),
	];

	const sampleInputs = sampleFields(feature, spec.send);
	const sampleStart = sampleDefaults(site, feature);
	const testRunning = test?.status === "running";
	const testDisabled = !canRun || testRunning || missingRequired(sampleInputs, sample.values, sampleStart);
	const runTest = async () => {
		if (testDisabled) return;
		setTest({ status: "running" });
		try {
			// A screen action is tested with the basic info being edited (including a new action not yet saved).
			const options = {
				draft: spec,
				request: spec.askInstruction ? sample.request : undefined,
				...(custom ? { draftBase: { ...custom.base, label: custom.base.label.trim() || t("title.new") } } : {}),
			};
			const { input, env } = sampleRun(feature, sampleInputs, sample.values, sampleStart);
			setTest({ status: "done", result: await runAiAction(site, feature.key, input, { ...options, env }) });
		} catch (runError) {
			setTest({ status: "error", message: errorText(site, runError, t("test.failed")) });
		}
	};

	return (
		<div className={DETAIL_PANE_FRAME}>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<div className="min-w-0 flex-1">
					<h2 className="truncate font-medium text-base">
						{(custom ? custom.base.label.trim() : spec.label?.trim() || feature.label) || t("title.new")}
					</h2>
					<p className="truncate text-monti-muted-foreground text-xs">{placeLabel(feature)}</p>
				</div>
				<Label className="font-normal text-xs">
					<Switch size="sm" checked={spec.enabled} onCheckedChange={(enabled) => set({ enabled })} />
					{t("toggle.on")}
				</Label>
				<Label className="font-normal text-xs">
					<Switch
						size="sm"
						checked={spec.askInstruction}
						onCheckedChange={(askInstruction) => set({ askInstruction })}
					/>
					{t("toggle.ask")}
				</Label>
				{feature.apply !== "none" && (feature.result === "candidates" || feature.result === "text") && (
					<Label className="font-normal text-xs">
						<Switch size="sm" checked={spec.instant} onCheckedChange={(instant) => set({ instant })} />
						{t("toggle.instant")}
					</Label>
				)}
			</div>

			{custom ? (
				<section aria-label={t("section.basics")} className="rounded-md border p-3">
					<CustomBaseFields base={custom.base} onChange={custom.onBaseChange} />
				</section>
			) : (
				<section aria-label={t("section.basics")} className="rounded-md border p-3">
					<FormField>
						<FormFieldLabel htmlFor={ids.name}>{t("field.name")}</FormFieldLabel>
						<Input
							id={ids.name}
							value={spec.label ?? feature.label}
							maxLength={60}
							placeholder={feature.defaults?.label ?? feature.label}
							onChange={(event) => set({ label: event.target.value })}
							className="h-8 text-xs md:text-xs"
						/>
					</FormField>
				</section>
			)}

			<FormFieldGroup className="gap-5">
				<FormField>
					<FormFieldLabel htmlFor={ids.provider}>{t("field.connection")}</FormFieldLabel>
					<div className="flex min-w-0 items-center gap-2">
						<OptionSelect
							id={ids.provider}
							value={spec.providerId ?? ""}
							options={providerOptions}
							onChange={(value) => set({ providerId: value || null, modelName: "" })}
						/>
						<ModelCombobox
							aria-label={t("field.model")}
							value={spec.modelName}
							models={modelList.models}
							loading={modelList.loading}
							error={modelList.error}
							placeholder={chosen?.defaultModel || t("field.defaultModel")}
							onChange={(modelName) => set({ modelName })}
						/>
					</div>
				</FormField>

				{inputs.length > 0 && (
					<FormField role="group" aria-labelledby={ids.sendTitle}>
						<FormFieldTitle id={ids.sendTitle}>{t("field.send")}</FormFieldTitle>
						<div className="flex flex-wrap gap-3">
							{inputs.map(([name, input]) => (
								<Label key={name} className="font-normal text-xs">
									<Checkbox
										checked={uses(name) || input.required}
										disabled={input.required}
										onCheckedChange={(checked) =>
											set({
												send: checked === true ? [...spec.send, name] : spec.send.filter((item) => item !== name),
											})
										}
									/>
									{input.label}
								</Label>
							))}
						</div>
					</FormField>
				)}

				{deciding && (
					<FormField>
						<FormFieldLabel htmlFor={ids.threshold}>{t("field.threshold")}</FormFieldLabel>
						<div className="flex items-center gap-2 text-xs">
							<Input
								id={ids.threshold}
								type="number"
								min={1}
								max={99}
								value={Math.round(spec.threshold * 100)}
								onChange={(event) =>
									set({ threshold: Math.min(99, Math.max(1, Number(event.target.value) || 1)) / 100 })
								}
								className="h-8 w-20 text-xs md:text-xs"
							/>
							<span className="text-monti-muted-foreground">{t("field.percentOrMore")}</span>
							<Input
								type="number"
								aria-label={t("field.maxCount")}
								min={1}
								max={20}
								value={spec.maxCount}
								onChange={(event) => set({ maxCount: Math.min(20, Math.max(1, Number(event.target.value) || 1)) })}
								className="ml-3 h-8 w-16 text-xs md:text-xs"
							/>
							<span className="text-monti-muted-foreground">{t("field.countUpTo")}</span>
						</div>
					</FormField>
				)}

				<FormField role="group" aria-labelledby={ids.checksTitle}>
					<FormFieldTitle id={ids.checksTitle}>{t("field.checks")}</FormFieldTitle>
					<div className="flex flex-col gap-1.5 text-xs">
						<ul className="flex flex-col gap-1.5" aria-label={t("field.checks")}>
							{spec.checks.map((check, index) => (
								<CheckRow
									key={checkKey(check)}
									check={check}
									label={
										check.kind === "code" ? (feature.validatorLabels[check.name] ?? check.name) : checkLabel(check.kind)
									}
									onChange={(next) => set({ checks: spec.checks.map((item, i) => (i === index ? next : item)) })}
									onRemove={
										feature.definedChecks.includes(checkKey(check))
											? undefined
											: () => set({ checks: spec.checks.filter((_, i) => i !== index) })
									}
								/>
							))}
						</ul>
						{addableChecks.length > 0 && (
							<DropdownMenu>
								<DropdownMenuTrigger
									render={
										<Button
											type="button"
											size="xs"
											variant="ghost"
											className="self-start text-monti-muted-foreground"
										/>
									}
								>
									<Plus aria-hidden />
									{t("field.addCheck")}
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start" className="min-w-32">
									{addableChecks.map((kind) => (
										<DropdownMenuItem
											key={kind}
											onClick={() => set({ checks: [...spec.checks, ADDABLE_CHECKS[kind]] })}
										>
											<Plus aria-hidden />
											{checkLabel(kind)}
										</DropdownMenuItem>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
				</FormField>

				<FormField>
					<FormFieldLabel htmlFor={ids.prompt}>{deciding ? t("field.criteria") : t("field.prompt")}</FormFieldLabel>
					<Textarea
						id={ids.prompt}
						rows={PROMPT_ROWS}
						value={spec.prompt}
						onChange={(event) => set({ prompt: event.target.value })}
						className={PROMPT_TEXTAREA}
					/>
				</FormField>
			</FormFieldGroup>

			<EditorFooter
				dirty={dirty}
				saving={saving}
				deleting={deleting}
				canSave={!(custom?.isNew === true && !custom.base.label.trim())}
				error={error}
				saveIcon={<Save aria-hidden />}
				onSave={onSave}
				onCancel={custom?.isNew ? custom.onCancel : undefined}
				onDelete={custom && !custom.isNew ? custom.onDelete : undefined}
			>
				{!custom && (
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={saving}
						onClick={() => (onToggleHide ? onToggleHide(!spec.hidden) : set({ hidden: !spec.hidden }))}
					>
						{spec.hidden ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
						{spec.hidden ? t("button.unhide") : t("button.hide")}
					</Button>
				)}
				{defaults && (
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={atDefaults}
						onClick={() => onChange({ ...defaults, enabled: spec.enabled, hidden: false })}
					>
						<RotateCcw aria-hidden />
						{t("button.reset")}
					</Button>
				)}
				{!custom?.isNew && (
					<span className="flex-1 text-right text-monti-muted-foreground text-xs">
						{feature.updatedAt
							? t("meta.edited", {
									time: new Date(feature.updatedAt).toLocaleString(site.ADMIN_LOCALE, { timeZone: site.CMS_TIME_ZONE }),
								})
							: t("meta.default")}
					</span>
				)}
			</EditorFooter>

			<section
				className="flex flex-col gap-2 rounded-md border bg-monti-muted/30 p-3 text-xs"
				aria-label={t("test.title")}
			>
				<div className="flex items-center gap-2">
					<span className="font-medium">{t("test.title")}</span>
					<Button
						type="button"
						size="xs"
						variant="outline"
						className="ml-auto"
						disabled={testDisabled}
						onClick={() => void runTest()}
					>
						<Sparkles aria-hidden />
						{testRunning ? t("test.running") : t("test.run")}
					</Button>
				</div>
				{spec.askInstruction && (
					<Textarea
						aria-label={t("test.request")}
						placeholder={t("test.request")}
						rows={2}
						value={sample.request}
						onChange={(event) => setSample({ ...sample, request: event.target.value })}
						onKeyDown={(event) => {
							// Enter inserts a newline; Cmd/Ctrl+Enter runs.
							if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !isComposingKey(event)) {
								event.preventDefault();
								void runTest();
							}
						}}
						className="min-h-14 resize-y bg-monti-background text-xs md:text-xs"
					/>
				)}
				<SampleInputs
					fields={sampleInputs}
					values={sample.values}
					defaults={sampleStart}
					onChange={(name, value) => setSample({ ...sample, values: { ...sample.values, [name]: value } })}
				/>
				{test?.status === "error" && <FormFieldError>{test.message}</FormFieldError>}
				{test?.status === "done" &&
					(test.result.kind === "candidates" ? (
						test.result.items.length === 0 ? (
							<p className="text-monti-muted-foreground">{t("test.noResults")}</p>
						) : (
							<ul className="flex flex-wrap gap-1">
								{test.result.items.map((item) => (
									<li key={item.value} className={SLOT_CHIP}>
										<span className="truncate">{item.label}</span>
										{item.detail && <span className="shrink-0 text-monti-muted-foreground">{item.detail}</span>}
									</li>
								))}
							</ul>
						)
					) : (
						<p className="whitespace-pre-wrap rounded border bg-monti-background p-2">{test.result.text}</p>
					))}
			</section>
		</div>
	);
}
