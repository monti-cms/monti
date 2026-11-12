import type { ProposalItemView, ProposalView } from "@monti-cms/core";
import { Count, Ins, ProposalCard, RowTitle, Stack, Table, TableBody, TableCell, TableRow, Text } from "@monti-cms/ui";
import { useAdmin } from "../operations/admin-context";
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

/**
 * A proposal in the conversation (doc 10; components/assistant.md): what it is and how much, its changes as the review page's rows without their
 * checks, and one row at its foot that says where it stands and holds what can be done with all of it. Several kinds of change are one row
 * each; one kind shows its first three changes.
 */
export function ProposalCardOf({ id }: { id: string }) {
	const { t } = useAdmin();
	const { openReview } = useAssistant();
	const proposal = useProposal(id);
	const view = proposal.view;
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
					busy={proposal.busy}
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
						: view.items.slice(0, SHOWN).map((item) => {
								const change = changeOf(item, view);
								return (
									<TableRow key={item.id} twoLine={change.after !== null}>
										<TableCell truncate>
											<Stack gap={4} minWidth={0}>
												<RowTitle title={change.title} address={change.address ?? undefined} />
												{change.after !== null ? (
													<Text as="div" variant="note" lines={2}>
														<Ins>{change.after}</Ins>
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
