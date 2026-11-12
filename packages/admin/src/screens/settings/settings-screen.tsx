import type { Answers, SchemaChange } from "@monti-cms/core";
import {
	Banner,
	ChangesGroup,
	Inline,
	PageBanner,
	PageBody,
	PageColumn,
	PageHeader,
	PageToolbar,
	ProposalBubble,
	ProposalBubbleDock,
	Stack,
	TabLink,
	TabLinks,
	TextButton,
	toast,
} from "@monti-cms/ui";
import { useEffect, useRef, useState } from "react";
import { useLeaveGuard } from "../../draft/leave-guard";
import type { ProposalItem } from "../../draft/use-proposals";
import { useAdmin } from "../../operations/admin-context";
import { useOperation } from "../../operations/use-operation";
import { linkTo, SETTINGS_TABS, type SettingsTab } from "../../route";
import { useSession } from "../../session";
import { type Place as FramePlace, useCoverCorner } from "../frame/admin-frame";
import { AdminTab, type PreferenceFailure } from "./admin-tab";
import { CollectionsTab, useCollectionsView } from "./collections-tab";
import { LocalesTab } from "./locales-tab";
import { PreviewPanel } from "./preview-panel";
import { type Plan, ReviewSheet } from "./review-sheet";
import { at, flatten, placeOf, type SettingsRead, tabOf } from "./schema-draft";
import { SiteTab } from "./site-tab";
import { useSettingsDraft } from "./use-settings-draft";

/** What `settings.save` answers: which sides it wrote, and how far the structure got. */
type SaveOutput = {
	site: boolean;
	adminValues: string[];
	structure: { changeId: string; written: boolean; applied: boolean } | null;
};

/** Why the last save was refused, and the one thing to do about it (doc 12, T50). It stays under the tabs until it is done. */
type Refused = { reason: string; action: "reload" | "save" };

const SITE_VALUES = ["name", "writing"] as const;

/** One place the proposal bubble stops at: the item, the tab that draws it and, in the collections tab, its collection and that collection's tab. */
type Walked = {
	item: ProposalItem;
	tab: "site" | "languages" | "collections";
	collection: string | null;
	inside?: "basics" | "fields" | "editor";
};

/**
 * Settings (doc 12, flow 11): four tabs over one draft (doc 05). The changes of every tab are counted in the header, a tab that is not open carries
 * a dot when it holds one, and one button saves them all with `settings.save`: admin values at once, on the live site too, and structure (the
 * languages, the collections) through one review on the dev server. A refused save leaves its reason under the tabs with the one thing to do.
 */
