"use client";

import { STORED_DOCUMENT_VERSION } from "@monti-cms/core/document";
import { type Site, useSite, useTranslator } from "@monti-cms/core/site";
import { Marker, MemoCardPopover, MemoMessage, MemoThread, ProposalBubble, ProposalBubbleDock } from "@monti-cms/ui";
import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { useEditorState } from "@tiptap/react";
import {
	Fragment,
	type ReactNode,
	type SetStateAction,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import type {
	EditorExtensionContext,
	EditorFieldProposalItem,
	EditorProposalItem,
	EditorProposals,
	EditorRequests,
	EditorSelectionAction,
} from "../../admin-components";
import { BLOCK_ID_ATTRIBUTE } from "../block-ids";
import { storedToTiptap } from "../tiptap-content";
import {
	blocksById,
	drawable,
	MARKER_ATTRIBUTE,
	PROPOSAL_ATTRIBUTE,
	type ProposalMarksMeta,
	proposalMarksKey,
	proposalMarksPlugin,
	spotId,
	spotKeyOf,
	topBlockAt,
} from "./marks";
import { proposalMarksMessages } from "./messages";

/**
 * Puts one proposal into the open document: its block is replaced by the proposed blocks (or removed). Returns the ids of the blocks put in its place, or
 * `null` when the block is gone.
 */
export function acceptInEditor(editor: Editor, site: Site, item: EditorProposalItem): string[] | null {
	const found = blocksById(editor.state.doc).get(item.blockId);
	if (!found) return null;
	const { node, pos } = found;
	const nodes =
		item.nodes.length === 0
			? []
			: (
					storedToTiptap(site, { type: "doc", version: STORED_DOCUMENT_VERSION, content: item.nodes }).content ?? []
				).map((json) => editor.schema.nodeFromJSON(json));
	const { tr } = editor.state;
	// A document keeps at least one block: removing its only block leaves an empty line.
	if (nodes.length === 0 && editor.state.doc.childCount === 1)
		tr.replaceWith(pos, pos + node.nodeSize, editor.schema.nodes.paragraph?.create() ?? []);
	else if (nodes.length === 0) tr.delete(pos, pos + node.nodeSize);
	else tr.replaceWith(pos, pos + node.nodeSize, nodes);
	editor.view.dispatch(tr);
	// The ids the blocks carry once in the document (the editor gives a new id to one that would repeat another).
	const placed: string[] = [];
	let at = pos;
	for (let index = 0; index < nodes.length; index++) {
		const now = editor.state.doc.nodeAt(at);
		if (!now) break;
		placed.push(String(now.attrs[BLOCK_ID_ATTRIBUTE] ?? ""));
		at += now.nodeSize;
	}
	return placed;
}

/** The time of day of an ISO date ("10:58"). */
const timeOf = (iso: string) => {
	const at = new Date(iso);
	return Number.isNaN(at.getTime())
		? ""
		: `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
};

/** The attribute on a field's value in the properties panel while a change of it is drawn: where its card hangs. */
export const FIELD_PROPOSAL_ATTRIBUTE = "data-field-proposal";

/** A field change as the properties panel draws it: the values, whether the bubble is on it, and the way to open its card. */
export interface FieldProposalView {
	readonly id: string;
	readonly before: unknown;
	readonly value: unknown;
	readonly current: boolean;
	readonly open: () => void;
	/** Takes the proposed value into the form, as the person's edit (what typing into the proposal does first). */
	readonly accept: () => void;
}

/** The field changes drawn now, by field name, and the field the bubble is on (its tab comes forward). */
export interface FieldProposals {
	readonly byField: ReadonlyMap<string, FieldProposalView>;
	readonly current: string | null;
}

type AnyEntry = { readonly item: EditorProposalItem | EditorFieldProposalItem; readonly source: EditorProposals };
const isField = (item: EditorProposalItem | EditorFieldProposalItem): item is EditorFieldProposalItem =>
	"field" in item;
/** Whether a form value reads as a stored one: an empty field is `""` in the form and missing (`null`) once stored. */
const blank = (value: unknown) => value == null || value === "" || (Array.isArray(value) && value.length === 0);
const sameValue = (a: unknown, b: unknown) => (blank(a) && blank(b)) || JSON.stringify(a) === JSON.stringify(b);

/** Words selected to ask about: where they are, and what was asked once sent. */
interface SpotRequest {
	readonly words: string;
	readonly blockId: string;
	/** What is being worked on now. */
	readonly sent?: string;
	/** What was sent and stopped before an answer, oldest first: it stays in the card, as in the chat. */
	readonly stopped?: readonly string[];
}

/**
 * The assistant's proposals in the open entry (docs/design/agent-editor.md, flow 2 · 08): the blue pencil in the text, the bubble over the status bar
 * ("↑ 1 / 5 ↓", discard all, accept all) and, from a mark, the card with discard and accept for that one. Accepting puts the change in the document as an
 * edit of the admin's, undone with ⌘Z until saved; the sources hear what was accepted and discarded. In the card the admin can ask for that one change
 * again (flow 2 · 09): the thread shows what was said, and a block with requests has the request marker in its margin ("…" while the assistant works).
 * Selected words can be asked about too (⌘J or the format bar's "✦ Request", flow 2 · 09b–c): they get the highlight and an empty card; sending saves the
 * entry first, and the answer comes as a proposal of its own. `requests` is what the status bar counts. Field changes (flow 2 · 08's summary) are drawn
 * by the properties panel from `fieldProposals`; the bubble steps through them after the body's, and their card hangs under the field.
 */
export function useProposalMarks(
	sources: readonly EditorProposals[],
	save?: () => Promise<boolean>,
	fields?: EditorExtensionContext["fields"],
): {
	readonly onEditor: (editor: Editor | null) => void;
	readonly overlay: ReactNode;
	readonly selectionActions: readonly EditorSelectionAction[];
	readonly requests: EditorRequests | null;
	readonly fieldProposals: FieldProposals;
} {
	const site = useSite();
	const t = useTranslator(proposalMarksMessages);
	const [editor, setEditor] = useState<Editor | null>(null);
	const [current, setCurrentState] = useState<string | null>(null);
	// Until the admin picks one, the bubble is on the first proposal drawn: the body's draw after the fields' while the editor starts.
	const picked = useRef(false);
	const setCurrent = useCallback((value: SetStateAction<string | null>) => {
		picked.current = true;
		setCurrentState(value);
	}, []);
	const [card, setCard] = useState<string | null>(null);
	// The requests the assistant is working on, by the proposal they are about: what the admin wrote.
	const [asking, setAsking] = useState<ReadonlyMap<string, string>>(new Map());
	const [draft, setDraft] = useState("");
	const [spots, setSpots] = useState<ReadonlyMap<string, SpotRequest>>(new Map());
	const askAt = sources.find((source) => source.onAskAt)?.onAskAt;
	const items = useMemo(() => sources.flatMap((source) => source.items.map((item) => ({ item, source }))), [sources]);
	const fieldItems = useMemo(
		() => sources.flatMap((source) => (source.fieldItems ?? []).map((item) => ({ item, source }))),
		[sources],
	);
	// What was written in one card does not follow to another.
	// biome-ignore lint/correctness/useExhaustiveDependencies: clears the box when another card opens
	useEffect(() => setDraft(""), [card]);
	const itemsRef = useRef(items);
	itemsRef.current = items;
	const fieldsRef = useRef(fields);
	fieldsRef.current = fields;

	useEffect(() => {
		if (!editor) return;
		editor.registerPlugin(
			proposalMarksPlugin((id) => {
				if (spotKeyOf(id) === null) setCurrent(id);
				setCard(id);
			}),
		);
		return () => {
			if (!editor.isDestroyed) editor.unregisterPlugin(proposalMarksKey);
		};
	}, [editor, setCurrent]);

	useEffect(() => {
		if (!editor || editor.isDestroyed) return;
		editor.view.dispatch(
			editor.state.tr
				.setMeta(proposalMarksKey, {
					proposals: items.map(({ item }) => ({
						...item,
						requests: (item.thread ?? []).filter((message) => message.author === "admin").length,
						working: asking.has(item.id),
					})),
					current,
				})
				.setMeta("addToHistory", false),
		);
	}, [editor, items, current, asking]);

	// The proposals drawn now, in the order of the text: what the bubble steps through.
	const bodyShown =
		useEditorState({
			editor,
			selector: ({ editor: now }) => {
				const state = now ? proposalMarksKey.getState(now.state) : undefined;
				return now && state ? drawable(now.state.doc, state.proposals).map((proposal) => proposal.id) : [];
			},
			equalityFn: (a, b) =>
				a === b || (a !== null && b !== null && a.length === b.length && a.every((id, index) => id === b[index])),
		}) ?? [];
	// The field changes drawn now: those whose field still reads as they were planned against, after the body's.
	const fieldShown = fieldItems
		.filter(({ item }) => fields !== undefined && sameValue(fields.values[item.field], item.before))
		.map(({ item }) => item.id);
	const shown = [...bodyShown, ...fieldShown];

	// The places the marks plugin left for request markers, read again after each change of the document or of the marks.
	const [markerPlaces, setMarkerPlaces] = useState<readonly { id: string; element: Element }[]>([]);
	useEffect(() => {
		if (!editor) return;
		const read = () => {
			const found = [...editor.view.dom.querySelectorAll(`[${MARKER_ATTRIBUTE}]`)].map((element) => ({
				id: element.getAttribute(MARKER_ATTRIBUTE) ?? "",
				element,
			}));
			setMarkerPlaces((before) =>
				before.length === found.length && before.every((place, index) => place.element === found[index]?.element)
					? before
					: found,
			);
		};
		read();
		editor.on("transaction", read);
		return () => {
			editor.off("transaction", read);
		};
	}, [editor]);

	const entryOf = (id: string | null): AnyEntry | undefined =>
		items.find(({ item }) => item.id === id) ?? fieldItems.find(({ item }) => item.id === id);
	const position = Math.max(0, shown.indexOf(current ?? ""));
	// The first proposal is the one looked at until another is picked, so its block has the blue line from the start.
	const first = shown[0] ?? null;
	const missing = current !== null && !shown.includes(current);
	useEffect(() => {
		if (first !== null && (current === null || missing || (!picked.current && current !== first)))
			setCurrentState(first);
	}, [first, current, missing]);
	const focused = entryOf(shown[position] ?? null);

	/** The element of the block a proposal replaces: where its card hangs from and what stepping scrolls to. */
	const anchorOf = (id: string | null): HTMLElement | null => {
		const entry = entryOf(id);
		if (entry && isField(entry.item))
			return document.querySelector<HTMLElement>(`[${FIELD_PROPOSAL_ATTRIBUTE}="${CSS.escape(entry.item.field)}"]`);
		const found =
			entry && editor && !isField(entry.item) ? blocksById(editor.state.doc).get(entry.item.blockId) : undefined;
		const dom = found && editor ? editor.view.nodeDOM(found.pos) : null;
		return dom instanceof HTMLElement ? dom : null;
	};

	const step = (by: number) => {
		if (shown.length === 0) return;
		const next = shown[(position + by + shown.length) % shown.length] ?? null;
		setCurrent(next);
		setCard(null);
		anchorOf(next)?.scrollIntoView({ block: "center", behavior: "smooth" });
	};

	const accept = (ids: readonly string[]) => {
		if (!editor) return;
		for (const id of ids) {
			const field = fieldItems.find(({ item }) => item.id === id);
			if (field) {
				// Into the form, as an edit of the admin's: saved with the entry.
				fieldsRef.current?.set({ [field.item.field]: field.item.value });
				field.source.onAcceptField?.(field.item);
				continue;
			}
			const entry = itemsRef.current.find(({ item }) => item.id === id);
			if (!entry) continue;
			const placed = acceptInEditor(editor, site, entry.item);
			if (placed) entry.source.onAccept(entry.item, placed);
		}
		setCard(null);
	};
	const discard = (ids: readonly string[]) => {
		for (const source of sources) {
			const mine = [...source.items, ...(source.fieldItems ?? [])].filter((item) => ids.includes(item.id));
			if (mine.length > 0) source.onDiscard(mine);
		}
		setCard(null);
	};

	// The requests being worked on, by proposal id or selection key: what stops them.
	const running = useRef(new Map<string, AbortController>());
	// Requests in a proposal's card that were stopped before an answer, by proposal: they stay in its thread (this page only; the server never had them).
	const [stoppedAsks, setStoppedAsks] = useState<ReadonlyMap<string, readonly string[]>>(new Map());
	const stop = (id: string) => running.current.get(id)?.abort();

	const ask = async (entry: AnyEntry, text: string) => {
		if (!entry.source.onAsk) return;
		setDraft("");
		setAsking((before) => new Map([...before, [entry.item.id, text]]));
		const controller = new AbortController();
		running.current.set(entry.item.id, controller);
		try {
			const next = await entry.source.onAsk(entry.item, text, controller.signal);
			// The card stays open on the proposal that took its place.
			setCard((open) => (open === entry.item.id ? next : open));
			setCurrent((now) => (now === entry.item.id ? next : now));
		} catch {
			// Stopped: what was asked stays in the thread, marked stopped. Failed: the source says why, and what was written goes back in the box.
			if (controller.signal.aborted)
				setStoppedAsks((before) => new Map([...before, [entry.item.id, [...(before.get(entry.item.id) ?? []), text]]]));
			else setDraft(text);
		} finally {
			running.current.delete(entry.item.id);
			setAsking((before) => new Map([...before].filter(([id]) => id !== entry.item.id)));
		}
	};

	const dispatchSpot = (meta: ProposalMarksMeta) => {
		if (editor && !editor.isDestroyed)
			editor.view.dispatch(editor.state.tr.setMeta(proposalMarksKey, meta).setMeta("addToHistory", false));
	};
	const dropSpot = (key: string) => {
		dispatchSpot({ removeSpot: key });
		setSpots((before) => new Map([...before].filter(([one]) => one !== key)));
	};

	/** Opens a request on the selected words: the highlight and the empty card. Words across blocks, or none, are not asked about. */
	const startSpot = (now: Editor) => {
		const { from, to, empty } = now.state.selection;
		if (empty || !askAt) return;
		const block = topBlockAt(now.state.doc, from);
		const blockId = block?.node.attrs[BLOCK_ID_ATTRIBUTE];
		if (!block || typeof blockId !== "string" || to > block.pos + block.node.nodeSize) return;
		const words = now.state.doc.textBetween(from, to, " ").trim();
		if (!words) return;
		const key = Math.random().toString(36).slice(2);
		// The selection folds to the end of the words: the format bar goes, and the highlight is what marks them now.
		now.view.dispatch(
			now.state.tr
				.setMeta(proposalMarksKey, { addSpot: { key, from, to, working: false } } satisfies ProposalMarksMeta)
				.setMeta("addToHistory", false)
				.setSelection(TextSelection.create(now.state.doc, to)),
		);
		setSpots((before) => new Map([...before, [key, { words, blockId }]]));
		setCard(spotId(key));
	};
	const startRef = useRef(startSpot);
	startRef.current = startSpot;

	// ⌘J on selected words asks about them, as the format bar's button does.
	useEffect(() => {
		if (!editor || !askAt) return;
		const dom = editor.view.dom;
		const onKeyDown = (event: KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== "j")
				return;
			if (editor.state.selection.empty) return;
			event.preventDefault();
			startRef.current(editor);
		};
		dom.addEventListener("keydown", onKeyDown);
		return () => dom.removeEventListener("keydown", onKeyDown);
	}, [editor, askAt]);

	const sendSpot = async (key: string, text: string) => {
		const spot = spots.get(key);
		if (!spot || !askAt) return;
		setDraft("");
		setSpots((before) => new Map([...before, [key, { ...spot, sent: text }]]));
		dispatchSpot({ spotWorking: { key, working: true } });
		const controller = new AbortController();
		running.current.set(spotId(key), controller);
		// Not answered: the words stay marked. Stopped, what was asked stays in the card, marked stopped; failed, it goes back in the box.
		const giveBack = () => {
			const stopped = controller.signal.aborted;
			setSpots(
				(before) => new Map([...before, [key, stopped ? { ...spot, stopped: [...(spot.stopped ?? []), text] } : spot]]),
			);
			dispatchSpot({ spotWorking: { key, working: false } });
			if (!stopped) setDraft(text);
		};
		try {
			// The assistant reads the entry as stored: what the admin wrote last is saved first.
			const saved = save ? await save() : true;
			if (!saved || controller.signal.aborted) return giveBack();
			const next = await askAt({ words: spot.words, blockId: spot.blockId }, text, controller.signal);
			dropSpot(key);
			// The card goes on with the proposal that answers it.
			setCard((open) => (open === spotId(key) ? next : open));
			if (next) setCurrent(next);
		} catch {
			// The source says why when it failed.
			giveBack();
		} finally {
			running.current.delete(spotId(key));
		}
	};

	// A card of selected words closed before anything was sent leaves no request behind.
	const closeCard = () => {
		const key = spotKeyOf(card);
		const spot = key ? spots.get(key) : undefined;
		if (key && spot?.sent === undefined && (spot?.stopped ?? []).length === 0) dropSpot(key);
		setCard(null);
	};

	const opened = entryOf(card);
	const openedThread = opened?.item.thread ?? [];
	const openedAsking = opened ? asking.get(opened.item.id) : undefined;
	const markers = markerPlaces.map(({ id, element }) => {
		// A selection request being worked on: "…" by its block, opening its card.
		if (spotKeyOf(id) !== null)
			return createPortal(
				<Marker
					tone="request"
					margin="proposal"
					active={card === id}
					aria-label={t("marker.working", { count: 1 })}
					onClick={() => setCard((open) => (open === id ? null : id))}
				>
					…
				</Marker>,
				element,
				`marker:${id}`,
			);
		const entry = entryOf(id);
		if (!entry) return null;
		const requests = (entry.item.thread ?? []).filter((message) => message.author === "admin").length;
		const working = asking.has(id);
		return createPortal(
			<Marker
				tone="request"
				margin="proposal"
				active={card === id}
				aria-label={working ? t("marker.working", { count: requests + 1 }) : t("marker", { count: requests })}
				onClick={() => {
					setCurrent(id);
					setCard((open) => (open === id ? null : id));
				}}
			>
				{working ? "…" : requests}
			</Marker>,
			element,
			`marker:${id}`,
		);
	});

	/** The element of a selection request's words: where its card hangs from. */
	const spotAnchor = (id: string): HTMLElement | null =>
		editor?.view.dom.querySelector<HTMLElement>(`[${PROPOSAL_ATTRIBUTE}="${CSS.escape(id)}"]`) ?? null;
	const openSpotKey = spotKeyOf(card);
	const openSpot = openSpotKey ? spots.get(openSpotKey) : undefined;
	/** Requests stopped before an answer: each with the assistant's line saying it stopped. */
	const stoppedMessages = (texts: readonly string[] | undefined) =>
		(texts ?? []).map((text, index) => (
			// biome-ignore lint/suspicious/noArrayIndexKey: stopped requests are only ever added at the end
			<Fragment key={`stopped:${index}`}>
				<MemoMessage author={t("me")}>{text}</MemoMessage>
				<MemoMessage author={t("assistant")} ai time={t("stopped")} />
			</Fragment>
		));
	const spotCard =
		openSpotKey && openSpot && editor ? (
			<MemoCardPopover
				anchor={() => spotAnchor(spotId(openSpotKey))}
				open
				onOpenChange={(open) => {
					if (!open) closeCard();
				}}
				reply={{
					placeholder: openSpot.sent === undefined && !openSpot.stopped?.length ? t("request") : t("reply"),
					value: draft,
					onValueChange: setDraft,
					onSend: (text: string) => void sendSpot(openSpotKey, text),
					sendLabel: t("send"),
					focus: openSpot.sent === undefined,
					...(openSpot.sent !== undefined
						? { stop: { label: t("stop"), onStop: () => stop(spotId(openSpotKey)) } }
						: {}),
				}}
			>
				{(openSpot.sent !== undefined || (openSpot.stopped ?? []).length > 0) && (
					<MemoThread>
						{stoppedMessages(openSpot.stopped)}
						{openSpot.sent !== undefined && (
							<>
								<MemoMessage author={t("me")}>{openSpot.sent}</MemoMessage>
								<MemoMessage author={t("assistant")} ai time={t("working")} />
							</>
						)}
					</MemoThread>
				)}
			</MemoCardPopover>
		) : null;

	// The requests the status bar counts: answered ones are proposals with a request in their card; working ones are being asked again or sent from a selection.
	const workingIds = [
		...[...spots].filter(([, spot]) => spot.sent !== undefined).map(([key]) => spotId(key)),
		...shown.filter((id) => asking.has(id)),
	];
	const answeredIds = shown.filter(
		(id) => !asking.has(id) && (entryOf(id)?.item.thread ?? []).some((message) => message.author === "admin"),
	);
	const requestOrder = [...workingIds, ...answeredIds];
	const nextRequest = useRef(0);
	const requests: EditorRequests | null =
		requestOrder.length === 0
			? null
			: {
					answered: answeredIds.length,
					working: workingIds.length,
					onNext: () => {
						const id = requestOrder[nextRequest.current % requestOrder.length] ?? null;
						nextRequest.current += 1;
						if (!id) return;
						if (spotKeyOf(id) === null) setCurrent(id);
						setCard(id);
						(spotKeyOf(id) === null ? anchorOf(id) : spotAnchor(id))?.scrollIntoView({
							block: "center",
							behavior: "smooth",
						});
					},
				};

	const selectionActions = useMemo<EditorSelectionAction[]>(
		() => (askAt ? [{ id: "proposal:request", label: t("request"), run: (now: Editor) => startRef.current(now) }] : []),
		[askAt, t],
	);

	const overlay = (
		<>
			{shown.length > 0 && focused && (
				<ProposalBubbleDock>
					<ProposalBubble
						name={focused.item.request}
						{...(focused.source.onOpen ? { onOpen: () => focused.source.onOpen?.(focused.item) } : {})}
						position={position + 1}
						total={shown.length}
						previousLabel={t("previous")}
						nextLabel={t("next")}
						onPrevious={() => step(-1)}
						onNext={() => step(1)}
						discardAllLabel={t("discardAll")}
						onDiscardAll={() => discard(shown)}
						acceptAllLabel={t("acceptAll")}
						onAcceptAll={() => accept(shown)}
					/>
				</ProposalBubbleDock>
			)}
			{markers}
			{spotCard}
			{opened && editor && shown.includes(opened.item.id) && (
				<MemoCardPopover
					anchor={() => anchorOf(opened.item.id)}
					open
					onOpenChange={(open) => {
						if (!open) setCard(null);
					}}
					discardLabel={t("discard")}
					onDiscard={() => discard([opened.item.id])}
					discardShortcut={["mod", "Backspace"]}
					acceptLabel={t("accept")}
					onAccept={() => accept([opened.item.id])}
					acceptShortcut={["mod", "Enter"]}
					{...(opened.source.onAsk
						? {
								reply: {
									placeholder: t("reply"),
									value: draft,
									onValueChange: setDraft,
									onSend: (text: string) => void ask(opened, text),
									sendLabel: t("send"),
									...(openedAsking !== undefined
										? { stop: { label: t("stop"), onStop: () => stop(opened.item.id) } }
										: {}),
								},
							}
						: {})}
				>
					<MemoThread>
						{openedThread.length === 0 && openedAsking === undefined ? (
							// Nothing said in the card yet: the request the proposal came from.
							<MemoMessage author={t("me")}>{opened.item.request}</MemoMessage>
						) : (
							openedThread.map((message, index) => (
								<MemoMessage
									// biome-ignore lint/suspicious/noArrayIndexKey: messages are only ever added at the end
									key={index}
									author={message.author === "admin" ? t("me") : t("assistant")}
									ai={message.author === "assistant"}
									time={timeOf(message.at)}
								>
									{message.text}
								</MemoMessage>
							))
						)}
						{stoppedMessages(stoppedAsks.get(opened.item.id))}
						{openedAsking !== undefined && (
							<>
								<MemoMessage author={t("me")}>{openedAsking}</MemoMessage>
								<MemoMessage author={t("assistant")} ai time={t("working")} />
							</>
						)}
					</MemoThread>
				</MemoCardPopover>
			)}
		</>
	);

	const currentEntry = entryOf(current);
	const fieldProposals: FieldProposals = {
		byField: new Map(
			fieldItems
				.filter(({ item }) => fieldShown.includes(item.id))
				.map(({ item }) => [
					item.field,
					{
						id: item.id,
						before: item.before,
						value: item.value,
						current: item.id === current,
						open: () => {
							setCurrent(item.id);
							setCard(item.id);
						},
						accept: () => accept([item.id]),
					},
				]),
		),
		current: currentEntry && isField(currentEntry.item) ? currentEntry.item.field : null,
	};

	return { onEditor: setEditor, overlay, selectionActions, requests, fieldProposals };
}
