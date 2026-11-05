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

/** A screen's unsaved changes: how many, and how to drop them when the person leaves without saving. */
type Guard = { count: () => number; drop: () => void };

const Context = createContext<{ add: (guard: Guard) => () => void; leave: (go: () => void) => void } | null>(null);

/**
 * Asks before leaving a screen with unsaved changes (doc 05, flow 11 step 04): keep editing or leave without saving. Proposals are on the server, so
 * they never stop a leave. Closing the browser tab with changes gets the browser's own question.
 */
export function LeaveGuardProvider({ children }: { children: ReactNode }) {
	const { t } = useAdmin();
	const guards = useRef(new Set<Guard>());
	const [asking, setAsking] = useState<{ go: () => void; count: number } | null>(null);
	const count = useCallback(() => [...guards.current].reduce((sum, guard) => sum + guard.count(), 0), []);

	useEffect(() => {
		const warn = (event: BeforeUnloadEvent) => {
			if (count() > 0) event.preventDefault();
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [count]);

	const value = useMemo(
		() => ({
			add: (guard: Guard) => {
				guards.current.add(guard);
				return () => {
					guards.current.delete(guard);
				};
			},
			leave: (go: () => void) => {
				const changed = count();
				if (changed === 0) go();
				else setAsking({ go, count: changed });
			},
		}),
		[count],
	);
	return (
		<Context.Provider value={value}>
			{children}
			<AlertDialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("leave.title")}</AlertDialogTitle>
						<AlertDialogDescription>{t("leave.description", { count: asking?.count ?? 0 })}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							variant="danger"
							onClick={() => {
								for (const guard of guards.current) guard.drop();
								asking?.go();
								setAsking(null);
							}}
						>
							{t("leave.discard")}
						</AlertDialogCancel>
						<AlertDialogAction onClick={() => setAsking(null)}>{t("leave.stay")}</AlertDialogAction>
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

/** Keeps the person from leaving this screen's unsaved changes by mistake. */
export function useLeaveGuard(draft: { changes: unknown[]; revertAll: () => void }) {
	const context = useContext(Context);
	const latest = useRef(draft);
	latest.current = draft;
	useEffect(
		() => context?.add({ count: () => latest.current.changes.length, drop: () => latest.current.revertAll() }),
		[context],
	);
}
