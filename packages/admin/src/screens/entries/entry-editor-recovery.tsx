"use client";

// The notice strips above the editor for the two things that need an answer before the work goes on: an edit conflict (someone saved first) and a draft
// kept only in this browser. Each can be compared on the compare screen. Neither is a dialog and neither goes away until it is answered.

import { useSite, useTranslator } from "@monti-cms/core/site";
import { Banner, TextButton, toast } from "@monti-cms/ui";
import { AdminLink as Link } from "../../router";
import { compareHref } from "./compare-address";
import { entryCompareMessages } from "./entry-compare.messages";
import type { EntryEditor } from "./entry-editor-types";
import { clockTime, stampOf } from "./entry-stamps";

export function EntryEditorRecoveryStrips({ editor }: { editor: EntryEditor }) {
	const site = useSite();
	const t = useTranslator(entryCompareMessages);
	const { conflict, recovery, entry } = editor;
	return (
		<>
			{conflict && (
				<Banner
					tone="danger"
					role="alert"
					title={
						conflict.server.changedAt
							? t("conflict.title", { time: clockTime(site, conflict.server.changedAt) })
							: t("conflict.titleNoTime")
					}
					meta={t("conflict.meta")}
					plainMeta
				>
					<TextButton variant="underline" render={<Link href={compareHref(site, conflict.server.id, "conflict")} />}>
						{t("compare")}
					</TextButton>
					<TextButton
						onClick={() =>
							// The server version is loaded in place: the page is not reloaded.
							void editor.reload().then((reloaded) => {
								if (!reloaded.ok) toast.error(reloaded.error.message);
							})
						}
					>
						{t("loadServer")}
					</TextButton>
				</Banner>
			)}
			{recovery && (
				<Banner title={t("draft.title")} meta={stampOf(site, t, recovery.savedAt)}>
					{/* A new post has no server copy to compare with. */}
					{entry && (
						<TextButton variant="underline" render={<Link href={compareHref(site, entry.id, "draft")} />}>
							{t("compare")}
						</TextButton>
					)}
					<TextButton onClick={editor.restoreRecovery}>{t("load")}</TextButton>
					<TextButton variant="quiet" onClick={() => void editor.discardRecovery()}>
						{t("discard")}
					</TextButton>
				</Banner>
			)}
		</>
	);
}
