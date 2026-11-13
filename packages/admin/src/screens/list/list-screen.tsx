import type { BackupOutput, ListColumn, ListRow } from "@monti-cms/core";
import {
	BulkBar,
	Caret,
	Chip,
	ContextMenu,
	ContextMenuContent,
	ContextMenuTrigger,
	Count,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
	Empty,
	EmptyStep,
	EntryStatus,
	Image,
	Inline,
	LIST_COLUMN_SIZE,
	ListFooter,
	ListHead,
	type ListHeadColumn,
	ListScroll,
	LocaleCodes,
	PageColumn,
	PageHeader,
	PageSizeMenu,
	PageToolbar,
	RenameField,
	RowActions,
	RowCheck,
	RowLink,
	RowMore,
	RowThumb,
	RowTitle,
	SearchToggle,
	type SelectAll,
	SplitButton,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
	TextButton,
	toast,
} from "@monti-cms/ui";
import { FolderAdd, Template, Upload } from "@monti-cms/ui/icons";
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useRequest, useScreenContext } from "../../assistant/use-assistant";
import { useImport } from "../../data/use-import";
import { saveBackup } from "../../download";
import { chooseFiles } from "../../media/choose-files";
import { useAdmin } from "../../operations/admin-context";
import { reasonOf, useOperation, useRead } from "../../operations/use-operation";
import { href, type Route } from "../../route";
import { useTrashMove } from "../../trash/use-trash";
import { ColumnMenu, useLanguageName } from "./column-menu";
import {
	FolderMenuItems,
	FolderTargets,
	MoveToFolderMenu,
	searchScopes,
	useFolderNaming,
	useFolders,
	useRemoveFolder,
} from "./folders";
import { endsClosed, fieldCell, shortDate, widthsAfter } from "./format";
import { ImportSheet } from "./import-sheet";
import { ListPages } from "./list-pages";
import { filterColumn, headOf, type ListState, readState, toQuery, withFilter, writeState } from "./list-query";
import { NoMatchRow } from "./no-match-row";
import { RelationSubmenu } from "./relations-menu";
import { type RowActions as Actions, allArchived, publishable, RowMenuItems, RowsMenuItems } from "./row-menu";
import { TaxonomyScreen } from "./taxonomy-screen";
import { useSearchWords } from "./use-search-words";

type Columns = { columns: ListColumn[]; pageSize: number };
type Page = { rows: ListRow[]; total: number };
type SchemaRead = {
	schema: { collections: Record<string, { path?: string; kind: "document" | "item" }> };
	adminValues: Record<string, { label?: string; folders?: boolean }>;
};
/** A picked row; `proposal` while the assistant picked it and the admin has not touched it (`list.select`). */
type Picked = Map<string, { proposal: boolean }>;

/** The width a column starts at by its kind (doc 06; the title takes the rest). */
function kindSizeOf(column: ListColumn): number | undefined {
	switch (column.kind) {
		case "status":
			return LIST_COLUMN_SIZE.status;
		case "title":
			return undefined;
		case "locale":
			return LIST_COLUMN_SIZE.locale;
		case "date":
			return LIST_COLUMN_SIZE.date;
		case "text":
			return LIST_COLUMN_SIZE.many;
		default:
			return column.many ? LIST_COLUMN_SIZE.many : LIST_COLUMN_SIZE.one;
	}
}

/** The admin's words for the system columns; a field's column has its label from the admin values. */
function useColumnLabel() {
	const { t } = useAdmin();
	const names: Record<string, string> = {
		status: t("list.column.status"),
		title: t("list.column.title"),
		locale: t("list.column.locale"),
		updatedAt: t("list.column.updatedAt"),
		publishedAt: t("list.column.publishedAt"),
		createdAt: t("list.column.createdAt"),
	};
	return (column: ListColumn) => names[column.id] ?? column.label ?? column.id;
}

/**
 * A collection's list (doc 06): one query in the address drives the rows, the column menus' counts and the pages. Every collection is drawn by this
 * same code; only its columns, which come from its schema, differ (06-2).
 */
export function ListScreen(props: {
	collection: string;
	params: URLSearchParams;
	/** How many entries the collection has (the sidebar's count): none at all shows the empty list instead of a table. */
	count: number | undefined;
	go: (route: Route, options?: { replace?: boolean }) => void;
}) {
	const schema = useRead<SchemaRead>("schema.read");
	if (schema.data?.schema.collections[props.collection]?.kind === "item") {
		return <TaxonomyScreen collection={props.collection} params={props.params} go={props.go} />;
	}
	return <DocumentListScreen {...props} />;
}

