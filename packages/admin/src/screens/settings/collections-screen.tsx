import { type AdminValues, type Answers, type SchemaChange, sameJson } from "@monti-cms/core";
import {
	Banner,
	Button,
	ChangesGroup,
	Inline,
	NavLink,
	PageBanner,
	PageBody,
	PageColumn,
	PageHeader,
	PageToolbar,
	PageToolbarEnd,
	ProposalBubble,
	ProposalBubbleDock,
	RailAction,
	RailLayout,
	Stack,
	TabLink,
	TabLinks,
	toast,
} from "@monti-cms/ui";
import { useEffect, useRef, useState } from "react";
import { useLeaveGuard } from "../../draft/leave-guard";
import { useAdmin } from "../../operations/admin-context";
import { useOperation } from "../../operations/use-operation";
import { type Place as FramePlace, useCoverCorner } from "../frame/admin-frame";
import { BasicsTab } from "./basics-tab";
import { EditorTab } from "./editor-tab";
import { FieldSheet, type FieldSheetOpen } from "./field-sheet";
import { FieldsTab } from "./fields-tab";
import { NewCollectionSheet } from "./new-collection-sheet";
import { PreviewPanel } from "./preview-panel";
import { ofCollection, type Plan, ReviewSheet } from "./review-sheet";
import { at, placeOf, type SchemaRead, savedValues } from "./schema-draft";
import { type CollectionsDraft, useCollectionsDraft } from "./use-collections-draft";

type Tab = "basics" | "fields" | "editor";

/**
 * Settings (the page's title and its tabs). Only the collections tab is built; the other tabs come with their docs (11, 12), so they are not shown (hide what
 * cannot be done).
 */
function SettingsPage({ save, children }: { save: React.ReactNode; children: React.ReactNode }) {
	const { t } = useAdmin();
	return (
		<PageColumn>
			<PageHeader title={t("settings.title")}>{save}</PageHeader>
			<PageToolbar>
				<TabLinks variant="toolbar">
					<TabLink current>{t("settings.tab.collections")}</TabLink>
				</TabLinks>
			</PageToolbar>
			{children}
		</PageColumn>
	);
}

/** The admin values a structure change carries for what it makes (doc 01): a new collection's in full, a new field's of an existing one. */
function firstValues(model: CollectionsDraft): Record<string, AdminValues> {
	const { data, built } = model;
	const out: Record<string, AdminValues> = {};
	if (!data || !built) return out;
	for (const [c, values] of Object.entries(built.adminValues)) {
		const saved = data.schema.collections[c];
		if (!saved) {
			out[c] = values;
			continue;
		}
		const fresh = Object.keys(built.schema.collections[c]?.fields ?? {}).filter(
			(name) => !saved.fields[name] && !built.renames.some((rename) => rename.collection === c && rename.to === name),
		);
		const fields = Object.fromEntries(
			fresh.flatMap((name) => (values.fields?.[name] ? [[name, values.fields[name]]] : [])),
		);
		if (Object.keys(fields).length > 0) out[c] = { fields };
	}
	return out;
}

/**
 * Settings › collections (doc 01, flows 4 and 11): the collections beside one collection's tabs (basics, fields, editor), one draft for all of them
 * (doc 05), and the save. A structure change (fields, addresses, collections) goes through the review and `schema.apply` on the dev server; a change
 * of admin values only (labels, help, layout, folders, the editor's allowance) is saved at once with `collections.updateAdminValues`, on the live site
 * too, where structure is locked.
 */
