import type { ProposalItemView } from "@monti-cms/core";
import {
	AiFailed,
	AiWorking,
	Checkbox,
	CompareRow,
	CompareRows,
	EntryStatus,
	Inline,
	Ins,
	ListSection,
	PageBody,
	PageColumn,
	PageHeader,
	RowTitle,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableRow,
	Tabs,
	TabsList,
	TabsTrigger,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { ChevronLeft } from "@monti-cms/ui/icons";
import { type ReactNode, useState } from "react";
import { recentTime } from "../format/date";
import { useAdmin } from "../operations/admin-context";
import { href, type Route, reachedFromInside } from "../route";
import { toWhatStands, useFocusHandOff } from "../screens/frame/focus-hand-off";
import { followersOf, marked, translationOf, useChangeWords } from "./change-words";
import { inlineDiff } from "./diff";
import { changeOf } from "./proposal-card";
import { ProposalState } from "./proposal-state";
import { useAssistant } from "./use-assistant";
import { standingOf, useProposal } from "./use-proposal";
import { useRemake } from "./use-remake";

/**
 * A proposal to look through before it is applied (doc 10; screens/assistant.md): the request, then each kind of change as a titled list of the
 * shared table's rows. A row is one change with the check that keeps it in; the pill at the head's end applies what is kept in, and the same
 * row of state stands at the foot of the proposal's card in the conversation.
 */
export function ReviewScreen({ id, go }: { id: string; go: (route: Route) => void }) {
	const { t, language } = useAdmin();
	const assistant = useAssistant();
	// Left with the keyboard (discard, the way back): the page goes, and the focus goes to the panel's box beside the screen that
	// takes its place, two frames on, when that is drawn.
	const leaving = useFocusHandOff(
		() => () =>
			requestAnimationFrame(() =>
				requestAnimationFrame(() => {
					const on = document.activeElement;
					if (on && on !== document.body && on.isConnected) return;
					document.querySelector<HTMLElement>("[data-slot=chat-input] textarea")?.focus();
				}),
			),
	);
	// "Make again", then "Generating · Stop" in its place, then the row's new value or the failure line: pressed with the keyboard, the
	// focus goes with what stands in the spot ("Stop", "Try again"), and to the row's check once the spot is gone (the change is made again).
	const remakeSpot = useFocusHandOff((spot) =>
		toWhatStands(spot, ["button"], () =>
			spot.closest("tr")?.querySelector<HTMLElement>('[role="checkbox"], input[type="checkbox"]'),
		),
	);
	const proposal = useProposal(id);
	const remake = useRemake({ settled: proposal.reload });
	const view = proposal.view;
	// The kinds of change that are looked at side by side: each kind has its own switch.
	const [sideBySide, setSideBySide] = useState<ReadonlySet<string>>(new Set());
	// The translations a proposal makes (flow 3·13) that are opened to read the source beside the translation.
	const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
	const { entries, placesOf, languageName, blockedWords } = useChangeWords(view?.items);

	// While it is read the page has its head row (its name, and the ✦ at its end): what is not read yet is not a reason for a bare page.
	if (!view)
		return (
			<PageColumn width="content">
				<PageHeader title={t("review.title")} />
			</PageColumn>
		);
	const standing = standingOf(view, proposal.applying);
	const settled = standing !== "waiting";
	const items = new Map(view.items.map((item) => [item.id, item]));

	// What is written into a translation the proposal makes is read in that translation's row.
	const { follows, followers } = followersOf(view.items);

	const back = () => {
		// Back to where the person came from, with the panel on the conversation this proposal was made in.
		assistant.setOpen(true);
		void assistant.openConversation(view.conversationId);
		// Only when that is a screen of the admin: a review opened by its address (pasted, a link from elsewhere) has the browser's
		// own past behind it, and goes to the admin's first screen instead.
		if (reachedFromInside()) window.history.back();
		else go({ screen: "home" });
	};

	const resultOf = (item: ProposalItemView): ReactNode => {
		if (item.state === "applied") return <EntryStatus status="published">{t("card.item.applied")}</EntryStatus>;
		if (item.state === "reverted")
			return (
				<EntryStatus status="archived" quiet>
					{t("card.item.reverted")}
				</EntryStatus>
			);
		if (item.state === "failed" || item.state === "skipped")
			return (
				<Inline gap={8} align="baseline">
					<EntryStatus status="failed">{t("card.item.failed")}</EntryStatus>
					{item.reason ? (
						<Text variant="note" tone="danger">
							{t(item.reason)}
						</Text>
					) : null}
				</Inline>
			);
		if (item.stale)
			return (
				<Text variant="note" tone="subtle">
					{t("card.item.stale")}
				</Text>
			);
		return null;
	};

	return (
		<PageColumn ref={leaving} width="content">
			<PageHeader
				title={t("review.title")}
				note={recentTime(view.createdAt, language)}
				trail={
					// The way back as the editor's and the templates' are: a quiet text button with the chevron icon before its name.
					<TextButton variant="quiet" onClick={back}>
						<ChevronLeft aria-hidden />
						{t("review.back")}
					</TextButton>
				}
			>
				<ProposalState
					view={view}
					applying={proposal.applying}
					progress={proposal.progress}
					pending={proposal.pending}
					// Discarded, there is nothing left to look through: back. Refused, the page stays with what the refusal left.
					onDiscard={() => void proposal.discard().then((discarded) => discarded && back())}
					onApply={() => void proposal.apply()}
					onRevert={() => void proposal.revert()}
				/>
			</PageHeader>
			<PageBody>
				<Stack gap={32}>
					<Text as="p" variant="title" tone="muted">
						“{view.request}”
					</Text>
					{view.groups.map((group) => {
						const rows = group.itemIds
							.map((item) => items.get(item))
							.filter((item) => item !== undefined)
							// What is written into a translation the proposal makes is read in that translation's row.
							.filter((item) => !follows(item));
						if (rows.length === 0) return null;
						const waiting = rows.filter(
							(item) => item.state === "pending" && !item.stale && (item.blocked === null || item.included),
						);
						const making = rows.filter((item) => item.operation === "translations.create");
						const allOpen = making.length > 0 && making.every((item) => opened.has(item.id));
						const allIn = waiting.every((item) => item.included);
						const texts = rows.some((item) =>
							placesOf(item).some((place) => place.before !== "" && place.after !== ""),
						);
						const side = sideBySide.has(group.label);
						return (
							<ListSection
								key={group.label}
								table
								title={group.label}
								count={t("card.count", { count: rows.length })}
								actions={
									<>
										{texts ? (
											<Tabs
												value={side ? "side" : "line"}
												onValueChange={(value) =>
													setSideBySide((was) => {
														const next = new Set(was);
														if (value === "side") next.add(group.label);
														else next.delete(group.label);
														return next;
													})
												}
											>
												<TabsList variant="line" aria-label={t("review.view")}>
													<TabsTrigger value="line">{t("review.oneLine")}</TabsTrigger>
													<TabsTrigger value="side">{t("review.sideBySide")}</TabsTrigger>
												</TabsList>
											</Tabs>
										) : null}
										{making.length > 0 ? (
											<TextButton
												onClick={() =>
													setOpened((was) => {
														const next = new Set(was);
														for (const item of making) allOpen ? next.delete(item.id) : next.add(item.id);
														return next;
													})
												}
											>
												{t(allOpen ? "review.closeAll" : "review.openAll")}
											</TextButton>
										) : null}
										{!settled && waiting.length > 1 ? (
											<TextButton
												onClick={() =>
													void proposal.include(
														waiting.flatMap((item) => [item, ...followers(item.id)]),
														!allIn,
													)
												}
											>
												{t(allIn ? "review.leaveOutAll" : "review.putInAll", { count: waiting.length })}
											</TextButton>
										) : null}
									</>
								}
							>
								<Table container="none" aria-label={group.label}>
									<TableBody>
										{rows.map((item) => {
											const change = changeOf(item, view, t);
											const places = placesOf(item);
											const entryId = item.targets
												.find((target) => target.startsWith("entry:"))
												?.slice("entry:".length);
											const entry = entryId ? entries[entryId] : undefined;
											const open = item.state === "pending" && !item.stale && !settled;
											// A change of a field the entry does not have now (an option that is not chosen): left out, and
											// it cannot be put in; the row's end says why (doc 19; reference Conditional › Proposal).
											const blocked = open ? item.blocked : null;
											// A translation to make is named by its source: the entry it will be does not exist yet.
											const named =
												item.operation === "translations.create"
													? (entries[String((item.input as { source?: unknown }).source ?? "")]?.title ?? change.title)
													: change.title;
											const check = (
												<Checkbox
													checked={item.included && !item.stale && item.state !== "discarded"}
													onCheckedChange={(checked) =>
														void proposal.include([item, ...followers(item.id)], checked === true)
													}
													aria-label={t("card.include", { name: named })}
													// One that does not fit and is left out cannot be put in. One that is in (the change that made it fit was
													// taken out since) can still be taken out.
													readOnly={!open || (blocked !== null && !item.included)}
												/>
											);
											if (item.operation === "translations.create") {
												const words = followers(item.id);
												const { input, source, blocks, proposedTitle, translated } = translationOf(
													item,
													words,
													entries,
												);
												const worded = blocks.filter((block) => block.look !== "code" && block.text.trim() !== "");
												const shown = opened.has(item.id);
												return (
													<TableRow key={item.id} twoLine={shown}>
														<TableCell>{check}</TableCell>
														<TableCell truncate>
															<Stack gap={8} minWidth={0}>
																<RowTitle title={named} address={change.address ?? undefined} />
																{shown && source ? (
																	<CompareRows>
																		<CompareRow
																			head
																			source={t("review.source", { language: languageName(source.locale) })}
																			translation={t("review.translation", { language: languageName(input.locale) })}
																		/>
																		<CompareRow
																			name={t("review.title.field")}
																			source={source.title}
																			translation={
																				proposedTitle !== undefined ? (
																					<Ins>{proposedTitle}</Ins>
																				) : (
																					<Text tone="faint">{source.title}</Text>
																				)
																			}
																		/>
																		{blocks.map((block, index) => {
																			const words = translated(block, index);
																			return (
																				<CompareRow
																					key={block.id}
																					name={t("review.block", { number: index + 1 })}
																					source={block.text}
																					translation={
																						words !== null && words !== block.text ? (
																							<Ins>{words}</Ins>
																						) : (
																							// Nothing proposed for it: it starts in the source's words, to be decided in the editor.
																							<Text tone="faint">{block.text}</Text>
																						)
																					}
																				/>
																			);
																		})}
																	</CompareRows>
																) : null}
															</Stack>
														</TableCell>
														<TableCell align="end">
															<Inline gap={12} align="baseline" justify="end">
																{source ? (
																	<Text variant="note" tone="subtle">
																		{[
																			t("review.blocks", { count: worded.length }),
																			blocks.length > worded.length
																				? t("review.followSource", { count: blocks.length - worded.length })
																				: null,
																		]
																			.filter(Boolean)
																			.join(" · ")}
																	</Text>
																) : null}
																{/* What became of the row: of the translation, or of the words written into it when those went wrong. */}
																{resultOf(
																	words.find((each) => each.state === "failed" || each.state === "skipped") ??
																		words.find((each) => each.stale) ??
																		item,
																)}
																<TextButton
																	variant="underline"
																	aria-expanded={shown}
																	onClick={() =>
																		setOpened((was) => {
																			const next = new Set(was);
																			shown ? next.delete(item.id) : next.add(item.id);
																			return next;
																		})
																	}
																>
																	{t(shown ? "review.close" : "review.open")}
																</TextButton>
															</Inline>
														</TableCell>
													</TableRow>
												);
											}
											return (
												<TableRow key={item.id} twoLine={places.length > 0}>
													<TableCell>{check}</TableCell>
													<TableCell truncate>
														<Stack gap={8} minWidth={0}>
															<RowTitle title={change.title} address={change.address ?? undefined} />
															{places.length > 0 ? (
																<CompareRows>
																	{places.map((place, at) => {
																		const runs = inlineDiff(place.before, place.after);
																		return side && place.before !== "" && place.after !== "" ? (
																			<CompareRow
																				key={`${place.name}:${at}`}
																				name={place.name}
																				source={marked(runs, "before")}
																				translation={marked(runs, "after")}
																			/>
																		) : (
																			<CompareRow
																				key={`${place.name}:${at}`}
																				single
																				name={place.name}
																				translation={marked(runs, "both")}
																			/>
																		);
																	})}
																</CompareRows>
															) : null}
														</Stack>
													</TableCell>
													<TableCell align="end">
														<Inline gap={12} align="baseline" justify="end">
															{resultOf(item)}
															{blocked !== null && !item.stale ? (
																<Text variant="note" tone="subtle">
																	{blockedWords(blocked, entry?.collection)}
																</Text>
															) : null}
															{remake && item.stale && item.state !== "discarded" && !proposal.applying ? (
																<span ref={remakeSpot}>
																	{remake.working.has(item.id) ? (
																		<AiWorking onStop={() => remake.stop(item.id)} />
																	) : remake.failed.has(item.id) ? (
																		<AiFailed
																			onRetry={
																				remake.failed.get(item.id)?.next ? () => void remake.remake(item.id) : undefined
																			}
																			retryLabel={
																				remake.failed.get(item.id)?.next === "goOn" ? t("panel.goOn") : undefined
																			}
																		>
																			{remake.failed.get(item.id)?.why}
																		</AiFailed>
																	) : (
																		<TextButton variant="underline" onClick={() => void remake.remake(item.id)}>
																			{t("card.remake")}
																		</TextButton>
																	)}
																</span>
															) : null}
															{entry && entryId && open ? (
																<TextButton
																	variant="underline"
																	href={href({ screen: "entry", collection: entry.collection, id: entryId })}
																>
																	{t("review.openEntry")}
																</TextButton>
															) : null}
														</Inline>
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</ListSection>
						);
					})}
				</Stack>
			</PageBody>
		</PageColumn>
	);
}
