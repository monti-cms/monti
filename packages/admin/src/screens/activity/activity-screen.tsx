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
import { DELIVERY_STATES } from "@monti-cms/core";
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
	RowActions,
	RowLink,
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
import { useEffect, useMemo, useState } from "react";
import { useSendAgain } from "../../activity/use-send-again";
import { useUndo } from "../../activity/use-undo";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";
import { href, type Route } from "../../route";
import { clock } from "../entry/dates";
import { DateRows } from "../list/date-rows";
import { toggled, ValueRow } from "../list/filter-rows";
import { shortDate, shortTime } from "../list/format";
import { ListPages } from "../list/list-pages";
import { NoMatchRow } from "../list/no-match-row";
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
 * A line's deliveries in its cell, with the lists' status mark. Only what is not the usual end is said: on its way, failed (with the most tries one
 * of them has had), canceled. A line whose deliveries all arrived leaves the cell empty, as a line that sent nothing does.
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
		return <EntryStatus status="failed">{t("activity.failedTimes", { count: delivery.attempts })}</EntryStatus>;
	if (delivery.canceled > 0)
		return (
			<EntryStatus status="archived" quiet>
				{t("activity.delivery.canceled")}
			</EntryStatus>
		);
	return null;
}

/**
 * The activity log (doc 13, flow 12): every write as a row of the lists' table, newest first. A row says what was done and, after it, where; a row
 * the assistant did starts with ✦ and quotes its request. It opens its details beside the list, and what can be done with it is in its ⋯: send its
 * failed deliveries again, undo it. From two failed deliveries on, a banner at the top of the screen offers to send them all.
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
		setState({ ...state, ...change, page: 1, asOf: null }, options);
	const query = activityQueryOf(state);
	const read = useRead<ActivityList>("activity.list", query, { afterWrites: true });
	const counts = useRead<DeliveryCounts>("deliveries.counts", {}, { afterWrites: true });
	const data = read.data;
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
				{/* Not offered while an undo runs: a second press would be refused right after the first went through. */}
				{line.undo.state === "open" && !undo.pending && (
					<Item onClick={() => void undo.run(line.id)}>
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
	const total = data?.total ?? 0;
	const failed = counts.data?.failed ?? 0;
	const failedOnly = state.deliveries.length === 1 && state.deliveries[0] === "failed";
	const empty = data !== null && total === 0 && !looking && state.page === 1;
	const panel = state.open;

	const banners = (
		<PageBanner>
			{/* From two on: one failed delivery is said by its own row (2026-11-05, owner). */}
			{failed > 1 && data?.deliveries ? (
				<Banner
					tone="danger"
					title={t("activity.failedBanner", { count: failed })}
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
						{busy ? t("activity.sending") : t("activity.retryAll")}
					</TextButton>
				</Banner>
			) : null}
			{read.refusal && !data ? (
				<Banner tone="danger" title={t("activity.loadFailed")} plainMeta>
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
				<Table container="none" layout="fixed" columns={[...head.map((column) => column.size), LIST_COLUMN_SIZE.end]}>
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
												<RowLink render={<button type="button" />} onClick={() => open(line)}>
													{title}
												</RowLink>
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
										<RowActions>
											<DropdownMenu>
												<RowMore
													label={t("list.rowMenu")}
													trigger={(button) => <DropdownMenuTrigger render={button} />}
												/>
												<DropdownMenuContent align="end">{menuItems(line, false)}</DropdownMenuContent>
											</DropdownMenu>
										</RowActions>
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
							// The other pages of this browsing stand where this one was read, so new activity does not shift them.
							hrefOf={(page) =>
								href({ screen: "activity", params: writeActivityState({ ...state, page, asOf: data.asOf }) })
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
					onUndo={() => void undo.run(panel)}
				/>
			)}
		</Inline>
	);
}
