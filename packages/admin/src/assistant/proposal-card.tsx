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
import { marked, type Place, useChangeWords } from "./change-words";
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
	const shown = view && view.groups.length === 1 ? view.items.slice(0, SHOWN) : undefined;
	const { placesOf } = useChangeWords(shown);
	if (!view || view.items.length === 0) return null;
	const standing = standingOf(view, proposal.applying);
	const items = new Map(view.items.map((item) => [item.id, item]));
	const failed = view.items.filter((item) => item.state === "failed" || item.state === "skipped");
	const rest = view.items.length - SHOWN;
	return (
		<ProposalCard
			title={t("card.title")}
			summary={
				view.groups.length > 1
					? t("card.groups", { groups: view.groups.length, count: view.items.length })
					: t("card.count", { count: view.items.length })
			}
			muted={standing === "discarded"}
			footer={
				<ProposalState
					view={view}
					applying={proposal.applying}
					progress={proposal.progress}
					size="sm"
					pending={proposal.pending}
					// Few enough to read here: there is nothing more to see on the review page.
					onReview={view.groups.length > 1 || rest > 0 || standing !== "waiting" ? () => openReview(id) : undefined}
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
								const records = new Set(group.itemIds.flatMap((item) => items.get(item)?.targets ?? []));
								const only = records.size === 1 ? view.records[[...records][0] ?? ""] : undefined;
								return (
									<TableRow key={group.label}>
										<TableCell truncate>
											<RowTitle title={group.label} address={only?.title} />
										</TableCell>
										<TableCell align="end">
											<Count>{t("card.count", { count: group.itemIds.length })}</Count>
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
												<RowTitle title={change.title} address={change.address ?? undefined} />
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
						? failed.map((item) => (
								<TableRow key={item.id}>
									<TableCell truncate>
										<RowTitle
											title={changeOf(item, view).title}
											address={item.reason ? t(item.reason) : t("card.item.failed")}
										/>
									</TableCell>
								</TableRow>
							))
						: null}
				</TableBody>
			</Table>
		</ProposalCard>
	);
}
