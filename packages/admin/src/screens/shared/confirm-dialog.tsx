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

/** 되돌리기 어려운 작업의 확인창. 취소하면 포커스는 여는 버튼으로 돌아간다. */
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

/** 저장하지 않은 내용을 버릴 때 묻는 말. 저장 단추가 있는 모든 편집 칸이 같은 말을 쓴다. */
export const DISCARD_CONFIRM = {
	title: t("discard.title"),
	description: t("discard.description"),
	confirmLabel: t("discard.confirm"),
	destructive: true,
} as const satisfies Omit<ConfirmRequest, "onConfirm">;

/**
 * 확인창을 약속(Promise)으로 연다. `confirm(...)`은 누른 쪽에 따라 true·false로 풀린다.
 * `dialog`를 화면 어딘가에 한 번 렌더한다.
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
	/** `dirty`일 때만 버릴지 묻는다. 깨끗하면 바로 true다. */
	const confirmDiscard = useCallback(
		(dirty: boolean) => (dirty ? confirm(DISCARD_CONFIRM) : Promise.resolve(true)),
		[confirm],
	);
	const dialog = (
		<ConfirmDialog
			request={request}
			onClose={() => {
				setRequest(null);
				// 확인을 누르면 onClose 다음에 onConfirm이 바로 이어 불린다. 그 뒤에도 남아 있으면 취소다.
				queueMicrotask(() => {
					resolveRef.current?.(false);
					resolveRef.current = null;
				});
			}}
		/>
	);
	return { confirm, confirmDiscard, dialog };
}
