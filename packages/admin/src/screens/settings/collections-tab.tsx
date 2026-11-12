import { Button, NavLink, PageToolbar, PageToolbarEnd, RailAction, RailLayout, TabLink, TabLinks } from "@monti-cms/ui";
import { useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { BasicsTab } from "./basics-tab";
import { EditorTab } from "./editor-tab";
import { FieldSheet, type FieldSheetOpen } from "./field-sheet";
import { FieldsTab } from "./fields-tab";
import { NewCollectionSheet } from "./new-collection-sheet";
import { at } from "./schema-draft";
import type { SettingsDraft } from "./use-settings-draft";

type Tab = "basics" | "fields" | "editor";

/**
 * What the collections tab has open: the collection, its tab, a field's sheet, the preview. The settings screen holds it, because a row of the
 * changes list, a line of the review and the proposal bubble all open a place in here from outside the tab.
 */
export function useCollectionsView(model: SettingsDraft) {
	const [active, setActive] = useState<string | null>(null);
	const [tab, setTab] = useState<Tab>("fields");
	const [folderTab, setFolderTab] = useState(0);
	const [preview, setPreview] = useState(false);
	const [fieldSheet, setFieldSheet] = useState<FieldSheetOpen | null>(null);
	const [making, setMaking] = useState(false);
	const live = model.collections.filter((c) => model.shown(at.collection(c)));
	const current = active && live.includes(active) ? active : (live[0] ?? null);
	const kind = current ? (model.shown(at.collection(current)) as { kind: "document" | "item" }).kind : "document";
	const shownTab: Tab = tab === "editor" && kind !== "document" ? "fields" : tab;
	return {
		live,
		current,
		kind,
		tab: shownTab,
		setTab,
		folderTab,
		setFolderTab,
		preview,
		setPreview,
		fieldSheet,
		setFieldSheet,
		making,
		setMaking,
		/** Opens a collection at its first property tab. */
		open: (c: string | null) => {
			setActive(c);
			setFolderTab(0);
		},
	};
}

export type CollectionsView = ReturnType<typeof useCollectionsView>;

/**
 * Settings › collections (doc 01, flows 4 and 11): the collections beside one collection's tabs (basics, fields, editor). It changes the settings'
 * one draft (docs 05 and 12); the save, the review and the changes list are the settings screen's.
 */
export function CollectionsTab({
	model,
	view,
	onRemove,
}: {
	model: SettingsDraft;
	view: CollectionsView;
	/** Takes a collection out of the draft (the basics tab's delete). */
	onRemove: (collection: string) => void;
}) {
	const { t } = useAdmin();
	const { draft, rows } = model;
	const { current, kind, tab } = view;
	const fieldCount = current ? model.fields(current).filter((key) => draft.value(at.field(current, key))).length : 0;
	const changedCollection = (c: string) => rows.some((row) => row.collection === c);
	return (
		<>
			<RailLayout
				label={t("settings.collections")}
				rail={
					<>
						{view.live.map((c) => (
							<NavLink
								key={c}
								active={c === current}
								note={c}
								dot={changedCollection(c) ? t("settings.changed") : undefined}
								onSelect={() => view.open(c)}
							>
								{model.label(c)}
							</NavLink>
						))}
						{model.locked ? null : (
							<RailAction onClick={() => view.setMaking(true)}>{t("settings.newCollection")}</RailAction>
						)}
					</>
				}
			>
				{current ? (
					<>
						<PageToolbar>
							<TabLinks variant="toolbar">
								<TabLink
									current={tab === "basics"}
									render={<button type="button" />}
									onClick={() => view.setTab("basics")}
								>
									{t("settings.tab.basics")}
								</TabLink>
								<TabLink
									current={tab === "fields"}
									count={String(fieldCount)}
									render={<button type="button" />}
									onClick={() => view.setTab("fields")}
								>
									{t("settings.tab.fields")}
								</TabLink>
								{kind === "document" ? (
									<TabLink
										current={tab === "editor"}
										render={<button type="button" />}
										onClick={() => view.setTab("editor")}
									>
										{t("settings.tab.editor")}
									</TabLink>
								) : null}
							</TabLinks>
							{tab === "fields" ? (
								<PageToolbarEnd>
									<Button
										variant="ghost"
										size="sm"
										aria-pressed={view.preview}
										onClick={() => view.setPreview(!view.preview)}
									>
										{t("settings.preview.button")}
									</Button>
								</PageToolbarEnd>
							) : null}
						</PageToolbar>
						{tab === "fields" ? (
							<FieldsTab
								model={model}
								collection={current}
								tab={view.folderTab}
								onTab={view.setFolderTab}
								onOpenField={(key) => view.setFieldSheet({ collection: current, key })}
								onAddField={() => view.setFieldSheet({ collection: current, key: null })}
							/>
						) : tab === "basics" ? (
							<BasicsTab model={model} collection={current} onDelete={() => onRemove(current)} />
						) : (
							<EditorTab model={model} collection={current} />
						)}
					</>
				) : null}
			</RailLayout>
			<FieldSheet model={model} open={view.fieldSheet} onClose={() => view.setFieldSheet(null)} />
			<NewCollectionSheet
				model={model}
				open={view.making}
				onClose={() => view.setMaking(false)}
				onMade={(c) => {
					view.setMaking(false);
					view.open(c);
					view.setTab("fields");
				}}
			/>
		</>
	);
}
