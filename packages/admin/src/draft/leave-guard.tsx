import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@monti-cms/ui";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "../operations/admin-context";

/** What a screen would lose: unsaved changes and files still going up, how many of each, and how to drop them when the person leaves anyway. */
type Guard = {
	changes: () => number;
	uploads: () => number;
	drop: () => void;
	/** Whether the screen gave a way to save it from outside. */
	canSave: () => boolean;
	/** Saves what the screen holds, as its own save does (it says a refusal itself). `true` when it went through. */
	save: () => Promise<boolean>;
};
type Held = { changes: number; uploads: number };

const Context = createContext<{
	add: (guard: Guard) => () => void;
	/** `filesOnly`: a step that keeps the draft but ends what goes up. It asks only about the files, and drops only them. */
	leave: (go: () => void, filesOnly?: boolean) => void;
	/** How many files are still going up on the screens that are open. */
	uploads: () => number;
	/** How many unsaved changes the open screens hold. */
	changes: () => number;
	/** Whether every screen that holds unsaved changes can be saved from outside it. */
	canSave: () => boolean;
	/**
	 * Saves every screen that holds unsaved changes, and answers once the screens have drawn what the save left. `saved`: nothing is left
	 * unsaved, as the guards read it. `refused`: a save did not go through. `edited`: something was changed while it was saved, so there are
	 * unsaved changes again (or what was typed meanwhile was taken by the save's clean-up: the screen is still the place to look).
	 */
	save: () => Promise<SaveOutcome>;
	/** A screen drew its unsaved changes again (`count` of them); `edited`: something in them is not what it was. */
	changed: (count: number, edited: boolean) => void;
} | null>(null);

/** How saving the open screens from outside went (`useSaveUnsaved`). */
export type SaveOutcome = "saved" | "refused" | "edited";

/** How long a save that went through is waited on to show in its screen, before it counts as not clean. */
const DRAWN_WITHIN = 5000;

/**
 * Asks before leaving a screen with unsaved changes (doc 05, flow 11 step 04): keep editing or leave without saving. Proposals are on the server, so
 * they never stop a leave. Closing the browser tab with changes gets the browser's own question.
 */
