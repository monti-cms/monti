"use client";

import { createTranslator } from "@monti-cms/core/client";
import { type ReactNode, useCallback, useRef, useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "../../ui/alert-dialog";
import { sharedMessages } from "./messages";

const t = createTranslator(sharedMessages);

export interface ConfirmRequest {
	title: string;
	description: ReactNode;
	confirmLabel: string;
	destructive?: boolean;
	onConfirm: () => void | Promise<void>;
}

/** Confirm dialog for hard-to-undo actions. On cancel, focus returns to the button that opened it. */
export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
	return (
		<AlertDialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{request?.title}</AlertDialogTitle>
					<AlertDialogDescription render={typeof request?.description === "string" ? undefined : <div />}>
						{request?.description}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel type="button">{t("common.cancel")}</AlertDialogCancel>
					<AlertDialogAction
						type="button"
						variant={request?.destructive ? "destructive" : "default"}
						onClick={() => {
							const action = request?.onConfirm;
							onClose();
							void action?.();
						}}
					>
						{request?.confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

/** The question asked when discarding unsaved content. Every edit slot with a save button uses the same wording. */
export const DISCARD_CONFIRM = {
	title: t("discard.title"),
	description: t("discard.description"),
	confirmLabel: t("discard.confirm"),
	destructive: true,
} as const satisfies Omit<ConfirmRequest, "onConfirm">;

/**
 * Opens the confirm dialog as a Promise. `confirm(...)` resolves to true or false depending on which button was pressed.
 * Render `dialog` once somewhere on the screen.
 */
export function useConfirm() {
	const [request, setRequest] = useState<ConfirmRequest | null>(null);
	const resolveRef = useRef<((ok: boolean) => void) | null>(null);
	const confirm = useCallback(
		(next: Omit<ConfirmRequest, "onConfirm">) =>
			new Promise<boolean>((resolve) => {
				resolveRef.current?.(false);
				resolveRef.current = resolve;
				setRequest({
					...next,
					onConfirm: () => {
						resolveRef.current = null;
						resolve(true);
					},
				});
			}),
		[],
	);
	/** Asks whether to discard only when `dirty`. If clean, it is true immediately. */
	const confirmDiscard = useCallback(
		(dirty: boolean) => (dirty ? confirm(DISCARD_CONFIRM) : Promise.resolve(true)),
		[confirm],
	);
	const dialog = (
		<ConfirmDialog
			request={request}
			onClose={() => {
				setRequest(null);
				// Pressing confirm calls onConfirm right after onClose. If the pending state is still there after that, it was a cancel.
				queueMicrotask(() => {
					resolveRef.current?.(false);
					resolveRef.current = null;
				});
			}}
		/>
	);
	return { confirm, confirmDiscard, dialog };
}
