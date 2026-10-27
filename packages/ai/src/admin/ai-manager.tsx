"use client";

import { errorText, issueMessages, useCmsMutation, useSite, useTranslator } from "@monti-cms/admin";
import {
	Badge,
	Banner,
	Box,
	Button,
	booleanCodec,
	Checkbox,
	CodeBlock,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	commonMessages,
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
	Heading,
	IconButton,
	Inline,
	Input,
	isComposingKey,
	Label,
	ListPane,
	ListRow,
	LoadErrorAlert,
	MasterDetail,
	PageActions,
	Spark,
	Stack,
	Switch,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	TagInput,
	Text,
	Textarea,
	TextButton,
	useConfirm,
	useDraftEditor,
	useHydratedQuery,
	usePreference,
	useUnsavedGuard,
} from "@monti-cms/admin/kit";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Eye, EyeOff, Plug, Plus, Quote, RotateCcw, Save, Trash2 } from "lucide-react";
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
import { PROMPT_ROWS, SnippetManager, useAiSnippets } from "./snippet-editor";

/** Visible name of the attach target, read as where the action shows up ("Shows in: Selected text menu"). For a field, it is the name in the collection definition. */
function usePlaceLabel() {
	const site = useSite();
	const t = useTranslator(aiManagerMessages);
	const { slotLabel, slotTargetLabel } = useLabels();
	const where = (action: Pick<AiActionView, "attach">): string => {
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
	// An action with no place is called directly, so it shows nowhere to name.
	return (action: Pick<AiActionView, "attach">): string =>
		action.attach[0] ? t("place.label", { place: where(action) }) : where(action);
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

/** The values that live under Advanced: what is sent, the instructions and the checks. An action counts as modified when any of them differs from the definition. */
const advancedEdited = (
	action: Pick<AiActionView, "prompt" | "send" | "checks">,
	defaults: Pick<AiActionView, "prompt" | "send" | "checks"> | null,
): boolean =>
	defaults !== null &&
	JSON.stringify({ prompt: action.prompt, send: action.send, checks: action.checks }) !==
		JSON.stringify({ prompt: defaults.prompt, send: defaults.send, checks: defaults.checks });

/** The small muted chip that marks an action whose advanced values were edited. */
function ModifiedChip({ label }: { label: string }) {
	return <Badge variant="secondary">{label}</Badge>;
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
	/** Without a usable connection no feature runs, so the switches show as off and cannot be turned on. */
	const connected = usable.size > 0;
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
		<Stack gap={0} grow minHeight={0} overflow="hidden">
			<PageActions>{headerActions}</PageActions>
			<Tabs fill value={tab} onValueChange={(value) => void changeTab(value as AiTab)}>
				<TabsList variant="bar">
					<TabsTrigger value="features">
						<Spark aria-hidden />
						{t("tab.features")}
					</TabsTrigger>
					<TabsTrigger value="connections">
						<Plug aria-hidden />
						{t("tab.connections")}
					</TabsTrigger>
					<TabsTrigger value="snippets">
						<Quote aria-hidden />
						{t("tab.snippets")}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="features" fill>
					{featuresQuery.data && usable.size === 0 && (
						// A banner across the page under the tabs, flush with the list below, so it reads as the state of this tab.
						<Banner title={t("banner.needsConnection")}>
							<TextButton variant="underline" onClick={() => void changeTab("connections")}>
								{t("banner.goToConnections")}
							</TextButton>
						</Banner>
					)}
					{featuresQuery.error && !featuresQuery.data && (
						<Box padding={12}>
							<LoadErrorAlert
								message={errorText(site, featuresQuery.error, t("list.loadFailed"))}
								onRetry={() => void featuresQuery.refetch()}
							/>
						</Box>
					)}
					<MasterDetail
						list={
							<ListPane
								resizeKey="ai-features"
								label={t("list.label")}
								loading={featuresQuery.isPending}
								skeletonRows={4}
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
										<Box key={`group-${group}`} as="li" position="sticky" border="y" background="muted">
											<Button
												type="button"
												variant="secondary"
												size="sm"
												width="full"
												onClick={() => toggleGroup(group)}
											>
												<Inline gap={8} width="full">
													{isCollapsed ? <ChevronRight aria-hidden /> : <ChevronDown aria-hidden />}
													<Text variant="caption" weight="semibold">
														{t(`group.${group}`)}
													</Text>
												</Inline>
											</Button>
										</Box>,
										...(isCollapsed
											? []
											: groupFeatures.map((feature) => (
													<ListRow
														key={feature.key}
														title={feature.label}
														status={
															advancedEdited(feature, feature.defaults) ? (
																<ModifiedChip label={t("status.modified")} />
															) : null
														}
														detail={`${placeLabel(feature)}${feature.custom ? ` · ${t("detail.custom")}` : ""}`}
														current={editing !== null && !editing.isNew && editing.feature.key === feature.key}
														onClick={() => void openFeature(feature)}
														trailing={
															<Switch
																checked={feature.enabled && connected}
																disabled={!connected}
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
												status={
													<>
														{t("status.hidden")}
														{advancedEdited(feature, feature.defaults) && <ModifiedChip label={t("status.modified")} />}
													</>
												}
												detail={`${placeLabel(feature)}${feature.custom ? ` · ${t("detail.custom")}` : ""}`}
												current={editing !== null && !editing.isNew && editing.feature.key === feature.key}
												onClick={() => void openFeature(feature)}
												trailing={
													<Switch
														checked={feature.enabled && connected}
														disabled={!connected}
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
									<Inline as="li" key="hidden-toggle" gap={8} justify="between" border="top" padding={8}>
										<TextButton type="button" variant="quiet" onClick={() => setShowHidden(!showHidden)}>
											{showHidden
												? t("list.hideHidden", {
														count: features.filter((feature) => feature.hidden).length,
													})
												: t("list.showHidden", {
														count: features.filter((feature) => feature.hidden).length,
													})}
										</TextButton>
										{showHidden && (
											<Button type="button" size="sm" variant="secondary" onClick={() => void restoreAllHidden()}>
												<RotateCcw aria-hidden />
												{t("button.restoreHidden")}
											</Button>
										)}
									</Inline>
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
									title={t("empty.pick")}
									action={{ label: t("add.feature"), onClick: () => void startNew() }}
								/>
							)
						)}
					</MasterDetail>
				</TabsContent>
				<TabsContent value="snippets" fill>
					<SnippetManager
						selected={snippet}
						onOpen={(key) => void openSnippet(key)}
						onSelectedChange={setSnippet}
						onDirtyChange={onSnippetDirty}
					/>
				</TabsContent>
				<TabsContent value="connections" fill>
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
		</Stack>
	);
}

/** The allowed values of a one-of check, as chips. */
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
	return (
		<Box grow maxWidth="assistant">
			<TagInput
				items={items}
				disabled={disabled}
				mono
				placeholder={t("check.oneOfPlaceholder")}
				removeLabel={(item) => t("check.oneOfRemove", { item })}
				onChange={onChange}
			/>
		</Box>
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
		<Inline as="li" gap={8} align={multiline ? "start" : "center"} paddingTop={multiline ? 4 : undefined}>
			<Switch id={id} checked={check.enabled} onCheckedChange={(enabled) => onChange({ ...check, enabled })} />
			<Label htmlFor={id} size="caption">
				{label}
			</Label>
			<Inline gap={8} grow minWidth={0} maxWidth="assistant">
				{check.kind === "pattern" && (
					<Box grow minWidth={0}>
						<Input
							aria-label={t("check.pattern")}
							value={check.pattern}
							disabled={!check.enabled}
							onChange={(event) => onChange({ ...check, pattern: event.target.value })}
							size="sm"
							mono
						/>
					</Box>
				)}
				{check.kind === "maxLength" && (
					<Inline gap={8}>
						<Input
							type="number"
							width="number"
							aria-label={t("check.maxChars")}
							min={1}
							max={5000}
							value={check.max}
							disabled={!check.enabled}
							onChange={(event) =>
								onChange({ ...check, max: Math.min(5000, Math.max(1, Number(event.target.value) || 1)) })
							}
							size="sm"
						/>
						<Text variant="caption" tone="muted">
							{t("check.charsOrLess")}
						</Text>
					</Inline>
				)}
				{check.kind === "oneOf" && (
					<OneOfInput
						items={check.items}
						disabled={!check.enabled}
						onChange={(items) => onChange({ ...check, items })}
					/>
				)}
			</Inline>
			{onRemove ? (
				<IconButton label={t("check.remove", { label })} tone="danger" onClick={onRemove}>
					<Trash2 aria-hidden />
				</IconButton>
			) : (
				// Keeps the rows aligned with the ones that have a remove button.
				<Box paddingX={12} shrink={false} aria-hidden />
			)}
		</Inline>
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
	// Advanced is closed unless the person opened it before in this browser, or the action has edited advanced values.
	const [advancedChoice, setAdvancedChoice] = usePreference("ai-advanced-open", booleanCodec, false);
	const [advancedOpen, setAdvancedOpen] = useState(
		advancedChoice || advancedEdited(spec, custom ? null : feature.defaults),
	);
	const toggleAdvanced = (open: boolean) => {
		setAdvancedOpen(open);
		setAdvancedChoice(open);
	};
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
		<Stack gap={16} padding={24} maxWidth="reading" width="full" centered>
			<Inline gap={16} wrap>
				<Stack gap={2} grow minWidth={0}>
					<Heading truncate>
						{(custom ? custom.base.label.trim() : spec.label?.trim() || feature.label) || t("title.new")}
					</Heading>
					<Text as="p" variant="caption" tone="muted">
						{deciding ? t("about.decide") : t(`about.${feature.result}`)}
					</Text>
					<Text as="p" variant="caption" tone="muted" truncate>
						{placeLabel(feature)}
					</Text>
				</Stack>
				<Label size="caption">
					<Switch checked={spec.enabled} onCheckedChange={(enabled) => set({ enabled })} />
					{t("toggle.on")}
				</Label>
			</Inline>

			{custom && (
				<Box as="section" aria-label={t("section.basics")} border="y" paddingY={16}>
					<CustomBaseFields base={custom.base} onChange={custom.onBaseChange} />
				</Box>
			)}

			<FormField>
				<FormFieldLabel htmlFor={ids.provider}>{t("field.connection")}</FormFieldLabel>
				<Inline gap={8} minWidth={0}>
					<Box grow minWidth={0}>
						<OptionSelect
							id={ids.provider}
							value={spec.providerId ?? ""}
							options={providerOptions}
							onChange={(value) => set({ providerId: value || null, modelName: "" })}
						/>
					</Box>
					<Box grow minWidth={0}>
						<ModelCombobox
							aria-label={t("field.model")}
							value={spec.modelName}
							models={modelList.models}
							loading={modelList.loading}
							error={modelList.error}
							placeholder={chosen?.defaultModel || t("field.defaultModel")}
							onChange={(modelName) => set({ modelName })}
						/>
					</Box>
				</Inline>
			</FormField>

			<Stack
				as="section"
				gap={8}
				radius="md"
				background="tool"
				padding={12}
				aria-label={t("test.title")}
				data-testid="ai-try"
			>
				<Inline gap={12}>
					<Box grow minWidth={0}>
						<Text as="p" variant="caption" tone="muted">
							{t("test.hint")}
						</Text>
					</Box>
					<Button type="button" size="sm" variant="secondary" disabled={testDisabled} onClick={() => void runTest()}>
						<Spark aria-hidden />
						{testRunning ? t("test.running") : t("test.run")}
					</Button>
				</Inline>
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
						size="sm"
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
							<Text as="p" variant="caption" tone="muted">
								{t("test.noResults")}
							</Text>
						) : (
							<Inline as="ul" gap={4} wrap>
								{test.result.items.map((item) => (
									<Badge key={item.value} variant="secondary" render={<li />}>
										<Text variant="caption" truncate>
											{item.label}
										</Text>
										{item.detail && (
											<Text variant="caption" tone="muted">
												{item.detail}
											</Text>
										)}
									</Badge>
								))}
							</Inline>
						)
					) : (
						<CodeBlock>{test.result.text}</CodeBlock>
					))}
			</Stack>

			<Box border="top" paddingTop={16}>
				<Collapsible open={advancedOpen} onOpenChange={toggleAdvanced}>
					<CollapsibleTrigger render={<TextButton type="button" variant="quiet" />} data-testid="ai-advanced-toggle">
						<Inline gap={8}>
							{advancedOpen ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
							<Text weight="medium">{t("advanced.title")}</Text>
							{advancedEdited(spec, defaults) && <ModifiedChip label={t("status.modified")} />}
							<Text variant="caption" tone="muted">
								{t("advanced.hint")}
							</Text>
						</Inline>
					</CollapsibleTrigger>
					<CollapsibleContent data-testid="ai-advanced">
						<Box paddingTop={16}>
							<FormFieldGroup>
								{!custom && (
									<FormField>
										<FormFieldLabel htmlFor={ids.name}>{t("field.name")}</FormFieldLabel>
										<Input
											id={ids.name}
											value={spec.label ?? feature.label}
											maxLength={60}
											placeholder={feature.defaults?.label ?? feature.label}
											onChange={(event) => set({ label: event.target.value })}
											size="sm"
										/>
									</FormField>
								)}

								<Inline gap={24} wrap>
									<Label size="caption">
										<Switch
											checked={spec.askInstruction}
											onCheckedChange={(askInstruction) => set({ askInstruction })}
										/>
										{t("toggle.ask")}
									</Label>
									{feature.apply !== "none" && (feature.result === "candidates" || feature.result === "text") && (
										<Label size="caption">
											<Switch checked={spec.instant} onCheckedChange={(instant) => set({ instant })} />
											{t("toggle.instant")}
										</Label>
									)}
								</Inline>

								{inputs.length > 0 && (
									<FormField role="group" aria-labelledby={ids.sendTitle}>
										<FormFieldTitle id={ids.sendTitle}>{t("field.send")}</FormFieldTitle>
										<Inline gap={12} wrap>
											{inputs.map(([name, input]) => (
												<Label key={name} size="caption">
													<Checkbox
														checked={uses(name) || input.required}
														disabled={input.required}
														onCheckedChange={(checked) =>
															set({
																send:
																	checked === true ? [...spec.send, name] : spec.send.filter((item) => item !== name),
															})
														}
													/>
													{input.label}
												</Label>
											))}
										</Inline>
									</FormField>
								)}

								{deciding && (
									<FormField>
										<FormFieldLabel htmlFor={ids.threshold}>{t("field.threshold")}</FormFieldLabel>
										<Inline gap={8}>
											<Input
												id={ids.threshold}
												type="number"
												width="number"
												min={1}
												max={99}
												value={Math.round(spec.threshold * 100)}
												onChange={(event) =>
													set({ threshold: Math.min(99, Math.max(1, Number(event.target.value) || 1)) / 100 })
												}
												size="sm"
											/>
											<Text variant="caption" tone="muted">
												{t("field.percentOrMore")}
											</Text>
											<Input
												type="number"
												width="number"
												aria-label={t("field.maxCount")}
												min={1}
												max={20}
												value={spec.maxCount}
												onChange={(event) =>
													set({ maxCount: Math.min(20, Math.max(1, Number(event.target.value) || 1)) })
												}
												size="sm"
											/>
											<Text variant="caption" tone="muted">
												{t("field.countUpTo")}
											</Text>
										</Inline>
									</FormField>
								)}

								<FormField role="group" aria-labelledby={ids.checksTitle}>
									<FormFieldTitle id={ids.checksTitle}>{t("field.checks")}</FormFieldTitle>
									<Stack gap={8}>
										<Stack as="ul" gap={8} aria-label={t("field.checks")}>
											{spec.checks.map((check, index) => (
												<CheckRow
													key={checkKey(check)}
													check={check}
													label={
														check.kind === "code"
															? (feature.validatorLabels[check.name] ?? check.name)
															: checkLabel(check.kind)
													}
													onChange={(next) =>
														set({ checks: spec.checks.map((item, i) => (i === index ? next : item)) })
													}
													onRemove={
														feature.definedChecks.includes(checkKey(check))
															? undefined
															: () => set({ checks: spec.checks.filter((_, i) => i !== index) })
													}
												/>
											))}
										</Stack>
										{addableChecks.length > 0 && (
											<Inline>
												<DropdownMenu>
													<DropdownMenuTrigger render={<TextButton type="button" variant="quiet" />}>
														<Plus aria-hidden />
														{t("field.addCheck")}
													</DropdownMenuTrigger>
													<DropdownMenuContent align="start">
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
											</Inline>
										)}
									</Stack>
								</FormField>

								<FormField>
									<FormFieldLabel htmlFor={ids.prompt}>
										{deciding ? t("field.criteria") : t("field.prompt")}
									</FormFieldLabel>
									<Textarea
										id={ids.prompt}
										rows={PROMPT_ROWS}
										value={spec.prompt}
										onChange={(event) => set({ prompt: event.target.value })}
										size="sm"
									/>
								</FormField>
							</FormFieldGroup>
						</Box>
					</CollapsibleContent>
				</Collapsible>
			</Box>

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
						variant="secondary"
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
						variant="secondary"
						disabled={atDefaults}
						onClick={() => onChange({ ...defaults, enabled: spec.enabled, hidden: false })}
					>
						<RotateCcw aria-hidden />
						{t("button.reset")}
					</Button>
				)}
				{!custom?.isNew && (
					<Inline grow justify="end">
						<Text variant="caption" tone="muted">
							{feature.updatedAt
								? t("meta.edited", {
										time: new Date(feature.updatedAt).toLocaleString(site.ADMIN_LOCALE, {
											timeZone: site.CMS_TIME_ZONE,
										}),
									})
								: t("meta.default")}
						</Text>
					</Inline>
				)}
			</EditorFooter>
		</Stack>
	);
}
