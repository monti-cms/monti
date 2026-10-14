"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// The recovery-copy and conflict dialogs of the entry editor screen. Closing one hides it without answering it.
import { useState } from "react";
import { toast } from "sonner";
import { ConflictDialog, RecoveryDialog } from "./recovery-dialogs.js";
export function EntryEditorRecoveryDialogs({ editor }) {
    const { recovery, conflict } = editor;
    // The editor keeps the recovery copy and the conflict until they are resolved.
    const [dismissedRecovery, setDismissedRecovery] = useState(null);
    const [dismissedConflict, setDismissedConflict] = useState(null);
    return (_jsxs(_Fragment, { children: [_jsx(RecoveryDialog, { recovery: recovery === dismissedRecovery ? null : recovery, onClose: () => setDismissedRecovery(recovery), onKeepServer: () => void editor.discardRecovery(), onRestore: editor.restoreRecovery }), _jsx(ConflictDialog, { conflict: conflict === dismissedConflict ? null : conflict, onClose: () => setDismissedConflict(conflict), 
                // The server version is loaded in place: the page is not reloaded.
                onReload: () => void editor.reload().then((reloaded) => {
                    if (!reloaded.ok)
                        toast.error(reloaded.error.message);
                }), onOverwrite: () => void editor.overwriteWithMine() })] }));
}
