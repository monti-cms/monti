import type { Block, BodyOp, Doc, EntryState, MediaItem, MediaQueryResult, PublishTask } from "@monti-cms/core";
import { MEDIA_QUERY_MOST } from "@monti-cms/core";
import { toast } from "@monti-cms/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Path, useDraft } from "../../draft/use-draft";
import type { ProposalItem } from "../../draft/use-proposals";
import { useAdmin } from "../../operations/admin-context";
import { reasonOf, useOperation, useRead } from "../../operations/use-operation";
import { useSignInAgain } from "../frame/session-ended";

/** What the editor writes: an entry, or a template (its name stands where an entry's title does). `id` is `null` for a new template. */
export type EditorSource = { kind: "entry"; id: string } | { kind: "template"; id: string | null };

/** `entries.get`, as JSON brings it. */
export type EntryRead = {
	entry: {
		id: string;
		collection: string;
		locale: string;
		translationGroup: string;
		title: string;
		slug: string;
		values: Record<string, unknown>;
		doc: Doc | null;
		version: number;
		updatedAt: string;
		trashedAt: string | null;
	};
	state: EntryState;
	published: { slug: string; path: string | null; publishedAt: string; fromVersion: number } | null;
	tasks: PublishTask[];
	/** The library's files the body shows. */
	media: MediaItem[];
};

type TemplateRead = { id: string; name: string; doc: Doc; version: number; updatedAt?: string; media?: MediaItem[] };

/** The library's files a body's blocks show, by id, each once. */
function mediaOf(blocks: readonly Block[], ids = new Set<string>()): Set<string> {
	for (const block of blocks) {
		const media = block.attrs?.media;
		if (typeof media === "string" && media !== "") ids.add(media);
		if (block.children) mediaOf(block.children, ids);
	}
	return ids;
}

/** The save cell (doc 02, save): one of four, or "signed out" when the session ended (T39). */
export type SaveState = "unsaved" | "saved" | "browser" | "conflict" | "signedOut";

const EMPTY: Doc = { type: "doc", blocks: [] };
const NEW_TEMPLATE: TemplateRead = { id: "", name: "", doc: EMPTY, version: 0 };

/** The saved values by path: `title`, `slug`, `doc` and `values.<field>`. A template has a title (its name) and a body. */
function basePaths(read: EntryRead | TemplateRead): Record<Path, unknown> {
	if ("entry" in read) {
		const { title, slug, values, doc } = read.entry;
		return {
			title,
			slug,
			doc: doc ?? EMPTY,
			...Object.fromEntries(Object.entries(values).map(([field, value]) => [`values.${field}`, value])),
		};
	}
	return { title: read.name, doc: read.doc };
}

/**
 * The places an `entries.save` proposal writes (doc 05): the screen draws them over the entry, the title in the title and each field's value
 * in its field (T86). A save that brings a whole body is not drawn here: the editor draws a body's changes block by block (`body.edit`),
 * and a whole body taken into the draft would stand in the save without ever having stood on the screen. It waits on its conversation's
 * card and review page.
 */
function entryProposal(item: ProposalItem): Record<Path, unknown> {
	if (item.operation !== "entries.save") return {};
	const input = item.input as { title?: string; slug?: string; values?: Record<string, unknown>; doc?: unknown };
	if (input.doc !== undefined) return {};
	return {
		...(input.title === undefined ? {} : { title: input.title }),
		...(input.slug === undefined ? {} : { slug: input.slug }),
		...Object.fromEntries(Object.entries(input.values ?? {}).map(([field, value]) => [`values.${field}`, value])),
	};
}
const noProposal = () => ({});

/** An empty field is no value: the save sends `null` for it, which empties it on the server. */
const isEmpty = (value: unknown) =>
	value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

/**
 * The editor's draft of one entry or template (doc 02, the screen pieces): the saved copy, my changes over it (kept in this browser until saved, and offered
 * back when the page opens again), the save with the version it read, and what a refused save means. The entry editor and the template editor use it.
 */
