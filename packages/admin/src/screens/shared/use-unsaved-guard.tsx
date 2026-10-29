"use client";

import { useTranslator } from "@monti-cms/core/site";
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
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { commonMessages } from "../../lib/common.messages";
import { useBeforeUnload } from "../../lib/hooks/use-before-unload";
import { discardConfirm, useConfirm } from "./confirm-dialog";

/** The question asked when a link would leave the screen with unsaved changes: how many changes are lost, leave without saving or keep editing. */
function LeaveDialog({
	open,
	count,
	onStay,
	onLeave,
}: {
	open: boolean;
	count: number;
	onStay: () => void;
	onLeave: () => void;
}) {
	const t = useTranslator(commonMessages);
	return (
		<AlertDialog open={open} onOpenChange={(next) => !next && onStay()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("leave.title")}</AlertDialogTitle>
					<AlertDialogDescription>{t("leave.description", { count })}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel variant="danger" onClick={onLeave}>
						{t("leave.confirm")}
					</AlertDialogCancel>
					<AlertDialogAction type="button" onClick={onStay}>
						{t("leave.stay")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

/**
 * Guards a screen with unsaved changes against leaving: the browser asks before a reload or a closed tab, and a click on a link inside the
 * admin asks before it goes. Links inside an element marked `data-unsaved-guard="off"` are not a way out and pass. Render the returned `dialog` once on the screen.
 * With `changes` (how many places are changed) the question names them and offers "leave without saving" or "keep editing"; without it the question is the shared
 * discard confirm.
 */
export function useUnsavedGuard(dirty: boolean, options?: { changes: number }): { dialog: ReactNode } {
	const t = useTranslator(commonMessages);
	const { confirm, dialog: confirmDialog } = useConfirm();
	const bypass = useRef(false);
	const asks = options !== undefined;
	// The link that was clicked while the leave question is open.
	const [pending, setPending] = useState<HTMLAnchorElement | null>(null);

	useBeforeUnload(dirty);

	/** Click again with the guard off, so the host's router does the navigation as it would have. */
	const follow = useCallback((anchor: HTMLAnchorElement) => {
		bypass.current = true;
		anchor.click();
		bypass.current = false;
	}, []);

	useEffect(() => {
		if (!dirty) return;
		const onClick = (event: MouseEvent) => {
			if (bypass.current || event.defaultPrevented || event.button !== 0) return;
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
			const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
			if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
			// Links that only move within the screen (its tabs) keep the draft, so they are not a way out.
			if (anchor.closest("[data-unsaved-guard='off']")) return;
			const url = new URL(anchor.href, window.location.href);
			if (url.origin !== window.location.origin) return;
			// A change of the hash only stays on the page.
			if (url.pathname === window.location.pathname && url.search === window.location.search) return;
			event.preventDefault();
			event.stopPropagation();
			if (asks) {
				setPending(anchor);
				return;
			}
			void confirm(discardConfirm(t)).then((ok) => {
				if (ok) follow(anchor);
			});
		};
		document.addEventListener("click", onClick, true);
		return () => document.removeEventListener("click", onClick, true);
	}, [dirty, asks, confirm, follow, t]);

	const leave = () => {
		const anchor = pending;
		setPending(null);
		if (anchor) follow(anchor);
	};

	return {
		dialog: (
			<>
				{confirmDialog}
				{asks && (
					<LeaveDialog
						open={pending !== null}
						count={options.changes}
						onStay={() => setPending(null)}
						onLeave={leave}
					/>
				)}
			</>
		),
	};
}