export function SettingsScreen({
	tab,
	onTab,
	onOpen,
	review,
}: {
	tab: SettingsTab;
	onTab: (tab: SettingsTab) => void;
	/** Goes to another place of the admin (the toast's view button on a new collection). */
	onOpen: (place: FramePlace) => void;
	/** Bumped when the frame's banner asks for the review of a hand-edited schema file. */
	review?: number;
}) {
	const { t } = useAdmin();
	const session = useSession();
	const model = useSettingsDraft();
	const view = useCollectionsView(model);
	const { data, draft, rows, built, locked } = model;
	const readOp = useOperation<SettingsRead>("settings.read");
	const planOp = useOperation<{ problems: unknown[]; changes: SchemaChange[] }>("schema.plan");
	const saveOp = useOperation<{ output: SaveOutput }>("settings.save");

	const [plan, setPlan] = useState<Plan | null>(null);
	const [conflict, setConflict] = useState(false);
	const [busy, setBusy] = useState(false);
	const [refused, setRefused] = useState<Refused | null>(null);
	const [position, setPosition] = useState(0);
	// Kept here, not in the admin tab: the tab is taken down when another is shown, and a refusal nobody answered must still be there on the way back.
	const [preferenceFailed, setPreferenceFailed] = useState<PreferenceFailure | null>(null);

	useLeaveGuard({ changes: rows, revertAll: draft.revertAll });
	const previewing = tab === "collections" && view.preview && view.tab === "fields" && view.current !== null;
	useCoverCorner(previewing);

	// A removal's toast undoes it in the draft; once the draft is saved there is nothing left for it to undo.
	const undoToasts = useRef<(string | number)[]>([]);
	const saved = () => {
		draft.saved();
		for (const id of undoToasts.current.splice(0)) toast.dismiss(id);
	};

	const refusal = (reason: Parameters<typeof t>[0] | null) => (reason ? t(reason) : t("settings.saveFailed"));

	/** Sends the whole draft: the site's values and the collections' admin values, and on the dev server the structure with the review's answers. */
	const send = async (answers: Answers) => {
		if (!data || !built) return;
		setRefused(null);
		setBusy(true);
		const site = Object.fromEntries(
			SITE_VALUES.flatMap((value) =>
				model.changed.includes(at.site(value)) ? [[value, String(draft.value(at.site(value)) ?? "")]] : [],
			),
		);
		const siteChanged = Object.keys(site).length > 0;
		const structure = !locked && model.structureChanged;
		const made = Object.keys(built.schema.collections).filter((c) => !data.schema.collections[c]);
		const versions: Record<string, number> = {};
		if (siteChanged) versions["settings:site"] = data.site.version;
		if (structure) versions["schema:current"] = data.version;
		// A collection with no admin values yet is at version 0: a row another tab made since is a conflict, not something to write over.
		for (const c of Object.keys(model.changedValues))
			if (data.schema.collections[c]) versions[`collectionAdminValues:${c}`] = data.adminValues[c]?.version ?? 0;
		const result = await saveOp.run(
			{
				...(siteChanged ? { site } : {}),
				...(structure
					? { locales: built.schema.locales, collections: built.schema.collections, renames: built.renames, answers }
					: {}),
				adminValues: model.changedValues,
			},
			{ versions, accepted: draft.accepted },
		);
		if (!result.ok) {
			setBusy(false);
			// Changed since this screen read it: in the review the sheet says so; outside it the line under the tabs does.
			if (result.refusal.status === 409) {
				if (plan) setConflict(true);
				else setRefused({ reason: t("settings.conflict"), action: "reload" });
			} else setRefused({ reason: refusal(result.refusal.reason), action: "save" });
			return;
		}
		const done = result.body.output.structure;
		if (done && !done.written) {
			// The schema file could not be written: the admin values are saved and leave the draft, the structure stays in it (doc 12).
			const fresh = await readOp.run();
			if (fresh.ok) draft.savedPart(flatten(fresh.body, model.catalog));
			await model.read.reload();
			setPlan(null);
			setRefused({ reason: t("settings.fileNotWritten"), action: "save" });
		} else {
			await model.read.reload();
			saved();
			setPlan(null);
			// Files saved but not applied: the frame's line over every screen says so, with "apply again" (flow 11, step 20).
			if (!done || done.applied) {
				const one = made.length === 1 ? made[0] : undefined;
				if (done && one)
					toast(t("settings.made", { name: model.label(one) }), {
						action: { label: t("settings.view"), onClick: () => onOpen({ collection: one }) },
					});
				else toast(done ? t("settings.applied") : t("settings.saved"));
			}
		}
		// The sidebar and the sign-in screen show the site's name.
		if (siteChanged) void session.reload();
		setBusy(false);
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
			setRefused({ reason: refusal(planned.refusal.reason), action: "save" });
			return;
		}
		// Nothing the review could ask about (the languages' order alone): saved like any value that needs no review.
		if (planned.body.changes.length === 0 && model.problems.length === 0) return send({});
		// The file changed after this screen read it (another tab, a hand edit): the review says so and cannot apply (flow 11, step 19).
		setConflict(fresh.ok && fresh.body.hash !== data.hash);
		setPlan(planned.body);
	};

	const handled = useRef(0);
	// biome-ignore lint/correctness/useExhaustiveDependencies: the banner's request opens the review once, when the settings have been read.
	useEffect(() => {
		if (!review || review === handled.current || !data) return;
		handled.current = review;
		void openReview();
	}, [review, data]);

	const save = () => (!locked && model.structureChanged ? openReview() : send({}));

	const remove = (c: string) => {
		const name = model.label(c);
		draft.set(at.collection(c), null);
		view.open(view.live.find((each) => each !== c) ?? null);
		view.setTab("fields");
		undoToasts.current.push(
			toast(t("settings.removed", { name }), {
				action: { label: t("settings.undo"), onClick: () => draft.revert(at.collection(c)) },
			}),
		);
	};

	/** Opens the place a path names: its tab, and in the collections tab its collection and field. */
	const goTo = (path: string) => {
		const place = placeOf(path);
		if (!place) return () => onTab(tabOf(path));
		if (!model.shown(at.collection(place.collection))) return undefined;
		return () => {
			onTab("collections");
			view.open(place.collection);
			if (place.kind === "field" || place.kind === "fieldValue") {
				view.setTab("fields");
				// A field that goes cannot be opened; its row in the list is where it is seen.
				if (model.shown(at.field(place.collection, place.key)))
					view.setFieldSheet({ collection: place.collection, key: place.key });
			} else if (place.kind === "editor") view.setTab("editor");
			else if (place.kind === "path" || (place.kind === "collectionValue" && place.value !== "layout"))
				view.setTab("basics");
			else view.setTab("fields");
		};
	};

	// The proposals the bubble walks: each place a pending item writes that a tab draws.
	const proposed = draft.proposals.flatMap(({ item, values }) =>
		Object.keys(values).flatMap((path): Walked[] => {
			if (draft.cell(path).kind !== "proposed") return [];
			const place = placeOf(path);
			if (!place) return [{ item, tab: tabOf(path), collection: null }];
			// Where the collections tab draws it: a name, an address or the folders on the basics, the editor's items on theirs, the rest on the fields.
			const inside =
				place.kind === "editor"
					? "editor"
					: place.kind === "path" || (place.kind === "collectionValue" && place.value !== "layout")
						? "basics"
						: "fields";
			return [{ item, tab: "collections", collection: place.collection, inside }];
		}),
	);
	// One stop for each place the tabs draw apart: a proposal that changes five labels of one collection is one stop on its fields.
	const stops = proposed.filter(
		(each, index) =>
			proposed.findIndex(
				(other) =>
					other.item.id === each.item.id &&
					other.tab === each.tab &&
					other.collection === each.collection &&
					other.inside === each.inside,
			) === index,
	);
	const show = (target: Walked | undefined) => {
		if (!target) return;
		onTab(target.tab);
		if (target.collection) {
			view.open(target.collection);
			view.setTab(target.inside ?? "fields");
		}
	};
	const walking = stops[Math.min(position, stops.length - 1)];
	const step = (by: number) => {
		const next = (position + by + stops.length) % stops.length;
		setPosition(next);
		show(stops[next]);
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
						for (const path of row.paths) {
							if (path.startsWith("locale:")) model.revertLocale(path.slice(7));
							else draft.revert(path);
						}
					},
				}))}
				undoLabel={t("settings.undo")}
				discardLabel={t("settings.undoAll")}
				onDiscard={draft.revertAll}
				saveLabel={locked ? t("settings.save") : t("settings.saveApply")}
				onSave={() => void save()}
				// Not greyed while the save is on its way: the pill says what it is doing (README principle 7).
				saving={busy ? t("ui.saving") : undefined}
				proposals={
					draft.proposals.length > 0
						? {
								label: t("settings.proposals"),
								countLabel: t("settings.proposalsCount", { count: draft.proposals.length }),
								discardLabel: t("settings.discard"),
								items: draft.proposals.map(({ item }) => {
									const first = stops.find((each) => each.item.id === item.id);
									return {
										id: item.id,
										name: item.request,
										onOpen: first ? () => show(first) : undefined,
										onDiscard: () => void draft.discard(item.id),
									};
								}),
							}
						: undefined
				}
			/>
		) : null;

	const retry = () => {
		if (refused?.action === "reload") {
			setRefused(null);
			void model.read.reload();
		} else void save();
	};

	return (
		<Inline align="stretch" gap={0} grow minHeight={0}>
			<Stack gap={0} grow minWidth={0} minHeight={0} container>
				<PageColumn>
					<PageHeader title={t("settings.title")}>{saveGroup}</PageHeader>
					<PageToolbar>
						<TabLinks variant="toolbar">
							{SETTINGS_TABS.map((each) => (
								<TabLink
									key={each}
									current={each === tab}
									// The open tab's changes are on the page and in the save group: only the others carry a dot (settings.md).
									dot={each === tab || each === "admin" ? undefined : model.marks[each]}
									dotLabel={
										each === tab || each === "admin" || !model.marks[each]
											? undefined
											: t(model.marks[each] === "proposal" ? "settings.proposals" : "settings.changed")
									}
									{...linkTo({ screen: "settings", tab: each }, () => onTab(each))}
								>
									{t(`settings.tab.${each}`)}
								</TabLink>
							))}
						</TabLinks>
					</PageToolbar>
					<PageBody>
						{/* Drawn at the very top of the screen, over the title (common.md, banners). */}
						<PageBanner>
							{refused && !plan ? (
								<Banner tone="danger" title={refused.reason}>
									<TextButton loading={busy} onClick={retry}>
										{t(refused.action === "reload" ? "settings.reload" : "settings.saveAgain")}
									</TextButton>
								</Banner>
							) : null}
						</PageBanner>
						{!data ? null : tab === "site" ? (
							<SiteTab model={model} />
						) : tab === "languages" ? (
							<LocalesTab model={model} />
						) : tab === "collections" ? (
							<CollectionsTab model={model} view={view} onRemove={remove} />
						) : (
							<AdminTab failed={preferenceFailed} onFailed={setPreferenceFailed} />
						)}
						{walking ? (
							<ProposalBubbleDock>
								<ProposalBubble
									name={walking.item.request}
									position={Math.min(position, stops.length - 1) + 1}
									total={stops.length}
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
				</PageColumn>
			</Stack>
			{previewing && view.current ? (
				<PreviewPanel model={model} collection={view.current} onClose={() => view.setPreview(false)} />
			) : null}
			<ReviewSheet
				model={model}
				plan={plan}
				conflict={conflict}
				refused={plan ? (refused?.reason ?? null) : null}
				applying={busy}
				onReload={() => {
					setPlan(null);
					void model.read.reload();
				}}
				onClose={() => setPlan(null)}
				onApply={(answers) => void send(answers)}
				onOpenLanguages={() => {
					setPlan(null);
					onTab("languages");
				}}
				onOpenAddress={(c, place) => {
					setPlan(null);
					onTab("collections");
					view.open(c);
					view.setTab("basics");
					view.setAttention(place);
				}}
				onOpenField={(c, key) => {
					setPlan(null);
					onTab("collections");
					view.open(c);
					view.setTab("fields");
					view.setFieldSheet({ collection: c, key });
				}}
			/>
		</Inline>
	);
}
