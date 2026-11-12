import type { Thinking } from "@monti-cms/ai";
import {
	Button,
	ChatInput,
	ChatMessage,
	ChatMessageActions,
	ChatQueueItem,
	ChatThread,
	Chip,
	Empty,
	EmptyStep,
	ErrorNote,
	IconButton,
	Inline,
	ModelMenu,
	ModelMenuButton,
	SidePanel,
	Stack,
	Suggest,
	Text,
	ToolCallLine,
	toast,
} from "@monti-cms/ui";
import { Add, Copy, Edit, RecentlyViewed, Renew } from "@monti-cms/ui/icons";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { useFocusHandOff } from "../screens/frame/focus-hand-off";
import { History, HistoryFoot } from "./history";
import { ProposalCardOf } from "./proposal-card";
import { Prose } from "./prose";
import { type Part, type Turn, useAssistant } from "./use-assistant";
import { clock, groupOf, sentValue, type ToolPart, toolWords } from "./words";

/** How hard a model that can think is asked to: the levels of the model menu's second step. */
const LEVELS = ["off", "low", "medium", "high"] as const satisfies readonly Thinking[];

/** A model as the menu names it: its key and its id in one value. */
const choice = (keyId: string, model: string) => JSON.stringify([keyId, model]);

/** What a turn showed, in runs: tool lines that came one after another are one group, and writes of one kind in a row are one line with their count. */
type Segment =
	| { kind: "tools"; lines: { part: ToolPart; times: number }[] }
	| { kind: "text"; text: string; stale: boolean }
	| { kind: "said"; text: string };

function segmentsOf(parts: Part[]): Segment[] {
	const segments: Segment[] = [];
	for (const part of parts) {
		const last = segments.at(-1);
		if (part.type === "text") segments.push({ kind: "text", text: part.text, stale: part.stale === true });
		else if (part.type === "said") segments.push({ kind: "said", text: part.text });
		else if (last?.kind === "tools") {
			const before = last.lines.at(-1);
			const group = groupOf(part.input);
			// One line for the writes of one kind that came in a row, while they all went the same way.
			if (
				before &&
				part.kind === "write" &&
				before.part.kind === "write" &&
				group !== null &&
				groupOf(before.part.input) === group &&
				before.part.state === part.state
			)
				before.times += 1;
			else last.lines.push({ part, times: 1 });
		} else segments.push({ kind: "tools", lines: [{ part, times: 1 }] });
	}
	return segments;
}

/**
 * The assistant's panel (doc 10; screens/assistant.md): the conversation over the box to ask in, or the past conversations. It stands beside
 * the page as the other side panels do and stays open from screen to screen. `onOpen` opens a place of the admin that an answer's link names.
 */