export function useEntryEditor(
	source: EditorSource,
	/**
	 * The fields that are not the entry's with these values: those of a conditional field's options that are not chosen (doc 19). The save
	 * sends them empty, so what the panel said the save clears is cleared, and a value typed before the choice was changed is not refused.
	 */
	notChosen?: (values: Record<string, unknown>, locale: string) => Set<string>,
) {
	const isEntry = source.kind === "entry";
	const read = useRead<EntryRead | TemplateRead>(
		isEntry ? "entries.get" : "templates.get",
		{ id: source.id ?? "" },
		// The editor says every failure of this read itself: its own banner while it has nothing to show, and once it has, the toast
		// that answers the press which read again (a save, "load the latest").
		{ skip: source.id === null, own: "answered" },
	);
	const saveOp = useOperation<{ output: { id: string; version: number } }>(isEntry ? "entries.save" : "templates.save");
	const latestOp = useOperation<EntryRead | TemplateRead>(isEntry ? "entries.get" : "templates.get");
	const filesOp = useOperation<MediaQueryResult>("media.query");
	/** The files of a kept copy's body that the server's body does not show: its pictures hold their places too when the copy goes in. */
	const [keptFiles, setKeptFiles] = useState<readonly MediaItem[]>([]);
	const { session, t } = useAdmin();
	const signInAgain = useSignInAgain();
	const loaded = source.id === null ? NEW_TEMPLATE : read.data;
	const base = useMemo(() => (loaded ? basePaths(loaded) : null), [loaded]);
	const version = loaded ? ("entry" in loaded ? loaded.entry.version : loaded.version) : null;
	/**
	 * The version my own save wrote, while the screen has not read it again (no answer to the read). What is on the screen was written on it: the next
	 * save is sent against it, or it would be refused as someone else's. A read that lands is the base again.
	 */
	const [written, setWritten] = useState<number | null>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: a read landed, whatever it holds
	useEffect(() => setWritten(null), [loaded]);
	const target = useMemo(() => ({ kind: source.kind, id: source.id ?? "new" }), [source.kind, source.id]);
	const draft = useDraft({
		target,
		base,
		version,
		proposalValues: isEntry ? entryProposal : noProposal,
		restore: "ask",
		leftSignedOut: session.ended,
	});
	const served = loaded?.media;
	/**
	 * A kept copy's files are read as soon as the copy is offered, not when it is taken: by the time a person presses "load" they are known, so the copy
	 * goes in in one step. Reading them after the press left the banner standing meanwhile, with a button that did nothing and a body that took typing
	 * only to lose it (T135). A copy taken before the read answers goes in all the same, and its body reads what it lacks, as any body does.
	 */
	const keptDoc = draft.browserCopy?.mine.find(([path]) => path === "doc")?.[1] as Doc | null | undefined;
	const readFor = useRef<Doc | null>(null);
	const readFiles = filesOp.run;
	useEffect(() => {
		if (!keptDoc || !loaded || readFor.current === keptDoc) return;
		readFor.current = keptDoc;
		const known = new Set(served?.map((item) => item.id));
		const ids = [...mediaOf(keptDoc.blocks ?? [])].filter((id) => !known.has(id));
		void (async () => {
			const found: MediaItem[] = [];
			for (let start = 0; start < ids.length; start += MEDIA_QUERY_MOST) {
				const part = ids.slice(start, start + MEDIA_QUERY_MOST);
				const read = await readFiles({ ids: part, pageSize: part.length });
				if (read.ok) found.push(...read.body.items);
			}
			if (found.length > 0) setKeptFiles(found);
		})();
	}, [keptDoc, loaded, served, readFiles]);
	const files = useMemo(
		() => (served && keptFiles.length > 0 ? [...keptFiles, ...served] : served),
		[served, keptFiles],
	);
	/** Another save got in first: when, so the banner can say it. */
	const [conflict, setConflict] = useState<{ at: Date | null } | null>(null);
	/** Bumped when the body shown changes other than by typing (the latest loaded, a kept copy taken): the body editor mounts again. */
	const [bodyKey, setBodyKey] = useState(0);

	const fields = useMemo(() => {
		const keys = new Set(Object.keys(base ?? {}));
		for (const change of draft.changes) keys.add(change.path);
		return [...keys].filter((path) => path.startsWith("values.")).map((path) => path.slice("values.".length));
	}, [base, draft.changes]);

	/** The assistant's body proposals not yet taken (`body.edit` items, T32): the body editor draws them, the bubble walks them. */
	const bodyProposals = useMemo(
		() =>
			draft.proposals
				.filter(({ item }) => item.operation === "body.edit")
				.map(({ item }) => ({
					id: item.id,
					request: item.request,
					conversationId: item.conversationId,
					ops: (item.input as { ops: BodyOp[] }).ops,
					was: item.preview?.was,
					thread: item.thread ?? [],
				})),
		[draft.proposals],
	);

	/**
	 * The assistant's proposals for the title and the fields not yet taken (`entries.save` items, T86), each with the places it would change
	 * on what the screen shows now: the title and the property panel draw them, and the bubble walks them with the body's.
	 */
	const fieldProposals = useMemo(
		() =>
			draft.drawn
				.filter(({ item }) => item.operation === "entries.save")
				.map(({ item, values }) => ({
					id: item.id,
					request: item.request,
					conversationId: item.conversationId,
					paths: Object.keys(values).filter((path) => {
						const cell = draft.cell(path);
						return cell.kind === "proposed" && cell.item.id === item.id;
					}),
				})),
		[draft.drawn, draft.cell],
	);

	const title = String(draft.value("title") ?? "");
	const doc = (draft.value("doc") as Doc | undefined) ?? EMPTY;

	const signedOut = session.ended;
	const saveState: SaveState = signedOut
		? "signedOut"
		: conflict
			? "conflict"
			: draft.browserCopy
				? "browser"
				: draft.dirty
					? "unsaved"
					: "saved";

	const reload = read.reload;

	/**
	 * Sends my changes with the version they were made on (`at`: another version, when the person chose to save over a newer one). Resolves to the saved
	 * record's id, or `null` when the save was refused: a conflict, an ended session, or a check (`refusal`).
	 */
	const save = useCallback(
		async (at?: number): Promise<{ id: string } | null> => {
			if (!loaded || version === null) return null;
			if (!draft.dirty && source.id !== null) return { id: source.id };
			const changed = new Set(draft.changes.map((change) => change.path));
			// What this save sends: when it ends, only that is let go. What is typed while it is under way stays unsaved (T230).
			const sent = {
				mine: new Map(draft.changes.map((change) => [change.path, change.after])),
				accepted: draft.accepted,
			};
			const hidden =
				notChosen && "entry" in loaded
					? notChosen(
							Object.fromEntries(fields.map((field) => [field, draft.value(`values.${field}`)])),
							loaded.entry.locale,
						)
					: new Set<string>();
			const input = isEntry
				? {
						id: source.id,
						version: at ?? written ?? version,
						...(changed.has("title") ? { title } : {}),
						...(changed.has("slug") ? { slug: String(draft.value("slug") ?? "") } : {}),
						...(changed.has("doc") ? { doc } : {}),
						...([...changed].some((path) => path.startsWith("values."))
							? {
									values: Object.fromEntries(
										[...changed]
											.filter((path) => path.startsWith("values."))
											.map((path) => {
												const value = draft.value(path);
												const field = path.slice("values.".length);
												return [field, isEmpty(value) || hidden.has(field) ? null : value];
											}),
									),
								}
							: {}),
					}
				: { ...(source.id ? { id: source.id, version: at ?? written ?? version } : {}), name: title.trim(), doc };
			const answer = await saveOp.run(input, { accepted: draft.accepted });
			if (!answer.ok) {
				// An ended session is the admin's state (useOperation hears it); the save waits here until the person signs in again.
				if (answer.refusal.error === "conflict") {
					const latest = await latestOp.run({ id: source.id });
					const at = latest.ok
						? "entry" in latest.body
							? latest.body.entry.updatedAt
							: latest.body.updatedAt
						: undefined;
					setConflict({ at: at ? new Date(at) : null });
				} else if (answer.refusal.status !== 401)
					// A check the save failed (a file the library does not have): the reason, or the save would just stay unsaved with no word.
					toast.error(t(reasonOf(answer.refusal)));
				return null;
			}
			setConflict(null);
			// A new template becomes a page of its own; the screen moves to it.
			if (source.id === null) {
				// All of it: the screen moves to the template's own page, and nothing typed meanwhile is kept for a page that is gone.
				draft.saved();
				return { id: answer.body.output.id };
			}
			// The save went through. My changes are let go only once the screen has read what was saved: let go over the copy from before the save, the
			// old text came back in their place and the next save was a conflict with my own.
			const again = await reload();
			if (again.ok) draft.saved(sent);
			else {
				setWritten(answer.body.output.version);
				// An ended session says so in its own banner, as for the save itself.
				if (again.refusal.status !== 401) toast.error(t(isEntry ? "entry.savedNotRead" : "templates.savedNotRead"));
			}
			return { id: answer.body.output.id };
		},
		[loaded, version, written, draft, source.id, isEntry, title, doc, saveOp, latestOp, reload, t, fields, notChosen],
	);

	return {
		/** The saved copy as the server gave it; `null` while it loads. */
		loaded,
		/** The library's files the saved body shows, for the body editor's first draw. */
		files,
		/** Reading it failed: the screen offers to try again. */
		loadRefusal: read.data ? null : read.refusal,
		reload,
		draft,
		value: draft.value,
		set: draft.set,
		title,
		doc,
		/** The fields with a value, saved or mine. */
		fields,
		dirty: draft.dirty,
		saveState,
		saving: saveOp.pending,
		/** Why the last save was refused, when it was a check and not a conflict or an ended session. */
		refusal: saveOp.refusal && saveOp.refusal.error !== "conflict" && !signedOut ? saveOp.refusal : null,
		save,
		conflict,
		/** The conflict's way out: the server's latest goes in and my changes are dropped. */
		/** Resolves to whether the latest was read: not read (refused, no answer), nothing is dropped and the conflict stands, and a toast says so. */
		loadLatest: async () => {
			const again = await reload();
			if (!again.ok) {
				if (again.refusal.status !== 401) toast.error(t(isEntry ? "entry.loadFailed" : "templates.loadFailed"));
				return false;
			}
			draft.revertAll();
			setConflict(null);
			setBodyKey((key) => key + 1);
			return true;
		},
		/** The other way out: my changes go over the server's latest. */
		saveOver: async () => {
			const latest = await latestOp.run({ id: source.id });
			if (!latest.ok) return null;
			return save("entry" in latest.body ? latest.body.entry.version : latest.body.version);
		},
		browserCopy: draft.browserCopy,
		/** The kept copy goes in, in one step, and the body is made again from it. */
		loadBrowserCopy: () => {
			if (!draft.browserCopy) return;
			draft.loadBrowserCopy();
			setBodyKey((key) => key + 1);
		},
		dropBrowserCopy: draft.dropBrowserCopy,
		/** The session ended: to the login screen, and back to this entry with what was typed (`restore`). */
		signIn: signInAgain,
		bodyKey,
		bodyProposals,
		fieldProposals,
		/** A body proposal the body editor put in: counted as taken, and sent with the next save. */
		takeBody: draft.markTaken,
		discardProposal: draft.discard,
		discardProposals: draft.discardAll,
	};
}

export type EntryEditorModel = ReturnType<typeof useEntryEditor>;
