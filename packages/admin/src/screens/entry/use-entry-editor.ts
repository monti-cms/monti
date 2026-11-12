import type { Block, BodyOp, Doc, EntryState, MediaItem, MediaQueryResult, PublishTask } from "@monti-cms/core";
import { MEDIA_QUERY_MOST } from "@monti-cms/core";
import { toast } from "@monti-cms/ui";
import type { Editor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Path, useDraft } from "../../draft/use-draft";
import type { ProposalItem } from "../../draft/use-proposals";
import { useAdmin } from "../../operations/admin-context";
import { useOperation, useRead } from "../../operations/use-operation";
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

/** The places an `entries.save` proposal writes (doc 05): the screen draws them over the entry. */
function entryProposal(item: ProposalItem): Record<Path, unknown> {
	if (item.operation !== "entries.save") return {};
	const input = item.input as { title?: string; slug?: string; values?: Record<string, unknown>; doc?: unknown };
	return {
		...(input.title === undefined ? {} : { title: input.title }),
		...(input.slug === undefined ? {} : { slug: input.slug }),
		...(input.doc === undefined ? {} : { doc: input.doc }),
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
export function useEntryEditor(source: EditorSource) {
	const isEntry = source.kind === "entry";
	const read = useRead<EntryRead | TemplateRead>(
		isEntry ? "entries.get" : "templates.get",
		{ id: source.id ?? "" },
		{ skip: source.id === null },
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
				const read = await readFiles({ ids: part, pageSize: part.length }).catch(() => null);
				if (read?.ok) found.push(...read.body.items);
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

	/**
	 * The body's editor. A banner's answer takes the banner away, and the button that was pressed with it: the cursor goes to the text, where the person
	 * goes on, or the keyboard would be left on nothing (T135).
	 */
	const bodyEditor = useRef<Editor | null>(null);
	const focusNextBody = useRef(false);
	const focusBody = useCallback(() => {
		const made = bodyEditor.current;
		// The body is not on screen (the compare screen is), or it is about to be made again: the next one takes the cursor.
		if (!made || made.isDestroyed) focusNextBody.current = true;
		else made.commands.focus(null, { scrollIntoView: false });
	}, []);
	const keepBody = useCallback((made: Editor | null) => {
		bodyEditor.current = made;
		if (!made || !focusNextBody.current) return;
		focusNextBody.current = false;
		made.commands.focus(null, { scrollIntoView: false });
	}, []);

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
				.map(({ item }) => ({ id: item.id, request: item.request, ops: (item.input as { ops: BodyOp[] }).ops })),
		[draft.proposals],
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
			const input = isEntry
				? {
						id: source.id,
						version: at ?? version,
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
												return [path.slice("values.".length), isEmpty(value) ? null : value];
											}),
									),
								}
							: {}),
					}
				: { ...(source.id ? { id: source.id, version: at ?? version } : {}), name: title.trim(), doc };
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
					toast.error(
						t(answer.refusal.reason ?? { key: "errors.unexpected", values: { message: answer.refusal.error } }),
					);
				return null;
			}
			setConflict(null);
			// A new template becomes a page of its own; the screen moves to it.
			if (source.id === null) {
				draft.saved();
				return { id: answer.body.output.id };
			}
			await reload();
			draft.saved();
			return { id: answer.body.output.id };
		},
		[loaded, version, draft, source.id, isEntry, title, doc, saveOp, latestOp, reload, t],
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
		loadLatest: async () => {
			await reload();
			draft.revertAll();
			setConflict(null);
			focusNextBody.current = true;
			setBodyKey((key) => key + 1);
		},
		/** The other way out: my changes go over the server's latest. */
		saveOver: async () => {
			const latest = await latestOp.run({ id: source.id });
			if (!latest.ok) return null;
			return save("entry" in latest.body ? latest.body.entry.version : latest.body.version);
		},
		browserCopy: draft.browserCopy,
		/** The kept copy goes in, in one step, and the body is made again from it with the cursor in it. */
		loadBrowserCopy: () => {
			if (!draft.browserCopy) return;
			draft.loadBrowserCopy();
			focusNextBody.current = true;
			setBodyKey((key) => key + 1);
		},
		dropBrowserCopy: () => {
			draft.dropBrowserCopy();
			focusBody();
		},
		/** Hands the body's editor over as it is made (`BodyEditor onEditor`). */
		keepBody,
		/** The session ended: to the login screen, and back to this entry with what was typed (`restore`). */
		signIn: signInAgain,
		bodyKey,
		bodyProposals,
		/** A body proposal the body editor put in: counted as taken, and sent with the next save. */
		takeBody: draft.markTaken,
		discardProposal: draft.discard,
		discardProposals: draft.discardAll,
	};
}

export type EntryEditorModel = ReturnType<typeof useEntryEditor>;