export function AssistantPanel({ onOpen }: { onOpen: (address: string) => void }) {
	const { t } = useAdmin();
	const assistant = useAssistant();
	const { view, state, turns, busy } = assistant;
	const [menuOpen, setMenuOpen] = useState(false);
	const [savingToOpen, setSavingToOpen] = useState(false);
	/** "Send with another model": the next model picked sends the last request again. */
	const resend = useRef(false);
	const connected = state?.connected ?? true;
	const model = assistant.model;
	const key = assistant.models?.keys.find((each) => each.id === model?.keyId);
	const canThink = key?.models.find((each) => each.id === model?.model)?.thinking ?? false;
	const last = turns.at(-1);

	// Sending brings the conversation's end into view; while the person reads further up, new words do not pull it down.
	const thread = useRef<HTMLDivElement>(null);
	const asked = turns.length;
	// biome-ignore lint/correctness/useExhaustiveDependencies: it follows how many requests there are
	useEffect(() => {
		// The thread is laid out from its foot up: its end is where it starts scrolling.
		thread.current?.scrollTo({ top: 0 });
	}, [asked]);

	// Words put back into the box (a queued message to edit, the last request to change) are there to be typed on: the caret goes with them.
	const box = useRef<HTMLFormElement>(null);
	// A control of the panel that goes when it is pressed with the keyboard (a new conversation, a request to start from, try again, go on)
	// hands the focus to the box: the next thing a person does here is type. A waiting message's goes to the message after it, else the box.
	const typing = () => box.current?.querySelector("textarea");
	const toBox = useFocusHandOff(typing);
	const toNextWaiting = useFocusHandOff(
		(gone) => gone.nextElementSibling?.querySelector<HTMLElement>("button") ?? typing(),
	);
	const intoBox = (put: () => void) => {
		put();
		requestAnimationFrame(() => box.current?.querySelector("textarea")?.focus());
	};
	const send = (words: string) => {
		assistant.setDraft("");
		assistant.ask(words);
	};
	const copy = async (text: string) => {
		await navigator.clipboard.writeText(text);
		toast(t("panel.copied"));
	};

	const button = (
		<ModelMenuButton
			model={model?.model ?? ""}
			thinking={
				canThink && assistant.thinking !== "off"
					? t("panel.thinkingAt", { level: t(`panel.thinking.${assistant.thinking}`) })
					: undefined
			}
			label={t("panel.model")}
		/>
	);
	const recent = assistant.recent.filter((each) =>
		assistant.models?.keys.some((k) => k.id === each.keyId && k.models.some((m) => m.id === each.model)),
	);
	const composer = (
		<ChatInput
			ref={box}
			value={assistant.draft}
			onValueChange={assistant.setDraft}
			onSubmit={send}
			onStop={assistant.stop}
			label={t("panel.ask")}
			placeholder={t("panel.placeholder")}
			sendLabel={t("panel.send")}
			stopLabel={t("panel.stop")}
			busy={busy}
			busyPlaceholder={t("panel.sayMore")}
			onQueue={(words) => {
				assistant.setDraft("");
				assistant.queueAdd(words);
			}}
			context={
				assistant.chips.length > 0
					? assistant.chips.map((chip) => (
							<Chip
								key={chip.id}
								onRemove={() => assistant.removeChip(chip.id)}
								removeLabel={t("panel.chip.remove", { name: chip.label })}
							>
								{chip.label}
							</Chip>
						))
					: undefined
			}
			queue={
				assistant.queue.length > 0
					? assistant.queue.map((waiting) => (
							<ChatQueueItem
								key={waiting.id}
								ref={toNextWaiting}
								sendNowLabel={t("panel.sendNow")}
								editLabel={t("panel.editQueued")}
								cancelLabel={t("panel.cancelQueued")}
								onSendNow={() => assistant.queueSendNow(waiting.id)}
								onEdit={() => intoBox(() => assistant.queueTake(waiting.id))}
								onCancel={() => assistant.queueCancel(waiting.id)}
							>
								{waiting.text}
							</ChatQueueItem>
						))
					: undefined
			}
			aside={
				model && assistant.models ? (
					<ModelMenu
						trigger={button}
						open={menuOpen}
						onOpenChange={(next) => {
							setMenuOpen(next);
							if (!next) resend.current = false;
						}}
						value={choice(model.keyId, model.model)}
						onValueChange={(value) => {
							const [keyId, id] = JSON.parse(value) as [string, string];
							assistant.pickModel({ keyId, model: id });
							if (resend.current) {
								resend.current = false;
								// The model is the conversation's from the next render on: the same words go with it then.
								setTimeout(assistant.again, 0);
							}
						}}
						groups={[
							...(recent.length > 0
								? [
										{
											key: "recent",
											label: t("panel.recent"),
											items: recent.map((each) => ({
												value: choice(each.keyId, each.model),
												model: each.model,
												hint: assistant.models?.keys.find((k) => k.id === each.keyId)?.name,
											})),
										},
									]
								: []),
							...assistant.models.keys.map((each) => ({
								key: each.id,
								label: each.name,
								count: each.models.length,
								items: each.models.map((m) => ({
									value: choice(each.id, m.id),
									model: m.id,
									...(assistant.models?.assistant?.keyId === each.id && assistant.models.assistant.model === m.id
										? { hint: t("panel.default") }
										: {}),
								})),
							})),
						]}
						searchLabel={t("panel.findModel")}
						emptyText={t("panel.noModel")}
						thinking={
							canThink
								? {
										label: t("panel.thinking"),
										value: assistant.thinking,
										options: LEVELS.map((level) => ({ value: level, label: t(`panel.thinking.${level}`) })),
										onValueChange: (level) => assistant.setThinking(level as Thinking),
									}
								: undefined
						}
					/>
				) : undefined
			}
		/>
	);

	/** What can be done about a turn that did not finish; only the last turn can be gone on with. */
	const noteOf = (turn: Turn, isLast: boolean): ReactNode => {
		const end = turn.end;
		// A run that waits on a screen while this page follows it is at work (the screen is doing its part).
		if (!end || turn.status === "done" || turn.status === "stopped" || turn.status === "running") return null;
		if (turn.status === "waiting" && busy) return null;
		const act = (label: string, onClick: () => void) =>
			// The note's own buttons (status.md): quiet and small.
			isLast ? (
				<Button ref={toBox} variant="ghost" size="sm" onClick={onClick}>
					{label}
				</Button>
			) : undefined;
		if (turn.status === "failed") {
			// It never began: the server's own reason when it gave one (another request is going, the model is gone, no answer came).
			if (turn.unsent || !end.error)
				return (
					<ErrorNote
						title={turn.refusal ? t(turn.refusal) : t("panel.dropped")}
						actions={act(t("panel.retry"), assistant.again)}
					/>
				);
			if (end.error.kind === "refused")
				return (
					<ErrorNote
						title={t("panel.refused")}
						actions={act(t("panel.otherModel"), () => {
							resend.current = true;
							setMenuOpen(true);
						})}
					>
						{[end.error.keyName, end.error.detail].filter(Boolean).join(" · ")}
					</ErrorNote>
				);
			if (end.error.kind === "unreachable")
				return (
					<ErrorNote title={t("panel.unreachable")} actions={act(t("panel.retry"), assistant.again)}>
						{end.error.keyName}
					</ErrorNote>
				);
			return <ErrorNote title={t("panel.noKey")} />;
		}
		if (turn.status === "interrupted" && (end.reason === "turns" || end.reason === "tokens"))
			return <ErrorNote title={t("panel.limit")} actions={act(t("panel.goOn"), () => assistant.goOn(true))} />;
		// Cut off, or left waiting on a screen that no page is doing it on any more: it can be gone on with.
		if (turn.status === "interrupted" || turn.status === "waiting")
			return <ErrorNote title={t("panel.dropped")} actions={act(t("panel.goOn"), () => assistant.goOn())} />;
		return null;
	};

	const turnOf = (turn: Turn, isLast: boolean) => {
		const segments = segmentsOf(turn.parts);
		const running = turn.status === "running";
		const cut = turn.status === "interrupted" || turn.status === "failed";
		const lastSegment = segments.at(-1);
		const toolGoing = lastSegment?.kind === "tools" && lastSegment.lines.at(-1)?.part.state === "running";
		const words = turn.parts
			.filter((part) => part.type === "text")
			.map((part) => part.text)
			.join("\n\n");
		return (
			<Stack key={turn.id} gap={24} minWidth={0}>
				<ChatMessage author="user" context={turn.chips.length > 0 ? turn.chips.join(" · ") : undefined}>
					{turn.request}
				</ChatMessage>
				<ChatMessageActions author="user" time={clock(turn.at)}>
					<IconButton label={t("panel.copy")} onClick={() => void copy(turn.request)}>
						<Copy />
					</IconButton>
					{isLast && !busy ? (
						<IconButton label={t("panel.editAgain")} onClick={() => intoBox(() => assistant.setDraft(turn.request))}>
							<Edit />
						</IconButton>
					) : null}
				</ChatMessageActions>
				<Stack gap={12} minWidth={0}>
					{segments.map((segment, index) => {
						// A turn only grows at its end, so a segment's place names it.
						const at = `${index}:${segment.kind}`;
						if (segment.kind === "said")
							return (
								<ChatMessage key={at} author="user">
									{segment.text}
								</ChatMessage>
							);
						if (segment.kind === "text")
							return (
								<Prose
									key={at}
									text={segment.text}
									streaming={running && index === segments.length - 1 && !segment.stale}
									onOpen={onOpen}
								/>
							);
						return (
							<Stack key={at} gap={0} minWidth={0}>
								{segment.lines.map(({ part, times }) => {
									// A call that was still going when the run was cut stopped there.
									const stopped = cut && part.state === "running";
									const status = stopped ? "failed" : part.state;
									const sent = sentValue(part.input);
									return (
										<ToolCallLine
											key={part.id}
											status={status}
											statusLabel={t(`panel.status.${status}`)}
											details={sent ? [{ label: t("panel.sentValue"), value: sent }] : undefined}
										>
											{toolWords(part, t, { times, cut: stopped })}
										</ToolCallLine>
									);
								})}
							</Stack>
						);
					})}
					{/* From the moment it is sent until words or a tool line show that it works: the caret alone. */}
					{running && !toolGoing && lastSegment?.kind !== "text" ? <Prose text="" streaming onOpen={onOpen} /> : null}
					{turn.proposalId ? <ProposalCardOf id={turn.proposalId} /> : null}
					{noteOf(turn, isLast)}
					{/* The screen did not move for its unsaved changes, and the assistant has said so: the one step that does both. */}
					{isLast && !busy && assistant.blockedMove ? (
						<Inline>
							<Button
								variant="ghost"
								size="sm"
								loading={savingToOpen}
								onClick={async (event) => {
									// A key's press is a click that no pointer made.
									const byKeyboard = event.detail === 0;
									setSavingToOpen(true);
									const moved = await assistant.saveAndOpen();
									setSavingToOpen(false);
									// The step is gone and the screen has moved (the panel itself may have been drawn anew beside another
									// page): pressed with the keyboard, the focus goes to the panel's box, two frames on, when it is there.
									if (moved && byKeyboard)
										requestAnimationFrame(() =>
											requestAnimationFrame(() => {
												const on = document.activeElement;
												if (on && on !== document.body && on.isConnected) return;
												document.querySelector<HTMLElement>("[data-slot=chat-input] textarea")?.focus();
											}),
										);
								}}
							>
								{t("panel.saveAndOpen")}
							</Button>
						</Inline>
					) : null}
				</Stack>
				{words !== "" && !running ? (
					<ChatMessageActions author="assistant">
						<IconButton label={t("panel.copy")} onClick={() => void copy(words)}>
							<Copy />
						</IconButton>
						{isLast && !busy ? (
							<IconButton ref={toBox} label={t("panel.again")} onClick={assistant.again}>
								<Renew />
							</IconButton>
						) : null}
					</ChatMessageActions>
				) : null}
			</Stack>
		);
	};

	// The requests the model no longer has are the oldest; of those read so far, the first it still has stands under the line.
	const unread = assistant.requests - turns.length;
	const rememberedFrom = assistant.forgotten > 0 ? assistant.forgotten - unread : -1;
	const screenKind = assistant.screenKind;
	const starts =
		screenKind === "entry"
			? ["panel.suggest.summary"]
			: screenKind === "media"
				? ["panel.suggest.unused"]
				: screenKind === "list"
					? ["panel.suggest.emptySummary", "panel.suggest.oldDrafts"]
					: [];

	return (
		<SidePanel
			title={view === "history" ? t("panel.history") : t("panel.title")}
			width="assistant"
			bleed
			onClose={() => assistant.setOpen(false)}
			{...(view === "history" ? { back: { label: t("panel.back"), onClick: () => assistant.setView("chat") } } : {})}
			actions={
				view === "history" || !connected ? undefined : (
					<>
						<IconButton
							label={t("panel.history")}
							onClick={() => {
								assistant.setView("history");
								void assistant.loadHistory();
							}}
						>
							<RecentlyViewed />
						</IconButton>
						{turns.length > 0 ? (
							<IconButton ref={toBox} label={t("panel.new")} onClick={assistant.fresh}>
								<Add />
							</IconButton>
						) : null}
					</>
				)
			}
			composer={view === "chat" && connected ? composer : undefined}
			footer={view === "history" ? <HistoryFoot /> : undefined}
		>
			{view === "history" ? (
				<History />
			) : !connected ? (
				// The same as an empty list with its one step (2026-11-12): no words about why.
				<Stack paddingX={24} minWidth={0}>
					<Empty title={t("panel.noKey")}>
						<EmptyStep href="#/tools/keys">{t("panel.addKey")}</EmptyStep>
					</Empty>
				</Stack>
			) : (
				<ChatThread
					ref={thread}
					onScroll={(event) => {
						// At the top, the requests before these come in. The thread scrolls from its foot, so its top is as far as it goes.
						const box = event.currentTarget;
						if (assistant.hasEarlier && box.clientHeight - box.scrollTop >= box.scrollHeight - 1)
							void assistant.loadEarlier();
					}}
				>
					{/* While a conversation that was opened is read, neither its requests nor the ones to start from are here yet. */}
					{assistant.loading && turns.length === 0 ? null : turns.length === 0 ? (
						<Stack gap={4} minWidth={0}>
							{starts.map((words) => (
								<Suggest key={words} ref={toBox} kind="request" onClick={() => send(t(words))}>
									{t(words)}
								</Suggest>
							))}
							{(state?.recent ?? []).map((words) => (
								<Suggest key={words} ref={toBox} kind="recent" onClick={() => send(words)}>
									{words}
								</Suggest>
							))}
						</Stack>
					) : (
						turns.map((turn, index) => (
							<Stack key={turn.id} gap={24} minWidth={0}>
								{index === rememberedFrom ? (
									<Text as="div" variant="micro" tone="subtle" align="center">
										{t("panel.remembered")}
									</Text>
								) : null}
								{turnOf(turn, turn === last)}
							</Stack>
						))
					)}
				</ChatThread>
			)}
		</SidePanel>
	);
}
