import { applyOps, type BodyOp, type Doc, type Message, type ProposalItemView, storedFields } from "@monti-cms/core";
import {
	Checkbox,
	CompareRow,
	CompareRows,
	Del,
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
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { useRead } from "../operations/use-operation";
import { href, type Route, reachedFromInside } from "../route";
import { shownBlocks } from "../screens/entry/compare-entries";
import { useFocusHandOff } from "../screens/frame/focus-hand-off";
import { endsClosed } from "../screens/list/format";
import type { SchemaRead } from "../screens/settings/schema-draft";
import { type DiffRun, inlineDiff } from "./diff";
import { changeOf } from "./proposal-card";
import { ProposalState } from "./proposal-state";
import { useAssistant } from "./use-assistant";
import { standingOf, useProposal } from "./use-proposal";
import { clock } from "./words";

type EntryNow = {
	collection: string;
	locale: string;
	title: string;
	slug: string;
	values: Record<string, unknown>;
	doc: Doc | null;
};

/** An id a former item of the same proposal makes (`{ $item }`): the item that makes it, or `null` for a plain id. */
const madeBy = (id: unknown): string | null =>
	typeof id === "object" && id !== null && typeof (id as { $item?: unknown }).$item === "string"
		? (id as { $item: string }).$item
		: null;

/** One place a change touches, as it is now and as proposed. */
type Place = { name: string; before: string; after: string };

const said = (value: unknown): string =>
	value === null || value === undefined
		? ""
		: typeof value === "string"
			? value
			: Array.isArray(value)
				? value.map(said).join(", ")
				: typeof value === "object"
					? JSON.stringify(value)
					: String(value);

/** A change's words with what goes out and what comes in marked, on one line or as one side of two. */
function marked(runs: DiffRun[], side: "both" | "before" | "after"): ReactNode {
	return runs
		.filter(
			(run) => side === "both" || run.kind === "same" || (side === "before" ? run.kind === "del" : run.kind === "ins"),
		)
		.map((run, index) => {
			// A run's place among the runs names it: they are made anew from the two texts each time.
			const key = `${index}:${run.kind}`;
			return run.kind === "del" ? (
				<Del key={key}>{run.text}</Del>
			) : run.kind === "ins" ? (
				<Ins key={key}>{run.text}</Ins>
			) : (
				run.text
			);
		});
}

/**
 * A proposal to look through before it is applied (doc 10; screens/assistant.md): the request, then each kind of change as a titled list of the
 * shared table's rows. A row is one change with the check that keeps it in; the pill at the head's end applies what is kept in, and the same
 * row of state stands at the foot of the proposal's card in the conversation.
 */
export function ReviewScreen({ id, go }: { id: string; go: (route: Route) => void }) {
	const { t, transport } = useAdmin();
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
	// "Make again" goes once the change is made again; pressed with the keyboard, its focus goes to that row's check.
	const toCheck = useFocusHandOff((gone) =>
		gone.closest("tr")?.querySelector<HTMLElement>('[role="checkbox"], input[type="checkbox"]'),
	);
	const proposal = useProposal(id);
	const view = proposal.view;
	// The kinds of change that are looked at side by side: each kind has its own switch.
	const [sideBySide, setSideBySide] = useState<ReadonlySet<string>>(new Set());
	const [entries, setEntries] = useState<Record<string, EntryNow>>({});
	// The translations a proposal makes (flow 3·13) that are opened to read the source beside the translation.
	const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
	// What the site calls its fields, their options and its languages: a change is named as the editor names it.
	const schema = useRead<SchemaRead>("schema.read").data;

	// The entries its changes are of, as they are now: what a change takes out is read from them.
	const entryIds = useMemo(
		() => [
			...new Set(
				(view?.items ?? []).flatMap((item) => [
					...item.targets
						.filter((target) => target.startsWith("entry:"))
						.map((target) => target.slice("entry:".length)),
					// A translation to make: its source, read beside what is proposed for it.
					...(item.operation === "translations.create"
						? [String((item.input as { source?: unknown }).source ?? "")].filter(Boolean)
						: []),
				]),
			),
		],
		[view?.items],
	);
	const wanted = entryIds.join(" ");
	// biome-ignore lint/correctness/useExhaustiveDependencies: it follows which entries the proposal names
	useEffect(() => {
		let gone = false;
		void (async () => {
			for (const entryId of entryIds) {
				const answer = await transport("entries.get", { id: entryId });
				if (gone) return;
				if (answer.status !== 200) continue;
				const entry = (answer.body as { entry: EntryNow }).entry;
				setEntries((known) => ({ ...known, [entryId]: entry }));
			}
		})();
		return () => {
			gone = true;
		};
	}, [wanted, transport]);

	if (!view) return null;
	const standing = standingOf(view, proposal.applying);
	const settled = standing !== "waiting";
	const items = new Map(view.items.map((item) => [item.id, item]));

	const fieldsOf = (collection: string | undefined) =>
		collection ? (schema?.adminValues[collection]?.fields ?? {}) : {};
	const fieldName = (collection: string | undefined, field: string) => fieldsOf(collection)[field]?.label ?? field;
	/** A field's value in words: a choice by its option's label. */
	const valueWords = (collection: string | undefined, field: string, value: unknown) => {
		const labels = fieldsOf(collection)[field]?.optionLabels ?? {};
		return Array.isArray(value)
			? value.map((each) => (typeof each === "string" ? (labels[each] ?? each) : said(each))).join(", ")
			: typeof value === "string"
				? (labels[value] ?? value)
				: said(value);
	};
	const languageName = (code: string) => schema?.schema.locales.list.find((each) => each.code === code)?.name ?? code;
	/** Why a change cannot be put in, in the screen's words: the field it writes belongs to an option the entry has not chosen. */
	const blockedWords = (reason: Message, collection: string | undefined) => {
		if (reason.key !== "entries.optionNotChosen") return t(reason);
		const field = String(reason.values?.field ?? "");
		const option = String(reason.values?.option ?? "");
		const definition = collection ? storedFields(schema?.schema.collections[collection])[field] : undefined;
		const name = fieldName(collection, field);
		// A choice made by a switch has one option: the switch is off.
		if (definition?.kind === "select" && definition.control === "toggle")
			return t(endsClosed(name) ? "review.switchOffFinal" : "review.switchOffOpen", { field: name });
		const chosen = valueWords(collection, field, option);
		return t("review.notChosen", {
			field: t(endsClosed(name) ? "list.subjectFinal" : "list.subjectOpen", { name }),
			option: t(endsClosed(chosen) ? "list.subjectFinal" : "list.subjectOpen", { name: chosen }),
		});
	};
	/** The items that write into what another item of the proposal makes (a translation's words): they go with that item's row. */
	const followers = (parent: string) =>
		(view?.items ?? []).filter((each) => madeBy((each.input as { id?: unknown } | null)?.id) === parent);
	const follows = (item: ProposalItemView) => {
		const parent = madeBy((item.input as { id?: unknown } | null)?.id);
		return (
			parent !== null &&
			(view?.items ?? []).some((each) => each.id === parent && each.operation === "translations.create")
		);
	};

	/** The places of an entry one change touches, each as it is and as proposed. A change the page has no words for has none: its row names it. */
	const placesOf = (item: ProposalItemView): Place[] => {
		const entryId = item.targets.find((target) => target.startsWith("entry:"))?.slice("entry:".length);
		const now = entryId ? entries[entryId] : undefined;
		// Once applied, the entry already reads as proposed: there is no "before" left to show against it.
		const applied = item.state !== "pending" && item.state !== "stale";
		if (item.operation === "entries.save") {
			const input = item.input as { title?: string; slug?: string; values?: Record<string, unknown> };
			const places: Place[] = [];
			if (input.title !== undefined)
				places.push({ name: t("review.title.field"), before: applied ? "" : (now?.title ?? ""), after: input.title });
			if (input.slug !== undefined)
				places.push({ name: t("review.slug.field"), before: applied ? "" : (now?.slug ?? ""), after: input.slug });
			for (const [field, value] of Object.entries(input.values ?? {}))
				places.push({
					name: fieldName(now?.collection, field),
					before: applied ? "" : valueWords(now?.collection, field, now?.values[field]),
					after: valueWords(now?.collection, field, value),
				});
			// A changed choice takes the values of the option it leaves with it (doc 19): each is shown going out.
			if (!applied)
				for (const cleared of item.preview?.clears ?? [])
					places.push({
						name: fieldName(now?.collection, cleared.field),
						before: valueWords(now?.collection, cleared.field, cleared.value),
						after: "",
					});
			return places;
		}
		if (item.operation === "body.edit" && now && !applied) {
			const ops = (item.input as { ops: BodyOp[] }).ops;
			let next: Doc;
			try {
				next = applyOps(now.doc ?? { type: "doc", blocks: [] }, ops);
			} catch {
				// The body moved on so far that the edit no longer fits: the row says it changed in the meantime.
				return [];
			}
			const before = shownBlocks(now.doc);
			const after = shownBlocks(next);
			const places: Place[] = [];
			after.forEach((block, index) => {
				const was = before.find((each) => each.id === block.id);
				if (!was) places.push({ name: t("review.newBlock"), before: "", after: block.text });
				else if (was.text !== block.text)
					places.push({ name: t("review.block", { number: index + 1 }), before: was.text, after: block.text });
			});
			before.forEach((block, index) => {
				if (!after.some((each) => each.id === block.id))
					places.push({ name: t("review.block", { number: index + 1 }), before: block.text, after: "" });
			});
			return places;
		}
		return [];
	};

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
				meta={clock(view.createdAt)}
				trail={
					<TextButton variant="quiet" onClick={back}>
						‹ {t("review.back")}
					</TextButton>
				}
			>
				<ProposalState
					view={view}
					applying={proposal.applying}
					progress={proposal.progress}
					busy={proposal.busy}
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
						const waiting = rows.filter((item) => item.state === "pending" && !item.stale && item.blocked === null);
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
											const change = changeOf(item, view);
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
													checked={item.included && !item.stale && item.state !== "discarded" && blocked === null}
													onCheckedChange={(checked) =>
														void proposal.include([item, ...followers(item.id)], checked === true)
													}
													aria-label={t("card.include", { name: named })}
													readOnly={!open || blocked !== null}
												/>
											);
											if (item.operation === "translations.create") {
												const input = item.input as { source: string; locale: string };
												const source = entries[input.source];
												const words = followers(item.id);
												const proposedDoc = words
													.map((each) => (each.input as { doc?: Doc }).doc)
													.find((doc) => doc !== undefined);
												const proposedTitle = words
													.map((each) => (each.input as { title?: string }).title)
													.find((title) => title !== undefined);
												const blocks = shownBlocks(source?.doc ?? null);
												const worded = blocks.filter((block) => block.look !== "code" && block.text.trim() !== "");
												const translated = (block: (typeof blocks)[number], index: number) => {
													const match =
														proposedDoc?.blocks.find((each) => each.link?.from === block.id) ??
														proposedDoc?.blocks[index];
													return match ? (shownBlocks({ type: "doc", blocks: [match] })[0]?.text ?? "") : null;
												};
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
																	{places.map((place) => {
																		const runs = inlineDiff(place.before, place.after);
																		return side && place.before !== "" && place.after !== "" ? (
																			<CompareRow
																				key={place.name}
																				name={place.name}
																				source={marked(runs, "before")}
																				translation={marked(runs, "after")}
																			/>
																		) : (
																			<CompareRow
																				key={place.name}
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
															{item.stale && item.state !== "discarded" && !proposal.applying ? (
																<TextButton
																	ref={toCheck}
																	variant="underline"
																	onClick={() => void proposal.remake(item.id)}
																>
																	{t(proposal.remaking === item.id ? "card.remaking" : "card.remake")}
																</TextButton>
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
