"use client";

import { cmsFetch, errorText } from "@monti-cms/admin/api";
import {
	AdminShell,
	Button,
	Checkbox,
	cn,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
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
	Label,
	Switch,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Textarea,
	useConfirm,
} from "@monti-cms/admin/kit";
import { SLOT_CHIP } from "@monti-cms/admin/slots";
import {
	ADMIN_LOCALE,
	BLOCK_BY_NAME,
	CMS_TIME_ZONE,
	COLLECTIONS,
	cmsApiUrl,
	createTranslator,
	schemaOf,
} from "@monti-cms/core/client";
import { useQueryClient } from "@tanstack/react-query";
import { Plug, Plus, Quote, RotateCcw, Save, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { toast } from "sonner";
import { resolveAction } from "../action";
import { draftCustomView, viewOf } from "../action-view";
import type { AiActionView } from "../actions";
import type { CustomBase } from "../custom";
import { ADDABLE_CHECKS, type AddableCheckKind, type AiCheck, type AiRunResult, checkKey } from "../definition";
import { actionDefinition } from "../registry";
import { aiManagerMessages } from "./ai-manager.messages";
import { AI_ACTIONS_KEY, type AiActionsResponse, runAiAction, useAiActions } from "./ai-slot-provider";
import { missingRequired, SampleInputs, sampleDefaults, sampleFields, sampleRun } from "./ai-test-sample";
import {
	ConnectionManager,
	DETAIL_PANE,
	InlineError,
	ListRow,
	ListSkeleton,
	LoadError,
	useAiSettings,
} from "./connection-editor";
import { CustomBaseFields, NEW_CUSTOM_BASE, OptionSelect } from "./custom-editor";
import { checkLabel, engineLabel, slotLabel, slotTargetLabel } from "./labels.messages";
import { ModelCombobox, useModelList } from "./model-combobox";
import { PROMPT_ROWS, PROMPT_TEXTAREA, SharedManager, useAiShared } from "./shared-editor";

const t = createTranslator(aiManagerMessages);

/** Visible name of the attach target. For a field, it is the name in the collection definition. */
function placeLabel(action: Pick<AiActionView, "attach">): string {
	const attach = action.attach[0];
	if (!attach) return t("place.direct");
	switch (attach.slot) {
		case "field": {
			for (const collection of COLLECTIONS) {
				const field = schemaOf(collection).fields[attach.field];
				if (field) return `${slotLabel("field")} · ${field.label}`;
			}
			return `${slotLabel("field")} · ${attach.field}`;
		}
		case "translation":
		case "selection":
		case "insert":
			return slotLabel(attach.slot);
		case "block":
			return `${slotLabel("block")} · ${BLOCK_BY_NAME.get(attach.block)?.label ?? attach.block}`;
		default: {
			return `${slotLabel(attach.slot)} · ${slotTargetLabel(attach.slot, attach.target)}`;
		}
	}
}

/** Values editable in the admin screen. Sent with save and test. */
type Editable = Pick<
	AiActionView,
	| "enabled"
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

/** Defaults of a code action (the values built from the definition alone, without edits). Screen actions have no defaults to revert to. */
function defaultSpecOf(feature: AiActionView): Editable | null {
	if (feature.custom) return null;
	const definition = actionDefinition(feature.key);
	return definition ? editableOf(viewOf(resolveAction(feature.key, definition), undefined)) : null;
}

/** Comparison key of the edited values. If it differs from the values at open time, there is unsaved content. */
const snapshotOf = (spec: Editable, base: CustomBase | undefined) => JSON.stringify({ spec, base });

/** Sample input for the test (input name -> value) and the extra request. Fields are built from the action's input types (`ai-test-sample`). */
type Sample = { values: Record<string, string>; request: string };
const EMPTY_SAMPLE: Sample = { values: {}, request: "" };

type AiTab = "features" | "connections" | "shared";

/**
 * Admin AI screen. The Actions tab lists actions defined in code and actions created in the screen; for each action you edit enabled, ask-for-request,
 * connection, model, content to send, instructions and checks, then test before saving. The Connections tab stores several service URLs, keys and default models.
 * The Shared texts tab edits and adds the text that goes into `{{shared.key}}` in instructions. All three tabs are a list + a detail pane.
 * Opening another item or tab with unsaved content asks whether to discard it.
 */
export function AiManager() {
	const queryClient = useQueryClient();
	const featuresQuery = useAiActions();
	const settingsQuery = useAiSettings();
	const sharedQuery = useAiShared();
	const features = featuresQuery.data?.items ?? [];
	const usable = new Set(featuresQuery.data?.usable ?? []);
	const [tab, setTab] = useState<AiTab>("features");
	/** The action being edited. If `isNew`, it is a new screen action not yet saved (saving creates it). `initial` is the value at open time. */
	const [editing, setEditing] = useState<{
		feature: AiActionView;
		spec: Editable;
		base?: CustomBase;
		isNew?: boolean;
		initial: string;
	} | null>(null);
	const [saving, setSaving] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	/** The open connection. The header's Add connection changes it, so it lives outside the Connections tab. */
	const [connection, setConnection] = useState<string | "new" | null>(null);
	const [connectionDirty, setConnectionDirty] = useState(false);
	/** The open shared text. The header's Add text changes it, so it lives outside the Shared texts tab. */
	const [shared, setShared] = useState<string | "new" | null>(null);
	const [sharedDirty, setSharedDirty] = useState(false);
	const { confirm, confirmDiscard, dialog } = useConfirm();

	const featureDirty = editing !== null && snapshotOf(editing.spec, editing.base) !== editing.initial;

	const replaceInCache = (feature: AiActionView) =>
		queryClient.setQueryData<AiActionsResponse>(AI_ACTIONS_KEY, (data) =>
			data ? { ...data, items: data.items.map((item) => (item.key === feature.key ? feature : item)) } : data,
		);

	/** Opens without asking (e.g. after saving). */
	const open = (feature: AiActionView) => {
		const spec = editableOf(feature);
		setEditing({
			feature,
			spec,
			...(feature.custom ? { base: feature.custom } : {}),
			initial: snapshotOf(spec, feature.custom),
		});
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
		const base = NEW_CUSTOM_BASE();
		const feature = draftCustomView(base);
		const spec = editableOf(feature);
		setEditing({ feature, spec, base, isNew: true, initial: snapshotOf(spec, base) });
		setFormError(null);
	};

	const openConnection = async (id: string | "new") => {
		if (id === connection) return;
		if (await confirmDiscard(connectionDirty)) setConnection(id);
	};

	const openShared = async (key: string | "new") => {
		if (key === shared) return;
		if (await confirmDiscard(sharedDirty)) setShared(key);
	};

	/** Switches tabs. Closing the Connections or Shared texts tab discards the input, so it asks if there is unsaved content. */
	const changeTab = async (next: AiTab) => {
		const dirty = (tab === "connections" && connectionDirty) || (tab === "shared" && sharedDirty);
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
			setEditing({ ...editing, base });
			return;
		}
		const draft = draftCustomView(base);
		const feature: AiActionView = editing.isNew
			? draft
			: { ...draft, key: editing.feature.key, version: editing.feature.version, updatedAt: editing.feature.updatedAt };
		const sameEngine = feature.engine === editing.feature.engine;
		const { spec } = editing;
		setEditing({
			...editing,
			base,
			feature,
			spec: {
				...editableOf(feature),
				enabled: spec.enabled,
				askInstruction: spec.askInstruction,
				instant: spec.instant,
				prompt: spec.prompt,
				...(sameEngine ? { providerId: spec.providerId, modelName: spec.modelName } : {}),
			},
		});
	};

	const remove = async (feature: AiActionView) => {
		const ok = await confirm({
			title: t("remove.title"),
			description: t("remove.description", { label: feature.label }),
			confirmLabel: t("remove.confirm"),
			destructive: true,
		});
		if (!ok) return;
		setDeleting(true);
		setFormError(null);
		try {
			await cmsFetch(cmsApiUrl(`/v1/ai/actions/${feature.key}?expectedVersion=${feature.version}`), {
				method: "DELETE",
				fallback: t("remove.failed"),
			});
			queryClient.setQueryData<AiActionsResponse>(AI_ACTIONS_KEY, (data) =>
				data ? { ...data, items: data.items.filter((item) => item.key !== feature.key) } : data,
			);
			setEditing(null);
			toast.success(t("remove.done"));
		} catch (error) {
			setFormError(errorText(error, t("remove.failed")));
		} finally {
			setDeleting(false);
		}
	};

	const save = async () => {
		if (!editing) return;
		setSaving(true);
		setFormError(null);
		try {
			if (editing.isNew && editing.base) {
				const created = await cmsFetch<AiActionView>(cmsApiUrl("/v1/ai/actions"), {
					method: "POST",
					json: { base: { ...editing.base, label: editing.base.label.trim() }, value: editing.spec },
					fallback: t("save.failed"),
				});
				queryClient.setQueryData<AiActionsResponse>(AI_ACTIONS_KEY, (data) =>
					data ? { ...data, items: [...data.items, created] } : data,
				);
				open(created);
			} else {
				const saved = await cmsFetch<AiActionView>(cmsApiUrl(`/v1/ai/actions/${editing.feature.key}`), {
					method: "PATCH",
					json: {
						expectedVersion: editing.feature.version,
						value: editing.spec,
						...(editing.base ? { base: { ...editing.base, label: editing.base.label.trim() } } : {}),
					},
					fallback: t("save.failed"),
				});
				replaceInCache(saved);
				open(saved);
			}
			toast.success(t("save.done"));
			void queryClient.invalidateQueries({ queryKey: AI_ACTIONS_KEY });
		} catch (error) {
			setFormError(errorText(error, t("save.failed")));
		} finally {
			setSaving(false);
		}
	};

	const onConnectionDirty = useCallback((dirty: boolean) => setConnectionDirty(dirty), []);
	const onSharedDirty = useCallback((dirty: boolean) => setSharedDirty(dirty), []);

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
			<Button type="button" size="sm" onClick={() => void openShared("new")}>
				<Plus aria-hidden />
				{t("add.shared")}
			</Button>
		);
	const count =
		tab === "features"
			? featuresQuery.data?.items.length
			: tab === "connections"
				? settingsQuery.data?.providers.length
				: sharedQuery.data?.items.length;

	return (
		<AdminShell title="AI" count={count} headerActions={headerActions} sidebar={{ activeNav: "ai" }}>
			<Tabs
				value={tab}
				onValueChange={(value) => void changeTab(value as AiTab)}
				className="flex min-h-0 flex-1 flex-col gap-0"
			>
				<TabsList variant="line" className="h-10 w-full shrink-0 justify-start gap-4 border-b px-4">
					<TabsTrigger value="features" className="flex-none px-0 text-xs">
						<Sparkles aria-hidden />
						{t("tab.features")}
					</TabsTrigger>
					<TabsTrigger value="connections" className="flex-none px-0 text-xs">
						<Plug aria-hidden />
						{t("tab.connections")}
					</TabsTrigger>
					<TabsTrigger value="shared" className="flex-none px-0 text-xs">
						<Quote aria-hidden />
						{t("tab.shared")}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="features" className="flex min-h-0 flex-1 flex-col">
					{featuresQuery.error && !featuresQuery.data && (
						<LoadError
							message={errorText(featuresQuery.error, t("list.loadFailed"))}
							onRetry={() => void featuresQuery.refetch()}
						/>
					)}
					<div className="flex min-h-0 flex-1 overflow-hidden">
						<div className="flex w-72 shrink-0 flex-col border-r">
							<ul className="min-h-0 flex-1 divide-y overflow-y-auto" aria-label={t("list.label")}>
								{featuresQuery.isPending ? (
									<ListSkeleton rows={4} />
								) : (
									<>
										{featuresQuery.data && features.length === 0 && !editing?.isNew && (
											<li className="px-3 py-6 text-center text-cms-muted-foreground text-xs">{t("list.empty")}</li>
										)}
										{features.map((feature) => (
											<ListRow
												key={feature.key}
												title={feature.label}
												status={
													!feature.enabled
														? t("status.off")
														: usable.has(feature.key)
															? null
															: t("status.needsConnection")
												}
												detail={`${placeLabel(feature)} · ${engineLabel(feature.engine)}${feature.custom ? ` · ${t("detail.custom")}` : ""}`}
												// While a new unsaved action is open, no other row in the list is shown as open.
												current={editing !== null && !editing.isNew && editing.feature.key === feature.key}
												onClick={() => void openFeature(feature)}
											/>
										))}
										{editing?.isNew && (
											<ListRow
												title={editing.base?.label.trim() || t("title.new")}
												status={t("status.unsaved")}
												detail={`${placeLabel(editing.feature)} · ${engineLabel(editing.feature.engine)}`}
												current
												onClick={() => {}}
											/>
										)}
									</>
								)}
							</ul>
						</div>

						<div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
							{editing ? (
								<FeatureEditor
									key={editing.isNew ? "new" : editing.feature.key}
									feature={editing.feature}
									spec={editing.spec}
									saving={saving}
									deleting={deleting}
									dirty={featureDirty}
									error={formError}
									onChange={(spec) => setEditing({ ...editing, spec })}
									onSave={() => void save()}
									custom={
										editing.base
											? {
													base: editing.base,
													onBaseChange: changeBase,
													isNew: editing.isNew === true,
													onCancel: () => setEditing(null),
													onDelete: () => void remove(editing.feature),
												}
											: undefined
									}
								/>
							) : (
								featuresQuery.data && (
									<Empty className="flex-1">
										<EmptyHeader>
											<EmptyMedia variant="icon">
												<Sparkles aria-hidden />
											</EmptyMedia>
											<EmptyTitle>{t("empty.pick")}</EmptyTitle>
										</EmptyHeader>
										<EmptyContent>
											<Button type="button" size="sm" onClick={() => void startNew()}>
												<Plus aria-hidden />
												{t("add.feature")}
											</Button>
										</EmptyContent>
									</Empty>
								)
							)}
						</div>
					</div>
				</TabsContent>
				<TabsContent value="shared" className="flex min-h-0 flex-1 flex-col">
					<SharedManager
						selected={shared}
						onOpen={(key) => void openShared(key)}
						onSelectedChange={setShared}
						onDirtyChange={onSharedDirty}
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
		</AdminShell>
	);
}

