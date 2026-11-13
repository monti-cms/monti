import type {
	ActivityFacet,
	ActivityFilter,
	ActivityLine,
	ActivityList,
	DeliveryCounts,
	DeliveryState,
	LineDelivery,
	Message,
} from "@monti-cms/core";
import { activityPageMark, DELIVERY_STATES } from "@monti-cms/core";
import {
	Banner,
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
	Count,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Empty,
	EntryStatus,
	Inline,
	LIST_COLUMN_SIZE,
	ListFooter,
	ListHead,
	type ListHeadColumn,
	PageBanner,
	PageColumn,
	PageHeader,
	RowMore,
	RowTitle,
	SearchToggle,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { Renew, RightPanelOpen, Undo } from "@monti-cms/ui/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSendAgain } from "../../activity/use-send-again";
import { useUndo } from "../../activity/use-undo";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";
import { href, type Route } from "../../route";
import { clock } from "../entry/dates";
import { nextStop, useFocusHandOff } from "../frame/focus-hand-off";
import { DateRows } from "../list/date-rows";
import { toggled, ValueRow } from "../list/filter-rows";
import { shortDate, shortTime } from "../list/format";
import { ListPages } from "../list/list-pages";
import { NoMatchRow } from "../list/no-match-row";
import { HandedRowActions, HandedRowLink, listStartOf } from "../list/row-hand-off";
import { SortRows } from "../list/sort-rows";
import { useColumnWidths } from "../list/use-column-widths";
import { useSearchWords } from "../list/use-search-words";
import { ActivityPanel } from "./activity-panel";
import {
	ACTIVITY_KINDS_SHOWN,
	ACTIVITY_PAGE_SIZE,
	type ActivityState,
	activityQueryOf,
	readActivityState,
	writeActivityState,
} from "./activity-query";

/** How often the log reads again while a delivery it shows is on its way. */
const WATCH_MS = 3000;

/** A column menu's values with their counts, read when the menu opens (`activity.facets`), as a list's menus read theirs. */
function FacetRows<Value extends string>({
	column,
	query,
	values,
	chosen,
	onChange,
}: {
	column: ActivityFacet;
	query: ReturnType<typeof activityQueryOf>;
	values: readonly { value: Value; label: string }[];
	chosen: readonly Value[];
	onChange: (chosen: Value[]) => void;
}) {
	const facets = useRead<{ values: { value: string; count: number }[] }>("activity.facets", { ...query, column });
	return (
		<>
			{values.map((each) => (
				<ValueRow
					key={each.value}
					checked={chosen.includes(each.value)}
					onToggle={() => onChange(toggled(chosen, each.value))}
					label={each.label}
					counted={facets.data ? (facets.data.values.find((facet) => facet.value === each.value)?.count ?? 0) : null}
				/>
			))}
		</>
	);
}

/**
 * A line's deliveries in its cell. What needs a look has the lists' status mark: on its way, failed (with how many deliveries when more than
 * one did), canceled. A line whose deliveries all arrived says so in quiet words, with no mark and no colour: an empty cell under "delivery" would read as
 * "nothing was sent" (2026-11-12, as Stripe's and GitHub's delivery lists and Svix's portal say a success). Only a line that had nothing to
 * send leaves the cell empty.
 */
export function DeliveryMark({ delivery, sending }: { delivery: LineDelivery | null; sending: boolean }) {
	const { t } = useAdmin();
	if (!delivery) return null;
	if (sending || delivery.pending > 0)
		return (
			<EntryStatus status="draft" quiet>
				{t("activity.delivery.pending")}
			</EntryStatus>
		);
	if (delivery.failed > 0)
		// One failed delivery is "failed"; several say how many deliveries, the number the banner and the sidebar count. How many times one
		// was tried is the side panel's to say, beside that delivery.
		return (
			<EntryStatus status="failed">
				{delivery.failed === 1 ? t("activity.delivery.failed") : t("activity.failedCount", { count: delivery.failed })}
			</EntryStatus>
		);
	if (delivery.canceled > 0)
		return (
			<EntryStatus status="archived" quiet>
				{t("activity.delivery.canceled")}
			</EntryStatus>
		);
	// The words of the lists' quietest cells (a kind, a category): the note size, the subtle tone.
	return delivery.sent > 0 ? (
		<Text variant="note" tone="subtle">
			{t("activity.delivery.sent")}
		</Text>
	) : null;
}

/**
 * The activity log (doc 13, flow 12): every write as a row of the lists' table, newest first. A row says what was done and, after it, where; a row
 * the assistant did starts with ✦ and quotes its request. It opens its details beside the list, and what can be done with it is in its ⋯: send its
 * failed deliveries again, undo it. While any delivery is failed, a banner at the top of the screen counts them and offers to send them again.
 */
export function ActivityScreen({
	params,
	go,
	recount,
}: {
	params: URLSearchParams;
	go: (route: Route, options?: { replace?: boolean }) => void;
	/** Reads the sidebar's counts again: a delivery can fail after its write answered, when nothing else tells the frame. */
	recount: () => void;
}) {
	const { t } = useAdmin();
	const state = useMemo(() => readActivityState(params), [params]);
	const setState = (next: ActivityState, options?: { replace?: boolean }) =>
		go({ screen: "activity", params: writeActivityState(next) }, options);
	/** A change of what the log is searched, filtered or ordered by starts over at its first page, as it is now. */
	const look = (change: Partial<ActivityState>, options?: { replace?: boolean }) =>
		setState({ ...state, ...change, page: 1, asOf: null, from: null }, options);
	const query = activityQueryOf(state);
	const read = useRead<ActivityList>("activity.list", query, { afterWrites: true });
	const counts = useRead<DeliveryCounts>("deliveries.counts", {}, { afterWrites: true });
	const data = read.data;
	/** What is shown is the answer to this address: its search, filters, order and page, not the one before, still on screen while this reads. */
	const answered = data !== null && data.mark === activityPageMark(query, data.asOf, state.page);
	const lines = data?.lines ?? [];
	const looking =
		state.search.trim() !== "" || state.kinds.length > 0 || state.deliveries.length > 0 || state.range !== null;
	const box = useSearchWords(state.search, (text) => look({ search: text }, { replace: true }));
	const again = useSendAgain();
	const undo = useUndo();

	// The sidebar's count may be behind when the log opens: a delivery that failed after its write answered told nobody.
	useEffect(() => {
		recount();
	}, [recount]);
	// A delivery on its way ends by itself (a host that sends after it answers): the log reads again until none is, with the counts and the open
	// row's details. Only what shows deliveries reads again; no other screen's reads do, and nothing was written.
	const waiting = lines.some((line) => (line.delivery?.pending ?? 0) > 0) || (counts.data?.sending ?? 0) > 0;
	const [watched, setWatched] = useState(0);
	const reloadLines = read.reload;
	const reloadCounts = counts.reload;
	useEffect(() => {
		if (!waiting) return;
		const timer = setInterval(() => {
			void reloadLines();
			void reloadCounts();
			recount();
			setWatched((times) => times + 1);
		}, WATCH_MS);
		return () => clearInterval(timer);
	}, [waiting, reloadLines, reloadCounts, recount]);

	const { sized, resize } = useColumnWidths("activity");
	/** A message of the log in the admin's language; an entry with no title yet is called what the lists call it. */
	const say = (message: Message) =>
		t(
			message.values?.title === "" ? { ...message, values: { ...message.values, title: t("list.untitled") } } : message,
		);
	// A send that runs somewhere else: in another tab, or started here before the page was loaded again.
	const elsewhere = again.sending === null && (counts.data?.sending ?? 0) > 0;
	/** While any send runs, every send control says so and none can be pressed: one runs at a time. */
	const busy = again.sending !== null || elsewhere;
	const isSending = (line: ActivityLine) => {
		const failed = line.delivery?.failedIds ?? [];
		if (failed.length === 0) return false;
		if (again.sending === "all" || elsewhere) return true;
		return again.sending !== null && failed.some((id) => again.sending?.includes(id));
	};
	/** What stands after a line's words, in grey: where it happened (for the assistant's line, what it did), who if not the admin, and its undo. */
	const afterOf = (line: ActivityLine) =>
		[
			line.request !== null
				? [...line.what.map(say), ...(line.more > 0 ? [t("activity.andMore", { count: line.more })] : [])].join(" · ")
				: line.where
					? say(line.where)
					: "",
			line.actor === "cli" ? t("activity.actor.cli") : typeof line.actor === "object" ? line.actor.plugin : "",
			line.undo.state === "done" ? t("activity.undone", { time: clock(new Date(line.undo.at)) }) : "",
		]
			.filter(Boolean)
			.join(" · ");
	const titleOf = (line: ActivityLine) =>
		line.request !== null ? `“${line.request}”` : line.what[0] ? say(line.what[0]) : "";
	const open = (line: ActivityLine) => setState({ ...state, open: line.id });

	const menuItems = (line: ActivityLine, context: boolean) => {
		const Item = context ? ContextMenuItem : DropdownMenuItem;
		const failed = line.delivery?.failedIds ?? [];
		return (
			<>
				<Item onClick={() => open(line)}>
					<RightPanelOpen aria-hidden />
					{t("activity.details")}
				</Item>
				{failed.length > 0 && !isSending(line) && (
					<Item disabled={busy} onClick={() => void again.send(failed)}>
						<Renew aria-hidden />
						{t("activity.retry")}
					</Item>
				)}
				{/* Off while an undo runs, as in the panel's ⋯: a second press would be refused right after the first went through. */}
				{line.undo.state === "open" && (
					<Item disabled={undo.pending} onClick={() => void undo.ask(line.id)}>
						<Undo aria-hidden />
						{t("activity.undo")}
					</Item>
				)}
			</>
		);
	};

	const head: ListHeadColumn[] = [
		{
			id: "what",
			label: t("activity.column.what"),
			filtered: state.kinds.length > 0,
			menu: (
				<FacetRows<ActivityFilter>
					column="kind"
					query={query}
					values={ACTIVITY_KINDS_SHOWN.map((kind) => ({ value: kind, label: t(`activity.kind.${kind}`) }))}
					chosen={state.kinds}
					onChange={(kinds) => look({ kinds })}
				/>
			),
		},
		// A site with no receiver sends nothing: it has no delivery column (13-5).
		...(data?.deliveries
			? [
					{
						...sized("delivery", LIST_COLUMN_SIZE.one),
						label: t("activity.column.delivery"),
						filtered: state.deliveries.length > 0,
						menu: (
							<FacetRows<DeliveryState>
								column="delivery"
								query={query}
								values={DELIVERY_STATES.map((each) => ({ value: each, label: t(`activity.delivery.${each}`) }))}
								chosen={state.deliveries}
								onChange={(deliveries) => look({ deliveries })}
							/>
						),
					},
				]
			: []),
		{
			...sized("at", LIST_COLUMN_SIZE.time),
			label: t("activity.column.at"),
			align: "end",
			sort: state.sort,
			filtered: state.range !== null,
			menu: (
				<>
					<SortRows kind="date" dir={state.sort} onChange={(sort) => look({ sort })} />
					<DropdownMenuSeparator />
					<DateRows range={state.range} onChange={(range) => look({ range })} />
				</>
			),
		},
	];
	const colSpan = head.length + 1;
	const failed = counts.data?.failed ?? 0;
	const failedOnly = state.deliveries.length === 1 && state.deliveries[0] === "failed";
	const table = useRef<HTMLTableElement>(null);
	/** Where the list begins for the keyboard: its first row, or what a list with no match offers in its place, or its first column's name. */
	const listStart = () => listStartOf(table.current);
	// A banner's action takes its own control away, and the keyboard's focus it held goes to what it acted on. "Show" goes once the list is
	// filtered while the banner stays: to the delivery column's name, where that filter now is (the rows under it are about to change). "Send
	// again" goes with the banner when nothing is failed any more, "try again" when the log is read: to the list's first row.
	const bannerHandOff = useFocusHandOff((banner) => {
		if (failed > 0 && failedOnly) {
			const name = t("activity.column.delivery");
			const column = [...(table.current?.querySelectorAll<HTMLElement>("thead button") ?? [])].find((button) =>
				button.textContent?.startsWith(name),
			);
			if (column) return column;
		}
		return listStart() ?? nextStop(banner) ?? (() => requestAnimationFrame(() => listStart()?.focus()));
	});
	const total = data?.total ?? 0;
	// Only of this address's own answer: right after the search and the filters are taken off, the rows are still the old answer's (none),
	// and a log that has lines would say for a moment that nothing is logged yet, with its table gone.
	const empty = answered && total === 0 && !looking && state.page === 1;
	const panel = state.open;

	const banners = (
		<PageBanner>
			{/* Whenever a delivery has failed and not been sent again, one or many (2026-11-12, owner). */}
			{failed > 0 && data?.deliveries ? (
				<Banner
					ref={bannerHandOff}
					tone="danger"
					title={t(failed === 1 ? "activity.failedBannerOne" : "activity.failedBanner", { count: failed })}
					meta={counts.data?.since ? t("activity.since", { date: shortDate(counts.data.since) }) : undefined}
				>
					{!failedOnly && (
						// Exactly what the banner counts: every failed delivery, with nothing else narrowing the list.
						<TextButton
							variant="underline"
							onClick={() => look({ deliveries: ["failed"], search: "", kinds: [], range: null })}
						>
							{t("activity.show")}
						</TextButton>
					)}
					<TextButton loading={busy} onClick={() => void again.send("all")}>
						{busy ? t("activity.sending") : t(failed === 1 ? "activity.retry" : "activity.retryAll")}
					</TextButton>
				</Banner>
			) : null}
			{/* Also over a list read before: a read made again that fails (after a change elsewhere, while a delivery is watched) leaves the old
			    rows, and they are not said to be the log as it is now. */}
			{read.refusal ? (
				<Banner ref={bannerHandOff} tone="danger" title={t("activity.loadFailed")} plainMeta>
					<TextButton variant="underline" onClick={() => void read.reload()}>
						{t("activity.reload")}
					</TextButton>
				</Banner>
			) : null}
		</PageBanner>
	);
	const header = (
		<PageHeader title={t("frame.activity")}>
			{!empty && data && (
				<SearchToggle
					label={t("list.search")}
					aria-label={t("list.search")}
					placeholder={t("list.search")}
					value={box.words}
					onValueChange={box.type}
				/>
			)}
		</PageHeader>
	);
	if (empty || !data)
		return (
			<PageColumn width="list">
				{banners}
				{header}
				{empty ? <Empty title={t("activity.none")} /> : null}
			</PageColumn>
		);

	return (
		<Inline align="stretch" gap={0} grow minHeight={0}>
			<PageColumn width="list">
				{banners}
				{header}
				<Table
					ref={table}
					container="none"
					layout="fixed"
					columns={[...head.map((column) => column.size), LIST_COLUMN_SIZE.end]}
				>
					<ListHead
						columns={head}
						end={LIST_COLUMN_SIZE.end}
						onResize={resize}
						resizeLabel={(column) => t("list.resizeColumn", { column })}
					/>
					<TableBody>
						{lines.length === 0 && (
							<NoMatchRow
								colSpan={colSpan}
								words={t("activity.noMatch")}
								onClear={() => look({ search: "", kinds: [], deliveries: [], range: null })}
							/>
						)}
						{lines.map((line) => {
							const title = titleOf(line);
							const row = (
								<TableRow key={line.id} selected={panel === line.id}>
									<TableCell truncate>
										<RowTitle
											byAssistant={line.request !== null ? t("activity.actor.assistant") : undefined}
											title={
												// A link with the address that opens the details, as every list's title is (a middle press or a press with
												// Command opens the log there in a new tab); it hands its focus on when its row goes.
												<HandedRowLink
													href={href({ screen: "activity", params: writeActivityState({ ...state, open: line.id }) })}
													listStart={listStart}
												>
													{title}
												</HandedRowLink>
											}
											address={afterOf(line) || undefined}
										/>
									</TableCell>
									{data.deliveries && (
										<TableCell truncate>
											<DeliveryMark delivery={line.delivery} sending={isSending(line)} />
										</TableCell>
									)}
									<TableCell align="end" truncate title={shortTime(line.at)}>
										<Text mono variant="meta" tone="muted">
											{shortTime(line.at)}
										</Text>
									</TableCell>
									<TableCell align="end">
										<HandedRowActions listStart={listStart}>
											<DropdownMenu>
												<RowMore
													label={t("list.rowMenu")}
													trigger={(button) => <DropdownMenuTrigger render={button} />}
												/>
												<DropdownMenuContent align="end">{menuItems(line, false)}</DropdownMenuContent>
											</DropdownMenu>
										</HandedRowActions>
									</TableCell>
								</TableRow>
							);
							return (
								<ContextMenu key={line.id}>
									<ContextMenuTrigger render={row} />
									<ContextMenuContent>{menuItems(line, true)}</ContextMenuContent>
								</ContextMenu>
							);
						})}
					</TableBody>
				</Table>
				{total > ACTIVITY_PAGE_SIZE && (
					<ListFooter>
						<Count>
							{t("list.range", {
								from: (state.page - 1) * ACTIVITY_PAGE_SIZE + 1,
								to: Math.min(state.page * ACTIVITY_PAGE_SIZE, total),
								total,
							})}
						</Count>
						<ListPages
							page={state.page}
							pages={Math.ceil(total / ACTIVITY_PAGE_SIZE)}
							// The other pages of this browsing are read from this one's edges, inside the boundary it was read in: neither new activity
							// nor a line committed late shifts them, and the count stays. Only while what is shown is this address's own answer: after
							// a new filter or page is asked for and before it answers, the rows are still the old answer's, and its places and count
							// belong to that one. A link pressed then starts from the top.
							hrefOf={(page) =>
								href({
									screen: "activity",
									params: writeActivityState({
										...state,
										page,
										asOf: answered ? data.asOf : null,
										from:
											answered && data.first !== null && data.last !== null
												? { page: state.page, first: data.first, last: data.last, total, mark: data.mark }
												: null,
									}),
								})
							}
						/>
					</ListFooter>
				)}
			</PageColumn>
			{panel && (
				<ActivityPanel
					key={panel}
					id={panel}
					go={go}
					say={say}
					deliveries={data.deliveries}
					sending={again.sending}
					busy={busy}
					undoing={undo.pending}
					watched={watched}
					onClose={() => setState({ ...state, open: null })}
					onGone={() => setState({ ...state, open: null }, { replace: true })}
					onRetry={(ids) => void again.send(ids)}
					onUndo={(whenGone) => void undo.ask(panel, whenGone)}
				/>
			)}
			{/* The undo's question, for the row's ⋯ and the panel's alike. */}
			{undo.dialog}
		</Inline>
	);
}