export function LeaveGuardProvider({ children }: { children: ReactNode }) {
	const { t } = useAdmin();
	const guards = useRef(new Set<Guard>());
	const [asking, setAsking] = useState<({ go: () => void; filesOnly: boolean } & Held) | null>(null);
	// A save from outside that is under way, and whether a screen's changes moved while it was; and what waits for the screens to draw.
	const savingNow = useRef<{ edited: boolean } | null>(null);
	const waiters = useRef(new Set<() => void>());
	const held = useCallback(
		(): Held => ({
			changes: [...guards.current].reduce((sum, guard) => sum + guard.changes(), 0),
			uploads: [...guards.current].reduce((sum, guard) => sum + guard.uploads(), 0),
		}),
		[],
	);

	useEffect(() => {
		const warn = (event: BeforeUnloadEvent) => {
			const { changes, uploads } = held();
			if (changes + uploads > 0) event.preventDefault();
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [held]);

	const value = useMemo(
		() => ({
			add: (guard: Guard) => {
				guards.current.add(guard);
				return () => {
					guards.current.delete(guard);
				};
			},
			leave: (go: () => void, filesOnly = false) => {
				const now = held();
				const changes = filesOnly ? 0 : now.changes;
				if (changes + now.uploads === 0) go();
				else setAsking({ go, filesOnly, changes, uploads: now.uploads });
			},
			uploads: () => held().uploads,
			changes: () => held().changes,
			canSave: () => [...guards.current].every((guard) => guard.changes() === 0 || guard.canSave()),
			changed: (count: number, edited: boolean) => {
				// A change that is there and is not what it was, while a save is under way, was made during it: the save's own clean-up
				// leaves none.
				if (savingNow.current && count > 0 && edited) savingNow.current.edited = true;
				for (const look of [...waiters.current]) look();
			},
			save: async (): Promise<SaveOutcome> => {
				const now = { edited: false };
				savingNow.current = now;
				try {
					for (const guard of [...guards.current]) if (guard.changes() > 0 && !(await guard.save())) return "refused";
					// A guard is read as its screen last drew it: the answer waits until the screens have drawn what the save left, told
					// by the screens themselves (`changed`), not by a time.
					await new Promise<void>((resolve) => {
						const done = () => {
							waiters.current.delete(look);
							clearTimeout(limit);
							resolve();
						};
						const look = () => {
							if (now.edited || held().changes === 0) done();
						};
						const limit = setTimeout(done, DRAWN_WITHIN);
						waiters.current.add(look);
						look();
					});
					return now.edited || held().changes > 0 ? "edited" : "saved";
				} finally {
					savingNow.current = null;
				}
			},
		}),
		[held],
	);
	// Files only: saying "unsaved changes" of them leaves the person guessing what the number is (usability, U10).
	const onlyFiles = asking !== null && asking.changes === 0;
	return (
		<Context.Provider value={value}>
			{children}
			<AlertDialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t(onlyFiles ? "leave.uploads.title" : "leave.title")}</AlertDialogTitle>
						<AlertDialogDescription>
							{[
								asking?.changes ? t("leave.description", { count: asking.changes }) : null,
								asking?.uploads ? t("leave.uploads.description", { count: asking.uploads }) : null,
							]
								.filter(Boolean)
								.join(" ")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							variant="danger"
							onClick={() => {
								for (const guard of guards.current) if (!asking?.filesOnly || guard.uploads() > 0) guard.drop();
								asking?.go();
								setAsking(null);
							}}
						>
							{t(asking?.filesOnly ? "leave.uploads.stop" : onlyFiles ? "leave.uploads.discard" : "leave.discard")}
						</AlertDialogCancel>
						<AlertDialogAction onClick={() => setAsking(null)}>
							{t(onlyFiles ? "leave.uploads.stay" : "leave.stay")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Context.Provider>
	);
}

/** `leave(go)`: goes at once, or asks first when a screen has unsaved changes. The frame's moves go through it. */
export function useLeave() {
	const context = useContext(Context);
	return useCallback((go: () => void) => (context ? context.leave(go) : go()), [context]);
}

/** Like `useLeave`, for a step inside a screen that keeps the draft but ends what goes up: a change of view, the comparison. */
export function useLeaveFiles() {
	const context = useContext(Context);
	return useCallback((go: () => void) => (context ? context.leave(go, true) : go()), [context]);
}

/** How many files are still going up, asked at the moment of an action that must wait for them (archiving an entry). */
export function useUploadsGoing() {
	const context = useContext(Context);
	return useCallback(() => context?.uploads() ?? 0, [context]);
}

/**
 * How many unsaved changes the open screens hold, asked at the moment something else would move the screen without the person's own press (the
 * assistant opening an entry): it does not move then, and nothing is asked.
 */
export function useUnsavedChanges() {
	const context = useContext(Context);
	return useCallback(() => context?.changes() ?? 0, [context]);
}

/**
 * Saving the open screens from outside them (the assistant's "save and open": doc 10, flow 2·05). `can`: every screen with unsaved changes
 * gave a way to save it (the editors do; a panel beside a list does not). `save`: saves them as their own save does, which says a refusal
 * itself; `true` when it all went through.
 */
export function useSaveUnsaved() {
	const context = useContext(Context);
	return useMemo(
		() => ({
			can: () => context?.canSave() ?? false,
			save: async (): Promise<SaveOutcome> => (context ? context.save() : "refused"),
		}),
		[context],
	);
}

/**
 * Keeps the person from leaving this screen's unsaved changes, or its files still going up, by mistake. `save`: the screen's own save, when
 * something outside it may ask for it (`useSaveUnsaved`).
 */
export function useLeaveGuard(draft: {
	changes?: unknown[];
	uploads?: unknown[];
	revertAll: () => void;
	save?: () => Promise<boolean>;
}) {
	const context = useContext(Context);
	const latest = useRef(draft);
	latest.current = draft;
	// Told as the screen draws another list of changes: an edit, or a save that cleared them.
	const { changes } = draft;
	const drawn = useRef<unknown[]>([]);
	useEffect(() => {
		const now = changes ?? [];
		// The list is made again whenever the screen reads anything; it is another list only when a place or what was put there differs.
		const part = (change: unknown) => change as { path?: unknown; after?: unknown } | null;
		const edited =
			now.length !== drawn.current.length ||
			now.some((change, index) => {
				const was = part(drawn.current[index]);
				return part(change)?.path !== was?.path || part(change)?.after !== was?.after;
			});
		drawn.current = now;
		context?.changed(now.length, edited);
	}, [context, changes]);
	useEffect(
		() =>
			context?.add({
				changes: () => latest.current.changes?.length ?? 0,
				uploads: () => latest.current.uploads?.length ?? 0,
				drop: () => latest.current.revertAll(),
				canSave: () => latest.current.save !== undefined,
				save: () => latest.current.save?.() ?? Promise.resolve(false),
			}),
		[context],
	);
}
