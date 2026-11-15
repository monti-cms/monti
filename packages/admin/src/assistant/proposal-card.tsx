import type { ProposalItemView, ProposalView } from "@monti-cms/core";
import {
	Count,
	Del,
	Ins,
	ProposalCard,
	RowTitle,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Text,
} from "@monti-cms/ui";
import type { ReactNode } from "react";
import { useAdmin } from "../operations/admin-context";
import { followersOf, marked, type Place, rowCounts, useChangeWords } from "./change-words";
import { inlineDiff } from "./diff";
import { ProposalState } from "./proposal-state";
import { useAssistant } from "./use-assistant";
import { standingOf, useProposal } from "./use-proposal";

/** How many of a one-kind proposal's changes its card shows before "and N more". */
const SHOWN = 3;

/** What one proposed change is of and, where one short text says it, what it puts in: a record's name and address, and a new value. */
export function changeOf(
	item: ProposalItemView,
	view: ProposalView,
): { title: string; address: string | null; after: string | null } {
	const record = item.targets.map((key) => view.records[key]).find((found) => found !== undefined);
	const input = (item.input ?? {}) as { title?: unknown; values?: Record<string, unknown>; alt?: unknown };
	const texts = [
		input.title,
		...(item.operation === "entries.save" ? Object.values(input.values ?? {}) : []),
		item.operation === "media.update" ? input.alt : undefined,
	].filter((value): value is string => typeof value === "string" && value.trim() !== "");
	return {
		title: record?.title ?? item.group,
		address: record?.detail ?? null,
		// One text says the change; several (a title and a field) are read on the review page.
		after: texts.length === 1 ? (texts[0] ?? null) : null,
	};
}

/** A change's first place in words: what goes out struck through and what comes in on blue, as the review page's one-line view shows it. */
function placeWords(place: Place): ReactNode {
	if (place.before !== "" && place.after !== "") return marked(inlineDiff(place.before, place.after), "both");
	if (place.after !== "") return <Ins>{place.after}</Ins>;
	return <Del>{place.before}</Del>;
}

/**
 * A proposal in the conversation (doc 10; components/assistant.md): what it is and how much, its changes as the review page's rows without their
 * checks, and one row at its foot that says where it stands and holds what can be done with all of it. Several kinds of change are one row
 * each; one kind shows its first three changes, each with its first place as it is and as proposed (AS-46, TR-20: a cut line of the new
 * words alone, or a translation's address alone, said nothing of what changes).
 */
export function ProposalCardOf({ id }: { id: string }) {
	const { t } = useAdmin();
	const { openReview } = useAssistant();
	const proposal = useProposal(id);
	const view = proposal.view;
	// What is written into a translation the proposal makes is read in that translation's row, as on the review page.
	const { follows, followers } = followersOf(view?.items ?? []);
	const rows = (view?.items ?? []).filter((item) => !follows(item));
	const shown = view && view.groups.length === 1 ? rows.slice(0, SHOWN) : undefined;
	// The entries are read for what a change takes out, which only a change still waiting has (an applied one reads as proposed already), and
	// for the source a translation is named by and read beside, whatever became of it.
	const reading = [
		...new Set([
			...(shown?.some((item) => item.state === "pending" || item.state === "stale") ? shown : []),
			...rows.filter((item) => item.operation === "translations.create"),
		]),
	];
	const { entries, placesOf } = useChangeWords(
		reading.length > 0 ? reading.flatMap((item) => [item, ...followers(item.id)]) : undefined,
	);
	if (!view || rows.length === 0) return null;
	const standing = standingOf(view, proposal.applying);
	const items = new Map(view.items.map((item) => [item.id, item]));
	/** A row's name: a translation to make is named by its source, as on the review page (the entry it will be may not stand). */
	const nameOf = (item: ProposalItemView) =>
		(item.operation === "translations.create"
			? entries[String((item.input as { source?: unknown }).source ?? "")]?.title
			: undefined) ?? changeOf(item, view).title;
	// What could not be applied, by row: a translation whose words went wrong is one row that failed, with what its words' write said.
	const failed = rows.flatMap((item) => {
		const went = [item, ...followers(item.id)].find((each) => each.state === "failed" || each.state === "skipped");
		return went ? [{ item, went }] : [];
	});
	const rest = rows.length - SHOWN;
	return (
		<ProposalCard
			title={t("card.title")}
			summary={
				view.groups.length > 1
					? t("card.groups", { groups: view.groups.length, count: rows.length })
					: t("card.count", { count: rows.length })
			}
			muted={standing === "discarded"}
			footer={
				<ProposalState
					view={view}
					applying={proposal.applying}
					progress={proposal.progress}
					size="sm"
					pending={proposal.pending}
					// Few enough to read here: there is nothing more to see on the review page. A change that went stale is made again there.
					onReview={
						view.groups.length > 1 || rest > 0 || standing !== "waiting" || rowCounts(view).stale > 0
							? () => openReview(id)
							: undefined
					}
					onDiscard={() => void proposal.discard()}
					onApply={() => void proposal.apply()}
					onRevert={() => void proposal.revert()}
				/>
			}
		>
			<Table container="none" aria-label={t("card.title")}>
				<TableBody>
					{view.groups.length > 1
						? view.groups.map((group) => {
								const of = group.itemIds.flatMap((item) => {
									const found = items.get(item);
									return found && !follows(found) ? [found] : [];
								});
								const records = new Set(of.flatMap((item) => item.targets));
								const only = records.size === 1 ? view.records[[...records][0] ?? ""] : undefined;
								return (
									<TableRow key={group.label}>
										<TableCell truncate>
											<RowTitle title={group.label} address={only?.title} />
										</TableCell>
										<TableCell align="end">
											<Count>{t("card.count", { count: of.length })}</Count>
										</TableCell>
									</TableRow>
								);
							})
						: (shown ?? []).map((item) => {
								const change = changeOf(item, view);
								const place = placesOf(item).find((each) => each.before !== "" || each.after !== "");
								const words = place ? placeWords(place) : change.after !== null ? <Ins>{change.after}</Ins> : null;
								return (
									<TableRow key={item.id} twoLine={words !== null}>
										<TableCell truncate>
											<Stack gap={4} minWidth={0}>
												<RowTitle title={nameOf(item)} address={change.address ?? undefined} />
												{words !== null ? (
													<Text as="div" variant="note" lines={2}>
														{words}
													</Text>
												) : null}
											</Stack>
										</TableCell>
									</TableRow>
								);
							})}
					{view.groups.length === 1 && rest > 0 ? (
						<TableRow>
							<TableCell>
								<Text tone="subtle">{t("card.more", { count: rest })}</Text>
							</TableCell>
						</TableRow>
					) : null}
					{/* What could not be applied, each with what its write said. */}
					{standing === "applied"
						? failed.map(({ item, went }) => (
								<TableRow key={item.id}>
									<TableCell truncate>
										<RowTitle title={nameOf(item)} address={went.reason ? t(went.reason) : t("card.item.failed")} />
									</TableCell>
								</TableRow>
							))
						: null}
				</TableBody>
			</Table>
		</ProposalCard>
	);
}
