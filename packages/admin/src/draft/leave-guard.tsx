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
type Guard = { changes: () => number; uploads: () => number; drop: () => void };
type Held = { changes: number; uploads: number };

const Context = createContext<{
	add: (guard: Guard) => () => void;
	/** `filesOnly`: a step that keeps the draft but ends what goes up. It asks only about the files, and drops only them. */
	leave: (go: () => void, filesOnly?: boolean) => void;
	/** How many files are still going up on the screens that are open. */
	uploads: () => number;
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

/** Keeps the person from leaving this screen's unsaved changes, or its files still going up, by mistake. */
export function useLeaveGuard(draft: { changes?: unknown[]; uploads?: unknown[]; revertAll: () => void }) {
	const context = useContext(Context);
	const latest = useRef(draft);
	latest.current = draft;
	useEffect(
		() =>
			context?.add({
				changes: () => latest.current.changes?.length ?? 0,
				uploads: () => latest.current.uploads?.length ?? 0,
				drop: () => latest.current.revertAll(),
			}),
		[context],
	);
}
