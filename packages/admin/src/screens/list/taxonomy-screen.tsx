import type { UsageItem, UsageResult } from "@monti-cms/core";
import {
	BulkBar,
	Button,
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuLabel,
	ContextMenuSeparator,
	ContextMenuTrigger,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	FormField,
	FormFieldError,
	FormFieldLabel,
	FormFieldWas,
	IconButton,
	Inline,
	Input,
	LIST_COLUMN_SIZE,
	ListHead,
	type ListHeadColumn,
	ListScroll,
	PageColumn,
	PageHeader,
	ProposalBubble,
	ProposalBubbleDock,
	RowActions,
	RowCheck,
	RowLink,
	RowMore,
	RowTitle,
	SearchToggle,
	SidePanel,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Tabs,
	TabsList,
	TabsTrigger,
	Text,
	Textarea,
	TextButton,
	toast,
} from "@monti-cms/ui";
import { Add, Edit, List, Merge, OverflowMenuHorizontal, TrashCan } from "@monti-cms/ui/icons";
import { useMemo, useRef, useState } from "react";
import { useAdmin } from "../../operations/admin-context";
import { reasonOf, useRead } from "../../operations/use-operation";
import { linkTo, type Route } from "../../route";
import { useTrashMove } from "../../trash/use-trash";
import { useCoverCorner } from "../frame/admin-frame";
import { useLanguageName } from "./column-menu";
import { ValueRow } from "./filter-rows";
import { MergeDialog } from "./merge-dialog";
import { NoMatchRow } from "./no-match-row";
import { SortRows } from "./sort-rows";
import { useColumnWidths } from "./use-column-widths";
import { useItemPanel } from "./use-item-panel";

type SchemaRead = {
	schema: {
		collections: Record<string, { path?: string; kind: "document" | "item" }>;
		locales: { list: { code: string }[]; source: string };
	};
	adminValues: Record<string, { label?: string }>;
};

type SortMode = "name" | "usage";