function DocumentListScreen({
	collection,
	params,
	count,
	go,
}: {
	collection: string;
	params: URLSearchParams;
	/** How many entries the collection has (the sidebar's count): none at all shows the empty list instead of a table. */
	count: number | undefined;
	go: (route: Route, options?: { replace?: boolean }) => void;
}) {
	const { t, language, screen, templates: templatesOn } = useAdmin();
	const label = useColumnLabel();
	const languageName = useLanguageName();
	const schema = useRead<SchemaRead>("schema.read");
	const columnsRead = useRead<Columns>("list.columns", { collection }, { afterWrites: true });
	const columns = columnsRead.data?.columns ?? null;
	const pageSize = columnsRead.data?.pageSize ?? 25;
	const state = useMemo(() => readState(params, columns ?? []), [params, columns]);
	// Folders (doc 07): on when the collection uses them (its admin value); the list then shows one folder at a time.
	const foldersOn = schema.data?.adminValues[collection]?.folders === true;
	const folders = useFolders({ collection }, foldersOn);
	const openFolder = foldersOn && state.folder ? (folders.byId.get(state.folder) ?? null) : null;
	const query = useMemo(
		() => toQuery(collection, state, pageSize, foldersOn),
		[collection, state, pageSize, foldersOn],
	);
	const page = useRead<Page>("entries.query", columns ? query : { collection, pageSize: 1 }, { afterWrites: true });
	const rows = columns ? (page.data?.rows ?? null) : null;
	const total = page.data?.total ?? 0;
	const templates = useRead<{ id: string; name: string }[]>("templates.list");

	const setState = (next: ListState, options?: { replace?: boolean }) =>
		go({ screen: "list", collection, params: writeState(next) }, options);

	// Emptied, the box starts over on the open folder.
	const box = useSearchWords(state.search.text, (text) =>
		setState(
			{
				...state,
				page: 1,
				search: { ...state.search, text },
				everywhere: text.trim() === "" ? false : state.everywhere,
			},
			{ replace: true },
		),
	);

	// Picked rows belong to the page they were picked on.
	const [picked, setPicked] = useState<Picked>(new Map());
	const pageKey = JSON.stringify(query);
	const [pickedOn, setPickedOn] = useState(pageKey);
	if (pickedOn !== pageKey) {
		setPickedOn(pageKey);
		setPicked(new Map());
	}
	const latestRows = useRef(rows);
	latestRows.current = rows;
	useEffect(
		() =>
			screen.on("list.select", (input) => {
				const ids = new Set((input as { ids: string[] }).ids);
				const onPage = (latestRows.current ?? []).filter((row) => ids.has(row.id));
				setPicked(new Map(onPage.map((row) => [row.id, { proposal: true }])));
			}),
		[screen],
	);
	const pickedRows = (rows ?? []).filter((row) => picked.has(row.id));
	// What goes along with a request to the assistant from here (doc 10, context): this list as it is asked for, and the rows picked in it.
	const request = useRequest();
	useScreenContext({
		screen: "list",
		collection,
		query,
		...(pickedRows.length > 0 ? { selection: { kind: "rows" as const, ids: pickedRows.map((row) => row.id) } } : {}),
	});
	const pick = (row: ListRow, on: boolean) =>
		setPicked((current) => {
			// Touching the pick ends the assistant's: every picked row is the admin's now.
			const next: Picked = new Map([...current].map(([id]) => [id, { proposal: false }]));
			if (on) next.set(row.id, { proposal: false });
			else next.delete(row.id);
			return next;
		});
	const selectAll: SelectAll = {
		state: pickedRows.length === 0 ? "none" : pickedRows.length === rows?.length ? "all" : "some",
		onChange: (on) => setPicked(new Map(on ? (rows ?? []).map((row) => [row.id, { proposal: false }]) : [])),
		label: t("list.selectAll"),
	};

	// The order shown while a column is dragged; the rows follow it.
	const [preview, setPreview] = useState<string[] | null>(null);
	// What was just saved, shown until the columns are read again, so a dropped column does not jump back for a moment.
	const [saving, setSaving] = useState<{
		order: string[];
		hidden: string[];
		widths: Record<string, number>;
		from: Columns | null;
	} | null>(null);
	const pending = saving && saving.from === columnsRead.data ? saving : null;
	const savePrefs = useOperation("list.savePrefs");
	const allIds = pending?.order ?? (columns ?? []).map((column) => column.id);
	const hidden = pending?.hidden ?? (columns ?? []).filter((column) => column.hidden).map((column) => column.id);
	const widths =
		pending?.widths ??
		Object.fromEntries((columns ?? []).flatMap((column) => (column.width ? [[column.id, column.width]] : [])));
	// The widths while a handle is being dragged, before they are saved on release.
	const [dragWidths, setDragWidths] = useState<Record<string, number> | null>(null);
	const shownIds = (preview ?? allIds).filter((id) => !hidden.includes(id));
	const shown = shownIds.flatMap((id) => (columns ?? []).filter((column) => column.id === id));
	const relationColumns = useMemo(() => (columns ?? []).filter((column) => column.kind === "relation"), [columns]);
	/** A column's width now: the one being dragged or kept, or its kind's; the title takes the room left. */
	const sizeOf = (column: ListColumn) => {
		const kind = kindSizeOf(column);
		return kind === undefined ? undefined : ((dragWidths ?? widths)[column.id] ?? kind);
	};
	const keep = (order: string[], nextHidden: string[], nextWidths = widths) => {
		setSaving({ order, hidden: nextHidden, widths: nextWidths, from: columnsRead.data });
		void savePrefs.run({ collection, order, hidden: nextHidden, widths: nextWidths });
	};
	const resize = (changes: Record<string, number | null>, commit: boolean) => {
		// Onto the drag in progress: a width it pinned on its first move (the title) is not sent again.
		const next = widthsAfter(dragWidths ?? widths, changes);
		if (!commit) return setDragWidths(next);
		setDragWidths(null);
		if (JSON.stringify(next) !== JSON.stringify(widths)) keep(allIds, hidden, next);
	};
	const move = (from: string, to: string) => {
		const order = allIds.filter((id) => id !== from);
		order.splice(order.indexOf(to) + (allIds.indexOf(from) < allIds.indexOf(to) ? 1 : 0), 0, from);
		keep(order, hidden);
	};
	const step = (id: string, direction: -1 | 1) => {
		const at = shownIds.indexOf(id);
		const neighbour = shownIds[at + direction];
		if (neighbour) move(id, neighbour);
	};
	const hide = (column: ListColumn) => {
		keep(allIds, [...hidden, column.id]);
		// A hidden column keeps no filter: nothing on the screen would say it is on (components/list.md, filters by stored kind).
		// The language column has two: its languages and its translation filter.
		const its = state.filters.filter((filter) => headOf(filter) === column.id);
		if (its.length > 0) setState(its.reduce((next, filter) => withFilter(next, filterColumn(filter), null), state));
	};

	const run = {
		create: useOperation<{ output: { id: string } }>("entries.create"),
		duplicate: useOperation("entries.duplicate"),
		archive: useOperation("entries.archive"),
		unarchive: useOperation("entries.unarchive"),
		publish: useOperation<{ output: { published: string[]; blocked: string[] } }>("entries.publish"),
		exportRows: useOperation<BackupOutput>("data.export"),
		moveToFolder: useOperation("entries.moveToFolder"),
		moveFolder: useOperation("folders.move"),
	};
	const removeFolder = useRemoveFolder();
	const trash = useTrashMove();
	const folderName = useFolderNaming({ collection }, state.folder);
	const { naming } = folderName;
	const goFolder = (folder: string | null) =>
		setState({
			...state,
			folder,
			everywhere: false,
			page: 1,
			search: { ...state.search, text: "" },
			filters: [],
			ai: [],
		});
	const moveRows = async (list: ListRow[], folder: string | null) => {
		const result = await run.moveToFolder.run({ ids: list.map((row) => row.id), folder });
		if (!result.ok) return void toast.error(t(reasonOf(result.refusal)));
		setPicked(new Map());
	};
	const startNewFolder = () => {
		// A new folder goes where the person is looking: a search or filter is cleared first (screens/list.md, new folder).
		if (state.search.text || state.filters.length > 0)
			setState({ ...state, page: 1, search: { ...state.search, text: "" }, filters: [], ai: [] });
		folderName.start();
	};
	const entryRoute = (row: ListRow): Route => ({ screen: "entry", collection, id: row.id });
	const ids = (list: ListRow[]) => ({ ids: list.map((row) => row.id) });
	const actions: Actions = {
		open: (row) => go(entryRoute(row)),
		openNewTab: (row) => window.open(href(entryRoute(row)), "_blank", "noopener"),
		duplicate: (row) => void run.duplicate.run({ id: row.id }),
		archive: (list) => void run.archive.run(ids(list)).then(() => setPicked(new Map())),
		unarchive: (list) => void run.unarchive.run(ids(list)).then(() => setPicked(new Map())),
		publish: async (list) => {
			const result = await run.publish.run(ids(publishable(list)));
			if (!result.ok) return void toast.error(t(reasonOf(result.refusal)));
			const { published, blocked } = result.body.output;
			setPicked(new Map());
			toast(
				blocked.length
					? t("list.publishedBlocked", { count: published.length, blocked: blocked.length })
					: t("list.published", { count: published.length }),
			);
		},
		exportRows: async (list) => {
			const result = await run.exportRows.run(ids(list));
			if (!result.ok) return;
			// The picked entries in the backup's own shape (doc 14): a file an import reads, here or on another site.
			const { missing } = await saveBackup(result.body, { media: true });
			if (missing > 0) toast.error(t("data.backup.missing", { count: missing }));
			else toast(t("list.exported", { count: list.length }));
		},
		trash: (list) =>
			void trash.start({
				rows: list.map((row) => ({ kind: "entry", id: row.id })),
				title: list.length === 1 ? list[0]?.title : undefined,
				onMoved: () => setPicked(new Map()),
			}),
	};
	/** Delete on a row puts it in the trash, with the other picked rows when it is one of them (flow 5·07, 5·08). */
	const onRowKey = (row: ListRow) => (event: KeyboardEvent<HTMLTableRowElement>) => {
		if (event.key !== "Delete" || (event.target as HTMLElement).closest("input, textarea, [role=menu]")) return;
		event.preventDefault();
		actions.trash(picked.has(row.id) && pickedRows.length > 1 ? pickedRows : [row]);
	};
	const create = async (template?: string) => {
		const result = await run.create.run({ collection, locale: language, ...(template ? { template } : {}) });
		if (!result.ok) return;
		const id = result.body.output.id;
		// A post written inside a folder belongs to it.
		if (openFolder) await run.moveToFolder.run({ ids: [id], folder: openFolder.id });
		go({ screen: "entry", collection, id });
	};

	const collectionName = schema.data?.adminValues[collection]?.label ?? collection;
	const name = openFolder?.name ?? collectionName;
	// Items (tags, categories) are live on save: no publishing, no archive (doc 02; components/list.md, bulk bar).
	const document = schema.data?.schema.collections[collection]?.kind !== "item";
	const path = schema.data?.schema.collections[collection]?.path;
	const newLabel = t("list.new", { label: collectionName });
	// With body templates turned off in settings › admin, no menu offers one (doc 03).
	const templateList = templatesOn ? (templates.data ?? []) : [];
	const fromTemplate =
		templateList.length > 0 ? (
			<DropdownMenuSub>
				<DropdownMenuSubTrigger>
					<Template aria-hidden />
					{t("list.fromTemplate")}
				</DropdownMenuSubTrigger>
				<DropdownMenuSubContent>
					{templateList.map((template) => (
						<DropdownMenuItem key={template.id} onClick={() => void create(template.id)}>
							{template.name}
						</DropdownMenuItem>
					))}
				</DropdownMenuSubContent>
			</DropdownMenuSub>
		) : null;
	// The one black pill; its menu holds the rarer ways to add (screens/list.md).
	const importing = useImport(collection);
	const chooseImport = () => chooseFiles({ accept: "", onFiles: (files) => void importing.open(files) });
	const importSheet = (
		<ImportSheet
			collection={collection}
			labelOf={(name) => schema.data?.adminValues[name]?.label ?? name}
			go={go}
			importing={importing}
		/>
	);
	const newButton = (
		<SplitButton
			onClick={() => void create()}
			loading={run.create.pending}
			menuLabel={t("list.moreNew")}
			menu={
				<>
					{foldersOn && (
						<DropdownMenuItem onClick={startNewFolder}>
							<FolderAdd aria-hidden />
							{t("folders.new")}
						</DropdownMenuItem>
					)}
					<DropdownMenuItem onClick={chooseImport}>
						<Upload aria-hidden />
						{t("list.import")}
					</DropdownMenuItem>
					{fromTemplate}
				</>
			}
		>
			{newLabel}
		</SplitButton>
	);

	const header = (
		<PageHeader
			title={name}
			meta={openFolder ? undefined : path}
			trail={
				openFolder ? (
					<Inline gap={4}>
						{[{ id: null, name: collectionName }, ...folders.path(openFolder.id).slice(0, -1)].map((up) => (
							<TextButton key={up.id ?? "top"} variant="underline" onClick={() => goFolder(up.id)}>
								{`${up.name} /`}
							</TextButton>
						))}
					</Inline>
				) : undefined
			}
		>
			{count !== 0 && (
				<SearchToggle
					label={t("list.search")}
					aria-label={t("list.search")}
					placeholder={t("list.search")}
					value={box.words}
					onValueChange={box.type}
					targets={[
						{ value: "all", label: t("list.searchAll") },
						{ value: "title", label: t("list.searchTitle") },
						{ value: "slug", label: t("list.searchSlug") },
						{ value: "body", label: t("list.searchBody") },
					]}
					target={state.search.in}
					onTargetChange={(target) => {
						// The words still waiting to be applied go with the choice, so the wait cannot undo it.
						setState({ ...state, page: 1, search: { text: box.settle(), in: target } });
					}}
					// Inside a folder the same chip says which folders it looks in (2026-11-10, owner: no row of its own).
					scopes={openFolder ? searchScopes(openFolder.name, t) : undefined}
					scope={state.everywhere ? "all" : "here"}
					onScopeChange={(scope) =>
						setState({
							...state,
							page: 1,
							search: { ...state.search, text: box.settle() },
							everywhere: scope === "all",
						})
					}
					targetLabel={t("list.searchIn")}
				/>
			)}
			{newButton}
		</PageHeader>
	);

	// No entry at all: one line, and under it the ways to start (T40). Filters that match nothing are not this (below).
	if (count === 0 && folders.list.length === 0 && naming === null)
		return (
			<PageColumn width="list">
				{header}
				<Empty
					title={t("list.emptyTitle", {
						label: t(endsClosed(name) ? "list.subjectFinal" : "list.subjectOpen", { name }),
					})}
				>
					<EmptyStep number="01" onClick={() => void create()}>
						{t("list.first", { label: name })}
					</EmptyStep>
					<EmptyStep number="02" onClick={chooseImport}>
						{t("list.importOwn")}
					</EmptyStep>
					{templateList.length > 0 && (
						<DropdownMenu>
							<DropdownMenuTrigger render={<EmptyStep number="03" />}>{t("list.fromTemplate")}</DropdownMenuTrigger>
							<DropdownMenuContent align="start">
								{templateList.map((template) => (
									<DropdownMenuItem key={template.id} onClick={() => void create(template.id)}>
										{template.name}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</Empty>
				{importSheet}
			</PageColumn>
		);

	const setFilter = (column: string, filter: Parameters<typeof withFilter>[2]) =>
		setState(withFilter(state, column, filter));
	const head: ListHeadColumn[] = shown.map((column) => ({
		id: column.id,
		label: label(column),
		size: sizeOf(column),
		kindSize: kindSizeOf(column),
		align: column.kind === "date" ? "end" : "start",
		sort: state.sort.by === column.id ? state.sort.dir : undefined,
		filtered: state.filters.some((filter) => headOf(filter) === column.id),
		menu: (
			<ColumnMenu
				column={column}
				label={label(column)}
				state={state}
				query={query}
				setFilter={setFilter}
				setSort={(sort) => setState({ ...state, page: 1, sort })}
				onHide={() => hide(column)}
			/>
		),
	}));
	const colSpan = shown.length + 1;
	const aiChips = state.filters.filter((filter) => state.ai.includes(filterColumn(filter)));
	const stateNames: Record<string, string> = {
		published: t("list.state.published"),
		changed: t("list.state.changed"),
		draft: t("list.state.draft"),
		archived: t("list.state.archived"),
	};
	/** What an assistant's filter reads on its chip: the column, and the values it keeps where they have names here. */
	const chipText = (filter: ListState["filters"][number]) => {
		const column = columns?.find((each) => each.id === filterColumn(filter));
		const named = column ? label(column) : filterColumn(filter);
		const values = (list: string[]) => t("list.chipValues", { column: named, values: list.join(", ") });
		switch (filter.on) {
			// "Translation: Source changed", and the languages it asks about when the assistant named them: "Translation: Source changed (English)".
			case "translation": {
				const states = filter.any.map((is) => t(`list.translation.${is}`)).join(", ");
				return t("list.chipValues", {
					column: t("list.translation"),
					values: filter.locales ? `${states} (${filter.locales.map(languageName).join(", ")})` : states,
				});
			}
			case "empty":
				return t("list.chipEmpty", { column: named });
			case "status":
				return values(filter.any.map((value) => stateNames[value] ?? value));
			case "locale":
				return values(filter.any.map(languageName));
			case "select":
				return values(
					filter.any.map((value) =>
						value === null
							? t("list.none")
							: (column?.options?.find((option) => option.value === value)?.label ?? value),
					),
				);
			case "date":
				return values([
					filter.range === "today"
						? t("list.today")
						: filter.range === "7d"
							? t("list.last7")
							: filter.range === "30d"
								? t("list.last30")
								: filter.range.from === filter.range.to
									? shortDate(`${filter.range.from}T00:00`)
									: `${shortDate(`${filter.range.from}T00:00`)} – ${shortDate(`${filter.range.to}T00:00`)}`,
				]);
			case "relation":
				return named;
		}
	};

	const cell = (row: ListRow, column: ListColumn, first: boolean): ReactNode => {
		const check = first ? (
			<RowCheck
				checked={picked.has(row.id)}
				onCheckedChange={(on) => pick(row, on)}
				label={picked.get(row.id)?.proposal ? t("list.aiPicked") : t("list.pick", { title: row.title })}
				proposal={picked.get(row.id)?.proposal}
			/>
		) : null;
		switch (column.kind) {
			case "status":
				return (
					<TableCell key={column.id} truncate title={stateNames[row.state]}>
						{check}
						<EntryStatus status={row.state === "changed" ? "editing" : row.state} quiet={row.state === "published"}>
							{stateNames[row.state]}
						</EntryStatus>
					</TableCell>
				);
			case "title":
				return (
					<TableCell key={column.id} truncate>
						{check}
						<RowTitle
							title={<RowLink href={href(entryRoute(row))}>{row.title || t("list.untitled")}</RowLink>}
							address={row.slug ? `/${row.slug}` : undefined}
						/>
					</TableCell>
				);
			case "locale":
				return (
					<TableCell key={column.id}>
						{check}
						<LocaleCodes codes={row.locales} names={row.locales.map(languageName).join(", ")} />
					</TableCell>
				);
			case "date": {
				const day = shortDate(
					column.id === "publishedAt" ? row.publishedAt : column.id === "createdAt" ? row.createdAt : row.updatedAt,
				);
				return (
					<TableCell key={column.id} align="end" truncate title={day || undefined}>
						{check}
						<Text mono variant="meta" tone="muted">
							{day}
						</Text>
					</TableCell>
				);
			}
			case "media": {
				// The picture, or a file's name; an empty cell for an empty field (T59).
				const file = row.media[column.id];
				return (
					<TableCell key={column.id} tone="subtle" truncate title={file?.name}>
						{check}
						{file?.thumbnail ? (
							<RowThumb>
								<Image src={file.thumbnail} alt="" size="row" ratio="photo" radius="sm" />
							</RowThumb>
						) : (
							file?.name
						)}
					</TableCell>
				);
			}
			default: {
				const text = fieldCell(row, column);
				return (
					<TableCell key={column.id} tone="subtle" truncate title={text || undefined}>
						{check}
						{text}
					</TableCell>
				);
			}
		}
	};

	/** "To folder ▸" for a row's menus and the picked rows' menu (flow 5·07, 5·08). */
	/** Where picked rows are: one place they share, or `undefined` when they differ. */
	const placeOf = (list: ListRow[]) =>
		list.every((row) => row.folderId === list[0]?.folderId) ? (list[0]?.folderId ?? null) : undefined;
	const toFolder = (list: ListRow[], context: boolean, icon = true) =>
		foldersOn ? (
			<MoveToFolderMenu
				context={context}
				icon={icon}
				label={t("folders.to")}
				folders={folders}
				current={placeOf(list)}
				onPick={(folder) => void moveRows(list, folder)}
			/>
		) : null;

	const relationsFor = (list: ListRow[], context: boolean, icon = true) =>
		relationColumns.length > 0
			? relationColumns.map((col) => (
					<RelationSubmenu
						key={col.id}
						collection={collection}
						column={col}
						rows={list}
						context={context}
						icon={icon}
						onDone={() => setPicked(new Map())}
					/>
				))
			: null;

	const rowsMenuFor = (row: ListRow) =>
		picked.has(row.id) && pickedRows.length > 1 ? (
			<RowsMenuItems
				rows={pickedRows}
				actions={actions}
				document={document}
				toFolder={toFolder(pickedRows, true, false)}
				relations={relationsFor(pickedRows, true, false)}
			/>
		) : (
			<RowMenuItems
				row={row}
				actions={actions}
				context
				document={document}
				toFolder={toFolder([row], true)}
				relations={relationsFor([row], true)}
			/>
		);

	// Folder rows lead the rows while nothing is searched or filtered: a search or a filter looks for entries (doc 07, inside a folder).
	const searching = Boolean(state.search.text.trim());
	const looking = searching || state.filters.length > 0;
	const folderRows = foldersOn && !looking ? folders.children(state.folder) : [];
	const folderHref = (folder: string | null) =>
		href({
			screen: "list",
			collection,
			params: writeState({
				...state,
				folder,
				everywhere: false,
				page: 1,
				filters: [],
				ai: [],
				search: { ...state.search, text: "" },
			}),
		});
	// The end cell holds the row's actions, or an empty actions box, so every row of the list is one height (the ⋯ sets it).
	const folderRow = (key: string, title: ReactNode, end: ReactNode = <RowActions />) => (
		<TableRow key={key}>
			{shown.map((column) =>
				column.kind === "title" ? (
					<TableCell key={column.id} truncate>
						{title}
					</TableCell>
				) : (
					<TableCell key={column.id} />
				),
			)}
			<TableCell align="end">{end}</TableCell>
		</TableRow>
	);
	const namingField = (
		<RenameField
			value={naming?.name ?? ""}
			onValueChange={folderName.type}
			onCommit={(value) => void folderName.keep(value)}
			onCancel={folderName.cancel}
			label={t("folders.name")}
		/>
	);
	const folderLines = [
		openFolder && !looking
			? folderRow(
					"up",
					<RowTitle folder title={<RowLink href={folderHref(openFolder.parentId)}>{t("folders.up")}</RowLink>} />,
				)
			: null,
		naming?.id === null ? folderRow("new", <RowTitle folder editing title={namingField} />) : null,
		...folderRows.map((folder) => {
			const items = (context: boolean) => (
				<FolderMenuItems
					context={context}
					folder={folder}
					folders={folders}
					onOpen={() => goFolder(folder.id)}
					onRename={() => folderName.start(folder)}
					onMove={(parent) => void run.moveFolder.run({ id: folder.id, parentId: parent })}
					onRemove={() => removeFolder.start(folder)}
				/>
			);
			const line = folderRow(
				folder.id,
				naming?.id === folder.id ? (
					<RowTitle folder editing title={namingField} />
				) : (
					<RowTitle
						folder
						title={<RowLink href={folderHref(folder.id)}>{folder.name}</RowLink>}
						address={t("folders.holds", { count: folder.count })}
					/>
				),
				<RowActions>
					<DropdownMenu>
						<RowMore label={t("list.rowMenu")} trigger={(button) => <DropdownMenuTrigger render={button} />} />
						<DropdownMenuContent align="end">{items(false)}</DropdownMenuContent>
					</DropdownMenu>
				</RowActions>,
			);
			return (
				<ContextMenu key={folder.id}>
					<ContextMenuTrigger render={line} />
					<ContextMenuContent>{items(true)}</ContextMenuContent>
				</ContextMenu>
			);
		}),
	];

	return (
		<PageColumn width="list">
			{removeFolder.dialog}
			{trash.dialog}
			{importSheet}
			{header}
			{aiChips.length > 0 && (
				<PageToolbar inset>
					{aiChips.map((filter) => (
						<Chip
							key={filterColumn(filter)}
							proposal
							removeLabel={t("list.removeFilter")}
							onRemove={() => setState(withFilter(state, filterColumn(filter), null))}
						>
							{chipText(filter)}
						</Chip>
					))}
				</PageToolbar>
			)}
			<ListScroll>
				<Table container="none" layout="fixed" columns={[...shown.map(sizeOf), LIST_COLUMN_SIZE.end]}>
					{pickedRows.length > 0 ? (
						<BulkBar
							label={t("list.selected", { count: pickedRows.length })}
							selectAll={selectAll}
							clearLabel={t("list.clearSelection")}
							onClear={() => setPicked(new Map())}
							colSpan={colSpan}
							request={request ? { label: t("list.request"), onClick: request } : undefined}
							more={{
								label: t("list.more"),
								children: (
									<>
										<DropdownMenuItem onClick={() => void actions.exportRows(pickedRows)}>
											{t("list.export")}
										</DropdownMenuItem>
										<DropdownMenuSeparator />
										<DropdownMenuItem variant="danger" onClick={() => actions.trash(pickedRows)}>
											{t("trash.toTrash")}
										</DropdownMenuItem>
									</>
								),
							}}
						>
							{document && publishable(pickedRows).length > 0 && (
								<TextButton onClick={() => void actions.publish(pickedRows)}>{t("list.publish")}</TextButton>
							)}
							{!document ? null : allArchived(pickedRows) ? (
								<TextButton onClick={() => actions.unarchive(pickedRows)}>{t("list.unarchive")}</TextButton>
							) : (
								<TextButton onClick={() => actions.archive(pickedRows)}>{t("list.archive")}</TextButton>
							)}
							{foldersOn && (
								<DropdownMenu>
									<DropdownMenuTrigger render={<TextButton />}>
										{t("folders.to")}
										<Caret />
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start">
										<FolderTargets
											context={false}
											folders={folders}
											current={placeOf(pickedRows)}
											onPick={(folder) => void moveRows(pickedRows, folder)}
										/>
									</DropdownMenuContent>
								</DropdownMenu>
							)}
							{relationColumns.length > 0 && (
								<DropdownMenu>
									<DropdownMenuTrigger render={<TextButton />}>
										{t("list.changeRelation")}
										<Caret />
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start">
										{relationColumns.map((col) => (
											<RelationSubmenu
												key={col.id}
												collection={collection}
												column={col}
												rows={pickedRows}
												context={false}
												onDone={() => setPicked(new Map())}
											/>
										))}
									</DropdownMenuContent>
								</DropdownMenu>
							)}
						</BulkBar>
					) : (
						<ListHead
							columns={head}
							end={LIST_COLUMN_SIZE.end}
							selectAll={rows && rows.length > 0 ? selectAll : undefined}
							add={{
								label: t("list.addColumn"),
								columns: (columns ?? [])
									.filter((column) => hidden.includes(column.id))
									.map((column) => ({ id: column.id, label: label(column) })),
								onAdd: (id) =>
									keep(
										allIds,
										hidden.filter((each) => each !== id),
									),
							}}
							moveLabel={t("list.moveColumn")}
							onPlace={move}
							onStep={step}
							onPreview={setPreview}
							onResize={resize}
							resizeLabel={(column) => t("list.resizeColumn", { column })}
						/>
					)}
					<TableBody>
						{folderLines}
						{rows?.length === 0 && folderLines.every((line) => line === null) && (
							<NoMatchRow
								colSpan={colSpan}
								words={t("list.noMatch")}
								onClear={() =>
									setState({ ...state, filters: [], ai: [], page: 1, search: { ...state.search, text: "" } })
								}
							/>
						)}
						{(rows ?? []).map((row) => {
							const mine = picked.get(row.id);
							const line = (
								<TableRow
									key={row.id}
									selected={mine !== undefined}
									proposal={mine?.proposal}
									onKeyDown={onRowKey(row)}
								>
									{shown.map((column, index) => cell(row, column, index === 0))}
									<TableCell align="end">
										<RowActions>
											<DropdownMenu>
												<RowMore
													label={t("list.rowMenu")}
													trigger={(button) => <DropdownMenuTrigger render={button} />}
												/>
												<DropdownMenuContent align="end">
													<RowMenuItems
														row={row}
														actions={actions}
														context={false}
														document={document}
														toFolder={toFolder([row], false)}
														relations={relationsFor([row], false)}
													/>
												</DropdownMenuContent>
											</DropdownMenu>
										</RowActions>
									</TableCell>
								</TableRow>
							);
							return (
								<ContextMenu key={row.id}>
									<ContextMenuTrigger render={line} />
									<ContextMenuContent>{rowsMenuFor(row)}</ContextMenuContent>
								</ContextMenu>
							);
						})}
					</TableBody>
				</Table>
			</ListScroll>
			{rows !== null && total > 0 && (
				<ListFooter>
					<Count>
						{t("list.range", {
							from: (state.page - 1) * pageSize + 1,
							to: Math.min(state.page * pageSize, total),
							total,
						})}
					</Count>
					<PageSizeMenu
						label={t("list.pageSize")}
						value={pageSize}
						options={[25, 50, 100].map((value) => ({ value, label: t("list.perPage", { count: value }) }))}
						onValueChange={(value) => {
							void savePrefs.run({ collection, pageSize: value });
							setState({ ...state, page: 1 });
						}}
					/>
					<ListPages
						page={state.page}
						pages={Math.ceil(total / pageSize)}
						hrefOf={(next) => href({ screen: "list", collection, params: writeState({ ...state, page: next }) })}
					/>
				</ListFooter>
			)}
		</PageColumn>
	);
}
