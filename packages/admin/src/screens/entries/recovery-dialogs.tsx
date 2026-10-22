"use client";

import type { StoredDocument } from "@monti-cms/core/document";
import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Box,
	Button,
	CodeBlock,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Grid,
	Stack,
	Text,
} from "@monti-cms/ui";
import { toast } from "sonner";
import { useSourceFormat } from "../../admin-components";
import { commonMessages } from "../../lib/common.messages";
import { useConfirm } from "../shared/confirm-dialog";
import { formatDateTime } from "../shared/format-date";
import type { ConflictInfo, RecoveryOffer } from "./entry-editor-types";
import { type EntryForm, formFromEntry, formTitle } from "./entry-form";
import { entriesMessages } from "./messages";

/**
 * Asks whether to load a browser temporary copy that is not on the server (`useEntryEditor().recovery`). It is a `conflict` offer if the server has
 * changed since the copy was made. Closing the dialog only hides it; the copy is kept until the user answers.
 */
export function RecoveryDialog({
	recovery,
	onClose,
	onKeepServer,
	onRestore,
}: {
	recovery: RecoveryOffer | null;
	onClose: () => void;
	onKeepServer: () => void;
	onRestore: () => void;
}) {
	const t = useTranslator(entriesMessages);
	const site = useSite();
	return (
		<Dialog open={recovery !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent size="md">
				<DialogHeader>
					<DialogTitle>{t("recovery.title")}</DialogTitle>
					<DialogDescription>
						{recovery ? t("recovery.description", { date: formatDateTime(site, recovery.savedAt) }) : ""}
						{recovery?.kind === "conflict" && t("recovery.conflict")}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onKeepServer}>
						{t("recovery.keepServer")}
					</Button>
					<Button type="button" onClick={onRestore}>
						{t("recovery.restore")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/**
 * When someone saved elsewhere first during a save or publish (`useEntryEditor().conflict`). Compare both sides, then copy or pick one.
 * Neither answer reloads the page: the editor loads the server version, or saves on top of it.
 */
export function ConflictDialog({
	conflict,
	onClose,
	onReload,
	onOverwrite,
}: {
	conflict: ConflictInfo | null;
	onClose: () => void;
	/** Loads the latest server version in place of my input. */
	onReload: () => void;
	/** Overwrites the latest server version with my input. */
	onOverwrite: () => void;
}) {
	const site = useSite();
	const t = useTranslator(entriesMessages);
	const tc = useTranslator(commonMessages);
	const { confirm, dialog } = useConfirm();
	// This replaces the latest server copy wholesale, so ask once more.
	const overwrite = async () => {
		if (!conflict) return;
		if (
			await confirm({
				title: t("conflict.overwrite"),
				description: t("conflict.overwriteAsk"),
				confirmLabel: t("conflict.overwrite"),
				destructive: true,
			})
		) {
			onOverwrite();
		}
	};
	return (
		<Dialog open={conflict !== null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent size="xl" scroll>
				<DialogHeader>
					<DialogTitle>{t("conflict.title")}</DialogTitle>
					<DialogDescription>{t("conflict.description")}</DialogDescription>
					{conflict?.server.changedAt && (
						<Text as="p" weight="medium">
							{conflict.server.changedBy
								? t("conflict.savedBy", {
										name: conflict.server.changedBy,
										date: formatDateTime(site, conflict.server.changedAt),
									})
								: t("conflict.savedAt", { date: formatDateTime(site, conflict.server.changedAt) })}
						</Text>
					)}
				</DialogHeader>
				{conflict && (
					<ComparePanes
						collection={conflict.server.collection}
						local={conflict.local}
						server={formFromEntry(site, conflict.server)}
						serverVersion={conflict.server.version}
					/>
				)}
				<DialogFooter>
					<Button type="button" variant="outline" onClick={onClose}>
						{tc("close")}
					</Button>
					<Button type="button" variant="outline" onClick={onReload}>
						{t("conflict.reload")}
					</Button>
					<Button type="button" variant="secondary" tone="danger" onClick={() => void overwrite()}>
						{t("conflict.overwriteMine")}
					</Button>
				</DialogFooter>
				{dialog}
			</DialogContent>
		</Dialog>
	);
}

/** Side-by-side comparison on the conflict screen ("check and copy both contents"). */
function ComparePanes({
	collection,
	local,
	server,
	serverVersion,
}: {
	collection: string;
	local: EntryForm;
	server: EntryForm;
	serverVersion: number;
}) {
	const site = useSite();
	const t = useTranslator(entriesMessages);
	const tc = useTranslator(commonMessages);
	// The body is shown as text in the notation of the source panel; without one, as the document itself.
	const format = useSourceFormat();
	const bodyText = (doc: StoredDocument) => (format ? format.export(doc) : JSON.stringify(doc, null, 2));
	const copy = async (body: string) => {
		try {
			await navigator.clipboard.writeText(body);
			toast.success(t("conflict.copied"));
		} catch {
			toast.error(tc("copyFailed"));
		}
	};
	const pane = (label: string, value: EntryForm) => {
		const body = bodyText(value.doc);
		return (
			<Stack gap="condensed" border="all" radius="lg" padding="normal">
				<Text as="p" weight="semibold">
					{label}
				</Text>
				<Text as="p" variant="caption">
					{t("conflict.summary", {
						title: formTitle(site, collection, value) || tc("untitled"),
						slug: value.slug || t("conflict.noSlug"),
					})}
				</Text>
				<Box>
					<Button type="button" variant="link" size="xs" onClick={() => void copy(body)}>
						{t("conflict.copyBody")}
					</Button>
				</Box>
				<CodeBlock>{body}</CodeBlock>
			</Stack>
		);
	};
	return (
		<Grid columns={2} gap="normal">
			{pane(t("conflict.mine"), local)}
			{pane(t("conflict.server", { version: serverVersion }), server)}
		</Grid>
	);
}