export function CollectionsScreen({
	onOpen,
	review,
}: {
	/** Goes to another place of the admin (the toast's view button on a new collection). */
	onOpen: (place: FramePlace) => void;
	/** Bumped when the frame's banner asks for the review of a hand-edited schema file. */
	review?: number;
}) {
	const { t } = useAdmin();
	const model = useCollectionsDraft();
	const { data, draft, rows, built } = model;
	const readOp = useOperation<SchemaRead>("schema.read");
	const planOp = useOperation<{ problems: unknown[]; changes: SchemaChange[] }>("schema.plan");
	const applyOp = useOperation<{ output: { applied: boolean } }>("schema.apply");
	const updateOp = useOperation("collections.updateAdminValues");

	const [active, setActive] = useState<string | null>(null);
	const [tab, setTab] = useState<Tab>("fields");
	const [folderTab, setFolderTab] = useState(0);
	const [preview, setPreview] = useState(false);
	const [fieldSheet, setFieldSheet] = useState<FieldSheetOpen | null>(null);
	const [making, setMaking] = useState(false);
	const [plan, setPlan] = useState<Plan | null>(null);
	const [conflict, setConflict] = useState(false);
	const [busy, setBusy] = useState(false);
	// Why the last save or apply was refused. It stays where the person acts (the feedback ladder in status.md), not in a toast that goes.
	const [refused, setRefused] = useState<string | null>(null);
	const [position, setPosition] = useState(0);

	useLeaveGuard({ changes: rows, revertAll: draft.revertAll });
	useCoverCorner(preview && tab === "fields");

	const live = model.collections.filter((c) => model.shown(at.collection(c)));
	const current = active && live.includes(active) ? active : (live[0] ?? null);
	const kind = current ? (model.shown(at.collection(current)) as { kind: "document" | "item" }).kind : "document";
	const shownTab: Tab = tab === "editor" && kind !== "document" ? "fields" : tab;
	const locked = data?.locked ?? true;

	const openCollection = (c: string) => {
		setActive(c);
		setFolderTab(0);
	};

	const openReview = async () => {
		if (!data || !built) return;
		setRefused(null);
		setBusy(true);
		const [fresh, planned] = await Promise.all([
			readOp.run(),
			planOp.run({ draft: built.schema, renames: built.renames }),
		]);
		setBusy(false);
		if (!planned.ok) {
			setRefused(planned.refusal.reason ? t(planned.refusal.reason) : t("settings.saveFailed"));
			return;
		}
		// The file changed after this screen read it (another tab, a hand edit): the review says so and cannot apply (flow 11, step 19).
		setConflict(fresh.ok && fresh.body.hash !== data.hash);
		setPlan({ ...planned.body, changes: planned.body.changes.filter(ofCollection) });
	};

	// A removal's toast undoes it in the draft; once the draft is saved there is nothing left for it to undo.
	const undoToasts = useRef<(string | number)[]>([]);
	const saved = () => {
		draft.saved();
		for (const id of undoToasts.current.splice(0)) toast.dismiss(id);
	};

	const handled = useRef(0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: the banner's request opens the review once, when the schema has been read.
	useEffect(() => {
		if (!review || review === handled.current || !data) return;
		handled.current = review;
		void openReview();
	}, [review, data]);

	/** Saves the admin values of the collections the draft changed, under the fields' names now. */
	const saveValues = async (read: SchemaRead, accepted: string[], only?: Set<string>) => {
		if (!built) return true;
		let first = true;
		for (const [c, values] of Object.entries(built.adminValues)) {
			if (!read.schema.collections[c] || (only && !only.has(c))) continue;
			if (sameJson(values, savedValues(read, c))) continue;
			const version = read.adminValues[c]?.version;
			const result = await updateOp.run(
				{ collection: c, values },
				{
					versions: version === undefined ? undefined : { [`collectionAdminValues:${c}`]: version },
					accepted: first ? accepted : undefined,
				},
			);
			first = false;
			if (!result.ok) {
				setRefused(result.refusal.reason ? t(result.refusal.reason) : t("settings.saveFailed"));
				return false;
			}
		}
		return true;
	};

	const touched = () =>
		new Set(
			model.changed.flatMap((path) => {
				const place = placeOf(path);
				return place ? [place.collection] : [];
			}),
		);

	const save = async () => {
		if (!data || !built) return;
		if (!locked && model.structureChanged) return openReview();
		setRefused(null);
		setBusy(true);
		const ok = await saveValues(data, draft.accepted, touched());
		if (ok) {
			await model.read.reload();
			saved();
			toast(t("settings.saved"));
		}
		setBusy(false);
	};

	const apply = async (answers: Answers) => {
		if (!data || !built) return;
		setRefused(null);
		setBusy(true);
		const made = Object.keys(built.schema.collections).filter((c) => !data.schema.collections[c]);
		const result = await applyOp.run(
			{ draft: built.schema, renames: built.renames, answers, adminValues: firstValues(model) },
			{ versions: { "schema:current": data.version }, accepted: draft.accepted },
		);
		if (!result.ok) {
			setBusy(false);
			if (result.refusal.status === 409) setConflict(true);
			else setRefused(result.refusal.reason ? t(result.refusal.reason) : t("settings.saveFailed"));
			return;
		}
		// The apply moved a renamed field's admin values itself; what is left is the admin values the person changed alongside (a label, the layout).
		const fresh = await readOp.run();
		if (fresh.ok) await saveValues(fresh.body, [], touched());
		await model.read.reload();
		saved();
		setPlan(null);
		setBusy(false);
		if (!result.body.output.applied) return;
		const one = made.length === 1 ? made[0] : undefined;
		if (one)
			toast(t("settings.made", { name: model.label(one) }), {
				action: { label: t("settings.view"), onClick: () => onOpen({ collection: one }) },
			});
		else toast(t("settings.applied"));
	};

	const remove = (c: string) => {
		const name = model.label(c);
		draft.set(at.collection(c), null);
		setActive(live.find((each) => each !== c) ?? null);
		setTab("fields");
		undoToasts.current.push(
			toast(t("settings.removed", { name }), {
				action: { label: t("settings.undo"), onClick: () => draft.revert(at.collection(c)) },
			}),
		);
	};

	// The proposals the bubble walks: each place a pending item writes that the list draws.
	const proposed = draft.proposals.flatMap(({ item, values }) =>
		Object.keys(values).flatMap((path) => {
			const place = placeOf(path);
			return place && (place.kind === "field" || place.kind === "collection") && draft.cell(path).kind === "proposed"
				? [{ item, collection: place.collection }]
				: [];
		}),
	);
	const walking = proposed[Math.min(position, proposed.length - 1)];
	const step = (by: number) => {
		const next = (position + by + proposed.length) % proposed.length;
		setPosition(next);
		const target = proposed[next];
		if (target) {
			openCollection(target.collection);
			setTab("fields");
		}
	};

	/** Where a row of the changes list goes: a field opens its sheet, an address or a name the basics, the editor's items its tab, the layout the fields. */
	const goTo = (path: string) => {
		const place = placeOf(path);
		if (!place || !model.shown(at.collection(place.collection))) return undefined;
		return () => {
			openCollection(place.collection);
			if (place.kind === "field" || place.kind === "fieldValue") {
				setTab("fields");
				// A field that goes cannot be opened; its row in the list is where it is seen.
				if (model.shown(at.field(place.collection, place.key)))
					setFieldSheet({ collection: place.collection, key: place.key });
			} else if (place.kind === "editor") setTab("editor");
			else if (place.kind === "path" || (place.kind === "collectionValue" && place.value !== "layout"))
				setTab("basics");
			else setTab("fields");
		};
	};
	/** A proposal's row goes to the first place it changes, as the bubble's arrows do. */
	const goToProposal = (id: string) => {
		const target = proposed.find(({ item }) => item.id === id);
		return target
			? () => {
					openCollection(target.collection);
					setTab("fields");
				}
			: undefined;
	};

	const saveGroup =
		rows.length > 0 ? (
			<ChangesGroup
				label={t("settings.changes")}
				listLabel={t("settings.changes")}
				countLabel={t("settings.changesCount", { count: rows.length })}
				items={rows.map((row) => ({
					id: row.id,
					name: row.name,
					tag: row.tag,
					tone: row.tone,
					onOpen: row.paths[0] ? goTo(row.paths[0]) : undefined,
					onUndo: () => {
						for (const path of row.paths) draft.revert(path);
					},
				}))}
				undoLabel={t("settings.undo")}
				discardLabel={t("settings.undoAll")}
				onDiscard={draft.revertAll}
				saveLabel={locked ? t("settings.save") : t("settings.saveApply")}
				onSave={() => void save()}
				saveDisabled={busy}
				proposals={
					draft.proposals.length > 0
						? {
								label: t("settings.proposals"),
								countLabel: t("settings.proposalsCount", { count: draft.proposals.length }),
								discardLabel: t("settings.discard"),
								items: draft.proposals.map(({ item }) => ({
									id: item.id,
									name: item.request,
									onOpen: goToProposal(item.id),
									onDiscard: () => void draft.discard(item.id),
								})),
							}
						: undefined
				}
			/>
		) : null;

	const fieldCount = current ? model.fields(current).filter((key) => draft.value(at.field(current, key))).length : 0;
	const changedCollection = (c: string) => rows.some((row) => row.collection === c);

	return (
		<Inline align="stretch" gap={0} grow minHeight={0}>
			<Stack gap={0} grow minWidth={0} minHeight={0} container>
				<SettingsPage save={saveGroup}>
					<PageBody>
						{/* Drawn at the very top of the screen, over the title (common.md, banners). */}
						<PageBanner>{refused && !plan ? <Banner tone="danger" title={refused} /> : null}</PageBanner>
						{data ? (
							<RailLayout
								label={t("settings.collections")}
								rail={
									<>
										{live.map((c) => (
											<NavLink
												key={c}
												active={c === current}
												note={c}
												dot={changedCollection(c) ? t("settings.changed") : undefined}
												onSelect={() => openCollection(c)}
											>
												{model.label(c)}
											</NavLink>
										))}
										{locked ? null : (
											<RailAction onClick={() => setMaking(true)}>{t("settings.newCollection")}</RailAction>
										)}
									</>
								}
							>
								{current ? (
									<>
										<PageToolbar>
											<TabLinks variant="toolbar">
												<TabLink
													current={shownTab === "basics"}
													render={<button type="button" />}
													onClick={() => setTab("basics")}
												>
													{t("settings.tab.basics")}
												</TabLink>
												<TabLink
													current={shownTab === "fields"}
													count={String(fieldCount)}
													render={<button type="button" />}
													onClick={() => setTab("fields")}
												>
													{t("settings.tab.fields")}
												</TabLink>
												{kind === "document" ? (
													<TabLink
														current={shownTab === "editor"}
														render={<button type="button" />}
														onClick={() => setTab("editor")}
													>
														{t("settings.tab.editor")}
													</TabLink>
												) : null}
											</TabLinks>
											{shownTab === "fields" ? (
												<PageToolbarEnd>
													<Button variant="ghost" size="sm" aria-pressed={preview} onClick={() => setPreview(!preview)}>
														{t("settings.preview.button")}
													</Button>
												</PageToolbarEnd>
											) : null}
										</PageToolbar>
										{shownTab === "fields" ? (
											<FieldsTab
												model={model}
												collection={current}
												tab={folderTab}
												onTab={setFolderTab}
												onOpenField={(key) => setFieldSheet({ collection: current, key })}
												onAddField={() => setFieldSheet({ collection: current, key: null })}
											/>
										) : shownTab === "basics" ? (
											<BasicsTab model={model} collection={current} onDelete={() => remove(current)} />
										) : (
											<EditorTab model={model} collection={current} />
										)}
									</>
								) : null}
							</RailLayout>
						) : null}
						{walking ? (
							<ProposalBubbleDock>
								<ProposalBubble
									name={walking.item.request}
									position={Math.min(position, proposed.length - 1) + 1}
									total={proposed.length}
									previousLabel={t("bubble.previous")}
									nextLabel={t("bubble.next")}
									onPrevious={() => step(-1)}
									onNext={() => step(1)}
									discardAllLabel={t("bubble.discardAll")}
									onDiscardAll={() => void draft.discardAll()}
									acceptAllLabel={t("bubble.acceptAll")}
									onAcceptAll={draft.acceptAll}
								/>
							</ProposalBubbleDock>
						) : null}
					</PageBody>
				</SettingsPage>
			</Stack>
			{preview && shownTab === "fields" && current ? (
				<PreviewPanel model={model} collection={current} onClose={() => setPreview(false)} />
			) : null}
			<FieldSheet model={model} open={fieldSheet} onClose={() => setFieldSheet(null)} />
			<NewCollectionSheet
				model={model}
				open={making}
				onClose={() => setMaking(false)}
				onMade={(c) => {
					setMaking(false);
					openCollection(c);
					setTab("fields");
				}}
			/>
			<ReviewSheet
				model={model}
				plan={plan}
				conflict={conflict}
				refused={plan ? refused : null}
				applying={busy}
				onReload={() => {
					setPlan(null);
					void model.read.reload();
				}}
				onClose={() => setPlan(null)}
				onApply={(answers) => void apply(answers)}
				onOpenField={(c, key) => {
					setPlan(null);
					openCollection(c);
					setTab("fields");
					setFieldSheet({ collection: c, key });
				}}
			/>
		</Inline>
	);
}
