"use client";

import { toast } from "sonner";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { useConfirm } from "../shared/confirm-dialog";
import { formatDateTime } from "../shared/format-date";
import { type EntryData, type EntryForm, formFromEntry } from "./entry-form";
import type { LocalBackupRecord } from "./local-backup";
import { t } from "./translate";

/** 편집 화면을 열 때 찾은 브라우저 복구본. 그 뒤 서버도 바뀌었으면 `conflict`다(§5.1). */
export type Recovery =
	| { kind: "restore"; backup: LocalBackupRecord<EntryForm> }
	| { kind: "conflict"; backup: LocalBackupRecord<EntryForm>; server: EntryData };

/** 서버에 없는 브라우저 임시 저장본을 불러올지 묻는다. */
export function RecoveryDialog({
	recovery,
	onClose,
	onKeepServer,
	onRestore,
}: {
	recovery: Recovery | null;
	onClose: () => void;
	onKeepServer: (recovery: Recovery) => void;
	onRestore: (recovery: Recovery) => void;
}) {
	return (
		<Dialog open={recovery !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>{t("recovery.title")}</DialogTitle>
					<DialogDescription>
						{recovery ? t("recovery.description", { date: formatDateTime(recovery.backup.savedAt) }) : ""}
						{recovery?.kind === "conflict" && t("recovery.conflict")}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={() => recovery && onKeepServer(recovery)}>
						{t("recovery.keepServer")}
					</Button>
					<Button type="button" onClick={() => recovery && onRestore(recovery)}>
						{t("recovery.restore")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** 자동 저장·발행 중 다른 곳에서 먼저 저장했을 때. 양쪽을 비교해 복사하거나 하나를 고른다. */
export function ConflictDialog({
	conflict,
	onClose,
	onReload,
	onOverwrite,
}: {
	conflict: { server: EntryData; local: EntryForm } | null;
	onClose: () => void;
	onReload: () => void;
	/** 서버 최신 버전 위에 내 입력을 덮어쓴다. */
	onOverwrite: (serverVersion: number) => void;
}) {
	const { confirm, dialog } = useConfirm();
	// 서버 최신본을 통째로 바꾸므로 한 번 더 묻는다(§5).
	const overwrite = async () => {
		if (!conflict) return;
		const serverVersion = conflict.server.version;
		if (
			await confirm({
				title: t("conflict.overwrite"),
				description: t("conflict.overwriteAsk"),
				confirmLabel: t("conflict.overwrite"),
				destructive: true,
			})
		) {
			onOverwrite(serverVersion);
		}
	};
	return (
		<Dialog open={conflict !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{t("conflict.title")}</DialogTitle>
					<DialogDescription>{t("conflict.description")}</DialogDescription>
				</DialogHeader>
				{conflict && (
					<ComparePanes
						local={conflict.local}
						server={formFromEntry(conflict.server)}
						serverVersion={conflict.server.version}
					/>
				)}
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onClose}>
						{t("close")}
					</Button>
					<Button type="button" variant="outline" onClick={onReload}>
						{t("conflict.reload")}
					</Button>
					<Button type="button" variant="destructive" onClick={() => void overwrite()}>
						{t("conflict.overwriteMine")}
					</Button>
				</DialogFooter>
				{dialog}
			</DialogContent>
		</Dialog>
	);
}

/** 충돌 화면의 양쪽 비교(§5.1 "양쪽 내용을 확인·복사"). */
function ComparePanes({
	local,
	server,
	serverVersion,
}: {
	local: EntryForm;
	server: EntryForm;
	serverVersion: number;
}) {
	const copy = async (mdx: string) => {
		try {
			await navigator.clipboard.writeText(mdx);
			toast.success(t("conflict.copied"));
		} catch {
			toast.error(t("conflict.copyFailed"));
		}
	};
	const pane = (label: string, value: EntryForm) => (
		<div className="space-y-2 rounded border p-3">
			<p className="font-semibold text-sm">{label}</p>
			<p className="text-xs">
				{t("conflict.summary", { title: value.title || t("untitled"), slug: value.slug || t("conflict.noSlug") })}
			</p>
			<Button type="button" variant="link" size="xs" className="px-0" onClick={() => void copy(value.mdx)}>
				{t("conflict.copyBody")}
			</Button>
			<pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs">{value.mdx}</pre>
		</div>
	);
	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
			{pane(t("conflict.mine"), local)}
			{pane(t("conflict.server", { version: serverVersion }), server)}
		</div>
	);
}
