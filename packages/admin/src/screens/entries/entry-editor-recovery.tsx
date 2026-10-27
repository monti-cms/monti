"use client";

import { toast } from "@monti-cms/ui";
// The recovery-copy and conflict dialogs of the entry editor screen. Closing one hides it without answering it.

import { useState } from "react";
import type { ConflictInfo, EntryEditor, RecoveryOffer } from "./entry-editor-types";
import { ConflictDialog, RecoveryDialog } from "./recovery-dialogs";

export function EntryEditorRecoveryDialogs({ editor }: { editor: EntryEditor }) {
	const { recovery, conflict } = editor;
	// The editor keeps the recovery copy and the conflict until they are resolved.
	const [dismissedRecovery, setDismissedRecovery] = useState<RecoveryOffer | null>(null);
	const [dismissedConflict, setDismissedConflict] = useState<ConflictInfo | null>(null);
	return (
		<>
			<RecoveryDialog
				recovery={recovery === dismissedRecovery ? null : recovery}
				onClose={() => setDismissedRecovery(recovery)}
				onKeepServer={() => void editor.discardRecovery()}
				onRestore={editor.restoreRecovery}
			/>
			<ConflictDialog
				conflict={conflict === dismissedConflict ? null : conflict}
				onClose={() => setDismissedConflict(conflict)}
				// The server version is loaded in place: the page is not reloaded.
				onReload={() =>
					void editor.reload().then((reloaded) => {
						if (!reloaded.ok) toast(reloaded.error.message);
					})
				}
				onOverwrite={() => void editor.overwriteWithMine()}
			/>
		</>
	);
}