function TaxonomySidePanel({
	collection,
	collectionName,
	group,
	item,
	locales,
	sourceLocale,
	isMultilingual,
	hasPublicPage,
	onClose,
	onMerge,
	onTrash,
	onSaved,
}: {
	collection: string;
	collectionName: string;
	group: string;
	item?: UsageItem | null;
	locales: string[];
	sourceLocale: string;
	isMultilingual: boolean;
	hasPublicPage: boolean;
	onClose: () => void;
	onMerge: () => void;
	onTrash: () => void;
	onSaved: (savedGroup: string) => void;
}) {
	const { t } = useAdmin();
	const languageName = useLanguageName();
	const [activeLocale, setActiveLocale] = useState(sourceLocale);
	const [proposalIndex, setProposalIndex] = useState(0);
	/**
	 * Save was pressed with no name in any language (README principle 7: the button is never greyed): the name field says so while that item is open and still
	 * has none. Another item, a name, or dropping the changes takes it away.
	 */
	const [saveAsked, setSaveAsked] = useState(false);
	const nameInput = useRef<HTMLInputElement>(null);
	/** The address the save was refused for, and why; it goes once the address is changed or another item opens. */
	const [slugRefused, setSlugRefused] = useState<{ slug: string; reason: string } | null>(null);
	const slugInput = useRef<HTMLInputElement>(null);
	const [askedIn, setAskedIn] = useState(group);
	if (askedIn !== group) {
		setAskedIn(group);
		setSaveAsked(false);
		setSlugRefused(null);
	}

	const panel = useItemPanel({
		collection,
		group,
		item,
		locales,
		sourceLocale,
		onSaved,
	});
	const nameMissing = saveAsked && !panel.named;

	const title = item?.title || t("taxonomy.newItem", { label: collectionName });
	const titlePath = `locales.${activeLocale}.title`;
	const slugPath = `locales.${activeLocale}.slug`;
	const descPath = `locales.${activeLocale}.description`;

	const shownValue = (path: string) => {
		const c = panel.draft.cell(path);
		if (c.kind === "proposed") return String(c.value ?? "");
		return String(panel.draft.value(path) ?? "");
	};

	const slugError = slugRefused && slugRefused.slug === shownValue(slugPath) ? slugRefused.reason : null;

	const labelChanged = (path: string) => {
		const c = panel.draft.cell(path);
		if (c.kind === "mine") {
			return {
				label: t("settings.changed"),
				undoLabel: t("settings.undo"),
				onUndo: () => panel.draft.revert(path),
			};
		}
		if (c.kind === "proposed") {
			return {
				label: t("ui.proposal"),
				undoLabel: t("settings.discard"),
				tone: "proposal" as const,
				onUndo: () => void panel.draft.discard(c.item.id),
			};
		}
		return undefined;
	};

	const wasLine = (path: string) => {
		const c = panel.draft.cell(path);
		if (c.kind !== "proposed") return null;
		const before = String(panel.draft.value(path) ?? "");
		return before ? <FormFieldWas>{before}</FormFieldWas> : null;
	};

	// Only what this panel draws: a proposal that changes none of its fields (the item's way to the trash) is on the conversation's card.
	const activeProposals = panel.draft.drawn;
	const currentProposal = activeProposals[Math.min(proposalIndex, Math.max(0, activeProposals.length - 1))];

	return (
		<SidePanel
			title={title}
			closable
			onClose={onClose}
			actions={
				item ? (
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<IconButton label={t("list.more")}>
									<OverflowMenuHorizontal aria-hidden />
								</IconButton>
							}
						/>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={onMerge}>
								<Merge aria-hidden />
								{t("taxonomy.mergeWith")}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem variant="danger" onClick={onTrash}>
								<TrashCan aria-hidden />
								{t("trash.toTrash")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : undefined
			}
			footer={
				panel.draft.dirty || group === "__new__" ? (
					<Inline justify="between" align="center" grow>
						<Text variant="note" tone="subtle">
							{t("taxonomy.changesCount", { count: panel.draft.changes.length || 1 })}
						</Text>
						<Inline gap={8}>
							<Button
								variant="secondary"
								size="md"
								onClick={() => {
									setSaveAsked(false);
									panel.draft.revertAll();
								}}
							>
								{t("common.discard")}
							</Button>
							<Button
								variant="primary"
								size="md"
								loading={panel.saving}
								onClick={async () => {
									if (!panel.named) {
										setSaveAsked(true);
										nameInput.current?.focus();
										return;
									}
									const res = await panel.save();
									// Saved: the panel's own line says so, no toast repeats it (status.md). Refused: the field that caused it says why under
									// itself (an address a deleted item had), anything else in a toast.
									if (res.ok) return;
									if (res.refusal.reason?.key === "items.pathKept") {
										setSlugRefused({ slug: shownValue(slugPath), reason: t(res.refusal.reason) });
										slugInput.current?.focus();
									} else toast.error(t(reasonOf(res.refusal)));
								}}
							>
								{t("common.save")}
							</Button>
						</Inline>
					</Inline>
				) : undefined
			}
		>
			{isMultilingual && (
				<Tabs value={activeLocale} onValueChange={(val) => setActiveLocale(val as string)}>
					<TabsList variant="line">
						{locales.map((code) => (
							<TabsTrigger key={code} value={code}>
								{languageName(code)}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			)}
			<FormField>
				<FormFieldLabel htmlFor="item-title" changed={labelChanged(titlePath)}>
					{t("taxonomy.field.name")}
				</FormFieldLabel>
				<Input
					ref={nameInput}
					id="item-title"
					size="md"
					proposal={panel.draft.cell(titlePath).kind === "proposed"}
					value={shownValue(titlePath)}
					aria-invalid={nameMissing || undefined}
					onChange={(e) => panel.draft.set(titlePath, e.target.value)}
				/>
				{nameMissing && <FormFieldError>{t("settings.fillIn")}</FormFieldError>}
				{wasLine(titlePath)}
			</FormField>
			<FormField>
				<FormFieldLabel htmlFor="item-slug" changed={labelChanged(slugPath)}>
					{t(hasPublicPage ? "taxonomy.field.slug" : "taxonomy.field.identifier")}
				</FormFieldLabel>
				<Input
					ref={slugInput}
					id="item-slug"
					size="md"
					mono
					proposal={panel.draft.cell(slugPath).kind === "proposed"}
					value={shownValue(slugPath)}
					aria-invalid={slugError ? true : undefined}
					onChange={(e) => panel.draft.set(slugPath, e.target.value)}
				/>
				{slugError && <FormFieldError>{slugError}</FormFieldError>}
				{wasLine(slugPath)}
			</FormField>
			<FormField>
				<FormFieldLabel htmlFor="item-description" changed={labelChanged(descPath)}>
					{t("taxonomy.field.description")}
				</FormFieldLabel>
				<Textarea
					id="item-description"
					size="md"
					rows={2}
					proposal={panel.draft.cell(descPath).kind === "proposed"}
					value={shownValue(descPath)}
					onChange={(e) => panel.draft.set(descPath, e.target.value)}
				/>
				{wasLine(descPath)}
			</FormField>
			{currentProposal && (
				<ProposalBubbleDock>
					<ProposalBubble
						name={currentProposal.item.request}
						position={Math.min(proposalIndex, activeProposals.length - 1) + 1}
						total={activeProposals.length}
						previousLabel={t("bubble.previous")}
						nextLabel={t("bubble.next")}
						onPrevious={() => setProposalIndex((i) => (i - 1 + activeProposals.length) % activeProposals.length)}
						onNext={() => setProposalIndex((i) => (i + 1) % activeProposals.length)}
						discardAllLabel={t("bubble.discardAll")}
						acceptAllLabel={t("bubble.acceptAll")}
						onDiscardAll={() => void panel.draft.discardDrawn()}
						onAcceptAll={() => panel.draft.acceptDrawn()}
					/>
				</ProposalBubbleDock>
			)}
		</SidePanel>
	);
}

/**
 * Screen for taxonomy (item) collections like category and tag (doc 08, screens/taxonomy.md, flow 7).
 * Uses the document list's table structure for item names, usage counts, selection,
 * side panel editing across all languages, and item merging.
 */
export function TaxonomyScreen({
	collection,
	go,
}: {
	collection: string;
	params: URLSearchParams;
	go: (route: Route) => void;
}) {
	const { t, language } = useAdmin();
	const languageName = useLanguageName();
	const schema = useRead<SchemaRead>("schema.read", {});
	const usage = useRead<UsageResult>("relations.usage", { collection, locale: language }, { afterWrites: true });
	const [search, setSearch] = useState("");
	const [openGroup, setOpenGroup] = useState<string | null>(null);
	const [filterUnused, setFilterUnused] = useState(false);
	const [sort, setSort] = useState<{ by: SortMode; dir: "asc" | "desc" }>({ by: "name", dir: "asc" });
	const { sized, resize } = useColumnWidths(`items:${collection}`);
	const [picked, setPicked] = useState<Set<string>>(new Set());
	const [mergeGroups, setMergeGroups] = useState<string[] | null>(null);

	useCoverCorner(openGroup !== null);
	const trash = useTrashMove();

	const collectionName = schema.data?.adminValues[collection]?.label ?? collection;
	const path = schema.data?.schema.collections[collection]?.path;
	const locales = useMemo(
		() => schema.data?.schema.locales.list.map((l) => l.code) ?? ["ko"],
		[schema.data?.schema.locales.list],
	);
	const sourceLocale = schema.data?.schema.locales.source ?? "ko";
	const isMultilingual = (schema.data?.schema.locales.list.length ?? 0) > 1;

	const allItems = usage.data?.items ?? [];
	const unusedCount = useMemo(() => allItems.filter((i) => i.usageCount === 0).length, [allItems]);

	const filteredItems = useMemo(() => {
		let list = allItems;
		if (filterUnused) {
			list = list.filter((i) => i.usageCount === 0);
		}
		const q = search.trim().toLowerCase();
		if (q) {
			list = list.filter(
				(i) =>
					i.title.toLowerCase().includes(q) ||
					Object.values(i.locales).some((l) => l.title.toLowerCase().includes(q) || l.slug.toLowerCase().includes(q)),
			);
		}
		const way = sort.dir === "asc" ? 1 : -1;
		return [...list].sort(
			(a, b) => way * (sort.by === "usage" ? a.usageCount - b.usageCount : a.title.localeCompare(b.title, language)),
		);
	}, [allItems, filterUnused, search, sort, language]);

	const currentItem = useMemo(() => {
		if (!openGroup || openGroup === "__new__") return null;
		return allItems.find((i) => i.group === openGroup) ?? null;
	}, [allItems, openGroup]);

	/** Items to the trash (doc 11): every language of each goes; it asks first when published entries point at one. */
	const trashItems = (list: UsageItem[]) =>
		void trash.start({
			rows: list.flatMap((item) => {
				const id = (item.locales[sourceLocale] ?? Object.values(item.locales)[0])?.id;
				return id ? [{ kind: "entry" as const, id }] : [];
			}),
			item: collectionName,
			onMoved: () => {
				setPicked(new Set());
				if (list.some((item) => item.group === openGroup)) setOpenGroup(null);
			},
		});

	const togglePick = (group: string, checked: boolean) => {
		setPicked((prev) => {
			const next = new Set(prev);
			if (checked) next.add(group);
			else next.delete(group);
			return next;
		});
	};

	/** The list of the entries that use an item: the first collection that points at it, filtered by it. */
	const usageRoute = (item: UsageItem): Route => ({
		screen: "list",
		collection: item.firstRef?.collection ?? "post",
		params: new URLSearchParams([[item.firstRef?.field ?? collection, item.group]]),
	});
	const onFilterUsage = (item: UsageItem) => go(usageRoute(item));
	/** One item's menu, the same from its ⋯ and from a right click (menu.md, row menu). */
	const menuItems = (item: UsageItem, context: boolean) => {
		const Item = context ? ContextMenuItem : DropdownMenuItem;
		const Separator = context ? ContextMenuSeparator : DropdownMenuSeparator;
		return (
			<>
				<Item onClick={() => setOpenGroup(item.group)}>
					<Edit aria-hidden />
					{t("taxonomy.edit")}
				</Item>
				<Item onClick={() => setMergeGroups([item.group])}>
					<Merge aria-hidden />
					{t("taxonomy.mergeWith")}
				</Item>
				{item.firstRef && item.usageCount > 0 && (
					<Item onClick={() => onFilterUsage(item)}>
						<List aria-hidden />
						{t("taxonomy.viewUsage")}
					</Item>
				)}
				<Separator />
				<Item variant="danger" onClick={() => trashItems([item])}>
					<TrashCan aria-hidden />
					{t("trash.toTrash")}
				</Item>
			</>
		);
	};
	/** A right click on one of several picked items: the bulk bar's actions, by the same names, without icons. */
	const pickedMenuItems = () => (
		<>
			<ContextMenuGroup>
				<ContextMenuLabel>{t("list.items", { count: picked.size })}</ContextMenuLabel>
			</ContextMenuGroup>
			<ContextMenuItem onClick={() => setMergeGroups([...picked])}>{t("taxonomy.merge")}</ContextMenuItem>
			<ContextMenuSeparator />
			<ContextMenuItem variant="danger" onClick={() => trashItems(allItems.filter((one) => picked.has(one.group)))}>
				{t("trash.toTrash")}
			</ContextMenuItem>
		</>
	);

	const selectAll = {
		state:
			picked.size === 0
				? ("none" as const)
				: picked.size === filteredItems.length
					? ("all" as const)
					: ("some" as const),
		label: t("list.selectAll"),
		onChange: (on: boolean) => setPicked(new Set(on ? filteredItems.map((item) => item.group) : [])),
	};
	const sortRows = (by: SortMode) => (
		<SortRows dir={sort.by === by ? sort.dir : null} onChange={(dir) => setSort({ by, dir })} />
	);
	const head: ListHeadColumn[] = [
		{
			id: "name",
			label: t("taxonomy.column.name"),
			sort: sort.by === "name" ? sort.dir : undefined,
			menu: sortRows("name"),
		},
		{
			...sized("usage", LIST_COLUMN_SIZE.one),
			label: t("taxonomy.column.usage"),
			align: "end",
			sort: sort.by === "usage" ? sort.dir : undefined,
			filtered: filterUnused,
			menu: (
				<>
					{sortRows("usage")}
					<DropdownMenuSeparator />
					<ValueRow
						checked={filterUnused}
						onToggle={() => setFilterUnused(!filterUnused)}
						label={t("taxonomy.unusedFilter")}
						counted={unusedCount}
					/>
				</>
			),
		},
	];

	return (
		<Inline align="stretch" gap={0} grow minHeight={0}>
			{trash.dialog}
			<PageColumn width="list">
				<PageHeader title={collectionName} meta={path}>
					<SearchToggle
						label={t("list.search")}
						value={search}
						aria-label={t("list.search")}
						placeholder={t("taxonomy.searchPlaceholder")}
						onValueChange={setSearch}
					/>
					<Button variant="secondary" onClick={() => setOpenGroup("__new__")}>
						<Add aria-hidden />
						{t("taxonomy.add", { label: collectionName })}
					</Button>
				</PageHeader>
				<ListScroll>
					<Table container="none" layout="fixed" columns={[...head.map((column) => column.size), LIST_COLUMN_SIZE.end]}>
						{picked.size === 0 ? (
							<ListHead
								columns={head}
								end={LIST_COLUMN_SIZE.end}
								selectAll={filteredItems.length > 0 ? selectAll : undefined}
								onResize={resize}
								resizeLabel={(column) => t("list.resizeColumn", { column })}
							/>
						) : (
							<BulkBar
								label={t("list.selected", { count: picked.size })}
								selectAll={selectAll}
								clearLabel={t("list.clearSelection")}
								onClear={() => setPicked(new Set())}
								colSpan={3}
							>
								{picked.size >= 2 && (
									<TextButton onClick={() => setMergeGroups([...picked])}>{t("taxonomy.merge")}</TextButton>
								)}
								<TextButton onClick={() => trashItems(allItems.filter((item) => picked.has(item.group)))}>
									{t("trash.toTrash")}
								</TextButton>
							</BulkBar>
						)}
						<TableBody>
							{allItems.length > 0 && filteredItems.length === 0 && (search.trim() || filterUnused) && (
								<NoMatchRow
									colSpan={3}
									words={t("taxonomy.noMatch")}
									onClear={() => {
										setSearch("");
										setFilterUnused(false);
									}}
								/>
							)}
							{filteredItems.map((item) => {
								const missingLocale = item.missingLocales[0];
								const hasMissing = Boolean(isMultilingual && missingLocale);
								const slug = item.locales[language]?.slug;
								const shownAddress = slug || undefined;
								const missing = hasMissing
									? t("taxonomy.missingLocale", { locale: languageName(missingLocale) })
									: undefined;

								const line = (
									<TableRow selected={openGroup === item.group || picked.has(item.group)}>
										<TableCell truncate>
											<RowCheck
												checked={picked.has(item.group)}
												onCheckedChange={(checked) => togglePick(item.group, checked)}
												label={t("taxonomy.pick", { title: item.title })}
											/>
											<RowTitle
												title={
													<RowLink render={<button type="button" />} onClick={() => setOpenGroup(item.group)}>
														{item.title || t("list.untitled")}
													</RowLink>
												}
												address={shownAddress}
												// A language that has no name yet is said in words, in the warning's color (tokens.md: mono only for an address).
												note={
													missing ? (
														<Text variant="caption" tone="warning">
															{missing}
														</Text>
													) : undefined
												}
												addressTitle={[shownAddress, missing].filter(Boolean).join(" · ") || undefined}
											/>
										</TableCell>
										<TableCell
											align="end"
											truncate
											title={
												item.usageCount > 0
													? t("taxonomy.usageCount", { count: item.usageCount })
													: t("taxonomy.unused")
											}
										>
											{item.usageCount > 0 ? (
												// A link, as the map has it: it opens in a new tab too, and a narrowed cell cuts its words with "…".
												<TextButton variant="underline" size="note" {...linkTo(usageRoute(item), go)}>
													{t("taxonomy.usageCount", { count: item.usageCount })}
												</TextButton>
											) : (
												<Text variant="note" tone="faint">
													{t("taxonomy.unused")}
												</Text>
											)}
										</TableCell>
										<TableCell align="end">
											<RowActions>
												<DropdownMenu>
													<RowMore
														label={t("list.more")}
														trigger={(button) => <DropdownMenuTrigger render={button} />}
													/>
													<DropdownMenuContent align="end">{menuItems(item, false)} </DropdownMenuContent>
												</DropdownMenu>
											</RowActions>
										</TableCell>
									</TableRow>
								);
								// A right click opens the row's ⋯ rows; on one of several picked rows, what the bulk bar does (menu.md, row menu).
								const several = picked.has(item.group) && picked.size > 1;
								return (
									<ContextMenu key={item.group}>
										<ContextMenuTrigger render={line} />
										<ContextMenuContent>{several ? pickedMenuItems() : menuItems(item, true)}</ContextMenuContent>
									</ContextMenu>
								);
							})}
						</TableBody>
					</Table>
				</ListScroll>
			</PageColumn>
			{openGroup !== null && (
				<TaxonomySidePanel
					collection={collection}
					collectionName={collectionName}
					group={openGroup}
					item={currentItem}
					locales={locales}
					sourceLocale={sourceLocale}
					isMultilingual={isMultilingual}
					hasPublicPage={path !== undefined}
					onClose={() => setOpenGroup(null)}
					onMerge={() => currentItem && setMergeGroups([currentItem.group])}
					onTrash={() => currentItem && trashItems([currentItem])}
					onSaved={(newGroup) => {
						if (openGroup === "__new__") setOpenGroup(newGroup);
					}}
				/>
			)}
			{mergeGroups !== null && (
				<MergeDialog
					collection={collection}
					collectionLabel={collectionName}
					collectionPath={path}
					groups={mergeGroups}
					items={allItems}
					open
					onClose={() => setMergeGroups(null)}
					onMerged={() => {
						setPicked(new Set());
						setMergeGroups(null);
					}}
				/>
			)}
		</Inline>
	);
}