/** List input for the one-of-values check. One value per line; blank lines are dropped. */
function OneOfInput({
	items,
	disabled,
	onChange,
}: {
	items: readonly string[];
	disabled: boolean;
	onChange: (items: string[]) => void;
}) {
	const [text, setText] = useState(items.join("\n"));
	return (
		<Textarea
			aria-label={t("check.options")}
			rows={3}
			value={text}
			disabled={disabled}
			onChange={(event) => {
				setText(event.target.value);
				const next = event.target.value
					.split("\n")
					.map((line) => line.trim())
					.filter(Boolean);
				if (next.length > 0) onChange(next);
			}}
			className="field-sizing-fixed min-h-16 min-w-0 max-w-md flex-1 font-mono text-xs md:text-xs"
		/>
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
	const id = useId();
	return (
		<li className={cn("flex min-h-8 gap-2", check.kind === "oneOf" ? "items-start [&>label]:pt-1.5" : "items-center")}>
			<Switch
				id={id}
				size="sm"
				checked={check.enabled}
				onCheckedChange={(enabled) => onChange({ ...check, enabled })}
			/>
			<Label htmlFor={id} className="w-20 shrink-0 font-normal text-xs">
				{label}
			</Label>
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
					<span className="text-cms-muted-foreground">{t("check.charsOrLess")}</span>
				</span>
			)}
			{check.kind === "oneOf" && (
				<OneOfInput items={check.items} disabled={!check.enabled} onChange={(items) => onChange({ ...check, items })} />
			)}
			{onRemove && (
				<IconButton
					label={t("check.remove", { label })}
					size="icon-xs"
					destructive
					onClick={onRemove}
					className="ml-auto"
				>
					<Trash2 aria-hidden />
				</IconButton>
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
	/** For a screen action: edit basic info and delete. For a new action (`isNew`), cancel instead of delete. */
	custom?: {
		base: CustomBase;
		onBaseChange: (base: CustomBase) => void;
		onCancel: () => void;
		onDelete: () => void;
		isNew: boolean;
	};
}) {
	const ids = { provider: useId(), prompt: useId(), threshold: useId(), sendTitle: useId(), checksTitle: useId() };
	const deciding = feature.engine === "decide";
	const settings = useAiSettings().data;
	const kind = deciding ? "decisions" : "chat";
	const providers = (settings?.providers ?? []).filter((provider) => provider.kind === kind);
	const chosen = spec.providerId
		? providers.find((provider) => provider.id === spec.providerId)
		: providers.find((provider) => provider.ready);
	const canRun =
		Boolean(settings?.fake) || Boolean(chosen?.url && chosen.keyHint && (spec.modelName || chosen.defaultModel));
	// Model list of the selected generation connection. A list that was fetched once is remembered and not fetched again.
	const modelList = useModelList(!deciding && chosen?.keyHint ? { providerId: chosen.id } : null);
	const [sample, setSample] = useState<Sample>(EMPTY_SAMPLE);
	const [test, setTest] = useState<
		{ status: "running" } | { status: "done"; result: AiRunResult } | { status: "error"; message: string } | null
	>(null);
	const set = (patch: Partial<Editable>) => onChange({ ...spec, ...patch });
	// Defaults of a code action. Reset to default only reverts the input fields (enabled stays as is); saving is a separate click.
	const defaults = custom ? null : defaultSpecOf(feature);
	const atDefaults =
		defaults !== null && JSON.stringify({ ...defaults, enabled: spec.enabled }) === JSON.stringify(spec);
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
	const sampleStart = sampleDefaults(feature);
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
			setTest({ status: "done", result: await runAiAction(feature.key, input, { ...options, env }) });
		} catch (runError) {
			setTest({ status: "error", message: errorText(runError, t("test.failed")) });
		}
	};

	return (
		<div className={DETAIL_PANE}>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
				<div className="min-w-0 flex-1">
					<h2 className="truncate font-medium text-base">
						{(custom ? custom.base.label.trim() : feature.label) || t("title.new")}
					</h2>
					<p className="truncate text-cms-muted-foreground text-xs">
						{placeLabel(feature)} · {engineLabel(feature.engine)}
					</p>
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

			{custom && (
				<section aria-label={t("section.basics")} className="rounded-md border p-3">
					<CustomBaseFields base={custom.base} onChange={custom.onBaseChange} />
				</section>
			)}

			<FieldGroup className="gap-5">
				<Field>
					<FieldLabel htmlFor={ids.provider}>{t("field.connection")}</FieldLabel>
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
				</Field>

				{inputs.length > 0 && (
					<Field role="group" aria-labelledby={ids.sendTitle}>
						<FieldTitle id={ids.sendTitle}>{t("field.send")}</FieldTitle>
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
					</Field>
				)}

				{deciding && (
					<Field>
						<FieldLabel htmlFor={ids.threshold}>{t("field.threshold")}</FieldLabel>
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
							<span className="text-cms-muted-foreground">{t("field.percentOrMore")}</span>
							<Input
								type="number"
								aria-label={t("field.maxCount")}
								min={1}
								max={20}
								value={spec.maxCount}
								onChange={(event) => set({ maxCount: Math.min(20, Math.max(1, Number(event.target.value) || 1)) })}
								className="ml-3 h-8 w-16 text-xs md:text-xs"
							/>
							<span className="text-cms-muted-foreground">{t("field.countUpTo")}</span>
						</div>
					</Field>
				)}

				<Field role="group" aria-labelledby={ids.checksTitle}>
					<FieldTitle id={ids.checksTitle}>{t("field.checks")}</FieldTitle>
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
										<Button type="button" size="xs" variant="ghost" className="self-start text-cms-muted-foreground" />
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
				</Field>

				<Field>
					<FieldLabel htmlFor={ids.prompt}>{deciding ? t("field.criteria") : t("field.prompt")}</FieldLabel>
					<Textarea
						id={ids.prompt}
						rows={PROMPT_ROWS}
						value={spec.prompt}
						onChange={(event) => set({ prompt: event.target.value })}
						className={PROMPT_TEXTAREA}
					/>
				</Field>
			</FieldGroup>

			{error && <InlineError>{error}</InlineError>}

			<div className="flex flex-wrap items-center gap-2">
				<Button
					type="button"
					size="sm"
					disabled={saving || !dirty || (custom?.isNew === true && !custom.base.label.trim())}
					onClick={onSave}
				>
					<Save aria-hidden />
					{saving ? t("button.saving") : t("button.save")}
				</Button>
				{custom?.isNew && (
					<Button type="button" size="sm" variant="outline" onClick={custom.onCancel}>
						{t("button.cancel")}
					</Button>
				)}
				{defaults && (
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={atDefaults}
						onClick={() => onChange({ ...defaults, enabled: spec.enabled })}
					>
						<RotateCcw aria-hidden />
						{t("button.reset")}
					</Button>
				)}
				{!custom?.isNew && (
					<span className="ml-auto text-cms-muted-foreground text-xs">
						{feature.updatedAt
							? t("meta.edited", {
									time: new Date(feature.updatedAt).toLocaleString(ADMIN_LOCALE, { timeZone: CMS_TIME_ZONE }),
								})
							: t("meta.default")}
					</span>
				)}
				{custom && !custom.isNew && (
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="text-cms-destructive hover:bg-cms-destructive/10 hover:text-cms-destructive"
						disabled={deleting}
						onClick={custom.onDelete}
					>
						<Trash2 aria-hidden />
						{deleting ? t("button.deleting") : t("button.delete")}
					</Button>
				)}
			</div>

			<section
				className="flex flex-col gap-2 rounded-md border bg-cms-muted/30 p-3 text-xs"
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
							if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
								event.preventDefault();
								void runTest();
							}
						}}
						className="min-h-14 resize-y bg-cms-background text-xs md:text-xs"
					/>
				)}
				<SampleInputs
					fields={sampleInputs}
					values={sample.values}
					defaults={sampleStart}
					onChange={(name, value) => setSample({ ...sample, values: { ...sample.values, [name]: value } })}
				/>
				{test?.status === "error" && (
					<p role="alert" className="text-cms-destructive">
						{test.message}
					</p>
				)}
				{test?.status === "done" &&
					(test.result.kind === "candidates" ? (
						test.result.items.length === 0 ? (
							<p className="text-cms-muted-foreground">{t("test.noResults")}</p>
						) : (
							<ul className="flex flex-wrap gap-1">
								{test.result.items.map((item) => (
									<li key={item.value} className={SLOT_CHIP}>
										<span className="truncate">{item.label}</span>
										{item.detail && <span className="shrink-0 text-cms-muted-foreground">{item.detail}</span>}
									</li>
								))}
							</ul>
						)
					) : (
						<p className="whitespace-pre-wrap rounded border bg-cms-background p-2">{test.result.text}</p>
					))}
			</section>
		</div>
	);
}
