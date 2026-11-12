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
	/** Saves every screen that holds unsaved changes. `true` when nothing is left unsaved. */
	save: () => Promise<boolean>;
} | null>(null);

/**
 * Asks before leaving a screen with unsaved changes (doc 05, flow 11 step 04): keep editing or leave without saving. Proposals are on the server, so
 * they never stop a leave. Closing the browser tab with changes gets the browser's own question.
 */
export function LeaveGuardProvider({ children }: { children: ReactNode }) {
	const { t } = useAdmin();
	const guards = useRef(new Set<Guard>());
	const [asking, setAsking] = useState<({ go: () => void; filesOnly: boolean } & Held) | null>(null);
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
			save: async () => {
				for (const guard of [...guards.current]) if (guard.changes() > 0 && !(await guard.save())) return false;
				return true;
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
		() => ({ can: () => context?.canSave() ?? false, save: async () => (context ? context.save() : false) }),
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
