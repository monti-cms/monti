"use client";
import { useSite, useTranslator } from "@monti-cms/core/site";
import { useState } from "react";
import { toast } from "sonner";
import { issueLine } from "../../api/error-message.js";
import { commonMessages } from "../../lib/common.messages.js";
import { useAdminRouter } from "../../router/index.js";
import { useConfirm } from "../shared/confirm-dialog.js";
import { nounVars } from "../shared/noun.messages.js";
import { entryEditorShellMessages } from "./entry-editor-shell.messages.js";
import { lifecycleConfirm, lifecycleSuccess, } from "./lifecycle-confirm.js";
/** "Save first" hint. The same words are used wherever on the edit screen an action is blocked. */
const saveFirstMessage = (t, purpose) => t("saveFirst", { purpose });
export function useEntryLifecycleCommands({ editor, incomingItems, refreshIncoming, focusIssue, sourceChanged, }) {
    const site = useSite();
    const t = useTranslator(entryEditorShellMessages);
    const tc = useTranslator(commonMessages);
    const router = useAdminRouter();
    const { confirm, dialog } = useConfirm();
    const { entry, collection, busy } = editor;
    const isReadOnly = editor.readOnly;
    /** Publish saves first. While that save runs, the header buttons are disabled and the label changes like during the publish request itself. */
    const [isPreparingPublish, setIsPreparingPublish] = useState(false);
    const isPublishing = busy === "publish" || isPreparingPublish;
    const isSubmitting = busy !== null || isPreparingPublish;
    /**
     * Only an explicit publish saves the current input. Other actions ask to save first if there is unsaved input.
     * The hint shows near where it was pressed. For header buttons and menus it is a toast (default); for dialogs, inside the dialog.
     */
    const ensureSaved = async (purpose, { saveChanges = false, report = toast.error } = {}) => {
        if (editor.getSnapshot().saveStatus === "conflict") {
            report(t("conflictFirst", { purpose }));
            return null;
        }
        if (saveChanges) {
            const saved = await editor.save();
            if (!saved.ok) {
                report(t("notSaved", { purpose, reason: saved.error.message || t("checkSaveStatus") }));
                return null;
            }
        }
        const { entryId: id, hasUnsavedChanges } = editor.getSnapshot();
        if (!id || (!saveChanges && hasUnsavedChanges)) {
            report(saveFirstMessage(t, purpose));
            return null;
        }
        return id;
    };
    const handleSaveNow = async () => {
        if (isReadOnly)
            return;
        const saved = await editor.save();
        if (saved.ok)
            toast.success(tc("saved"));
        // On failure, always show the reason (a conflict opens its own conflict dialog).
        else if (saved.error.code !== "conflict")
            toast.error(saved.error.message || tc("saveFailed"));
    };
    /**
     * Preview renders the server draft. If there are unsaved changes, save first, then open.
     * To avoid the popup blocker while waiting for the save, the window is opened as soon as the button is pressed.
     */
    const handlePreview = async (href) => {
        const opened = window.open("about:blank", "_blank");
        if (opened)
            opened.opener = null;
        const saved = isReadOnly ? null : await editor.save();
        if (!saved || saved.ok) {
            if (opened)
                opened.location.href = href;
            else
                window.open(href, "_blank", "noopener");
            return;
        }
        opened?.close();
        toast.error(`${t("previewNotOpened")} ${saved.error.message}`.trim());
    };
    const handlePublish = async ({ resetPublishedAt = false } = {}) => {
        if (isSubmitting || isReadOnly)
            return;
        // A field filled from the body (`fillFromBody`) that is empty is generated from the body and shown. If there is no body to generate from, it must be entered by hand.
        const filled = editor.fillFromBody();
        if (!filled.ok) {
            toast.error(filled.error.message);
            return;
        }
        for (const { label } of filled.value)
            toast.message(t("fillDone", { label }));
        // This does not block. It only warns when leaving with unconfirmed source changes.
        if (sourceChanged)
            toast.warning(t("sourceUnreviewed"));
        setIsPreparingPublish(true);
        try {
            const id = await ensureSaved("publish", { saveChanges: true });
            if (!id)
                return;
            const published = await editor.publish({ resetPublishedAt });
            if (!published.ok) {
                // A conflict opens its own conflict dialog.
                if (published.error.code === "conflict")
                    return;
                if (published.error.issues?.length)
                    toast.error(t("publishBlocked"));
                else
                    toast.error(published.error.message);
                return;
            }
            void refreshIncoming(id);
            const { warnings } = published.value;
            if (warnings.length > 0) {
                toast.warning(t("publishedWithWarnings", { count: warnings.length }), {
                    description: warnings
                        .slice(0, 5)
                        .map((issue) => issueLine(issue))
                        .join("\n"),
                    duration: 10000,
                    action: warnings[0]?.position
                        ? { label: t("go"), onClick: () => focusIssue(warnings[0]) }
                        : undefined,
                });
            }
            else {
                toast.success(t("published"));
            }
        }
        finally {
            setIsPreparingPublish(false);
        }
    };
    /** Archive, unarchive, trash, restore. */
    const runLifecycle = async (action) => {
        if (!entry || isSubmitting)
            return;
        if (action !== "restore" && editor.getSnapshot().hasUnsavedChanges) {
            toast.error(saveFirstMessage(t, action));
            return;
        }
        const changed = await editor.changeStatus(action);
        if (!changed.ok) {
            toast.error(changed.error.message);
            return;
        }
        toast.success(lifecycleSuccess(site)[action]);
        // Sending a translation to the trash returns to the original's edit screen.
        if (changed.value.openEntryId)
            router.navigate(site.adminEntryEditHref(changed.value.openEntryId));
    };
    /** Only transitions that take a published post down (archive, move to trash) ask. Unarchive and restore happen right away. */
    const confirmLifecycle = async (action) => {
        const ok = await confirm(lifecycleConfirm(site, action, entry, incomingItems, collection));
        if (ok)
            await runLifecycle(action);
    };
    const confirmPermanentDelete = async () => {
        if (!entry)
            return;
        const ok = await confirm({
            title: tc("lifecycle.deletePermanently"),
            description: t("permanentDeleteAsk", nounVars(site, collection)),
            confirmLabel: tc("lifecycle.deletePermanently"),
            destructive: true,
        });
        if (!ok)
            return;
        const deleted = await editor.deletePermanently();
        if (!deleted.ok) {
            toast.error(deleted.error.message);
            return;
        }
        router.navigate(site.adminHref(`?collection=${entry.collection}&status=trashed`));
    };
    const handleDuplicate = async () => {
        const id = await ensureSaved("duplicate");
        if (!id)
            return;
        const copy = await editor.duplicate();
        if (!copy.ok) {
            toast.error(copy.error.message);
            return;
        }
        router.navigate(site.adminEntryEditHref(copy.value.id));
    };
    return {
        isPublishing,
        isSubmitting,
        confirmDialog: dialog,
        handleSaveNow,
        handlePreview,
        handlePublish,
        runLifecycle,
        confirmLifecycle,
        confirmPermanentDelete,
        handleDuplicate,
    };
}
