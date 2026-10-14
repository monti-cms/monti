"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { useQuery } from "@tanstack/react-query";
import { Folder as FolderIcon, FolderInput, FolderPlus, FolderUp, Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { errorText } from "../../api/client.js";
import { createFolder, deleteFolder, foldersKeys, getFolderContents, updateFolder } from "../../api/folders.js";
import { useCmsMutation } from "../../api/use-cms-mutation.js";
import { commonMessages } from "../../lib/common.messages.js";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "../../ui/alert-dialog.js";
import { Button } from "../../ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/dialog.js";
import { DialogFormFooter } from "../../ui/dialog-form-footer.js";
import { Field, FieldError, FieldLabel } from "../../ui/field.js";
import { Input } from "../../ui/input.js";
import { Skeleton } from "../../ui/skeleton.js";
import { sharedMessages } from "./messages.js";
/** Parent candidates to move to, excluding `folder` and its descendants. The server also rejects cycles. */
export function moveTargetsFor(folder, folders) {
    const blocked = new Set([folder.id]);
    let grew = true;
    while (grew) {
        grew = false;
        for (const candidate of folders) {
            if (candidate.parentId && blocked.has(candidate.parentId) && !blocked.has(candidate.id)) {
                blocked.add(candidate.id);
                grew = true;
            }
        }
    }
    return folders.filter((candidate) => !blocked.has(candidate.id) && candidate.id !== folder.parentId);
}
/**
 * Right-click / `⋯` menu of a folder. The sidebar tree and the list's folder rows use the same menu.
 * Move targets are folders excluding itself and its descendants.
 */
export function folderMenuActions(site, folder, folders, actions) {
    const t = site.createTranslator(sharedMessages);
    const tc = site.createTranslator(commonMessages);
    const targets = moveTargetsFor(folder, folders);
    return [
        { kind: "item", label: tc("addSubfolder"), icon: FolderPlus, onSelect: () => actions.requestCreate(folder.id) },
        {
            kind: "item",
            label: tc("rename"),
            icon: Pencil,
            shortcut: "F2",
            onSelect: () => actions.requestRename(folder),
        },
        {
            kind: "sub",
            label: tc("move"),
            icon: FolderInput,
            emptyLabel: t("folder.moveEmpty"),
            items: [
                ...(folder.parentId
                    ? [
                        {
                            kind: "item",
                            label: t("folder.root"),
                            icon: FolderUp,
                            onSelect: () => void actions.moveFolder(folder, null),
                        },
                    ]
                    : []),
                ...targets.map((target) => ({
                    kind: "item",
                    label: target.name,
                    icon: FolderIcon,
                    onSelect: () => void actions.moveFolder(folder, target.id),
                })),
            ],
        },
        { kind: "separator" },
        {
            kind: "item",
            label: tc("delete"),
            icon: Trash2,
            shortcut: "Del",
            destructive: true,
            onSelect: () => void actions.requestDelete(folder),
        },
    ];
}
/**
 * Virtual folder create, rename, move and delete. The sidebar tree and the list's folder rows share the same state and dialogs.
 * Delete proceeds after previewing the contents. Posts and child folders directly inside move to the parent, and posts are not deleted.
 */
export function useFolderActions({ collection, folders, onChanged, }) {
    const site = useSite();
    const t = useTranslator(sharedMessages);
    const tc = useTranslator(commonMessages);
    const [nameDialog, setNameDialog] = useState(null);
    const [name, setName] = useState("");
    const [deleteDialog, setDeleteDialog] = useState(null);
    const [error, setError] = useState(null);
    // Closing the dialog returns focus to the button that opened it. If that button is gone (deleted folder), follow the browser default.
    const returnFocusRef = useRef(null);
    const rememberFocus = () => {
        returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    };
    const restoreFocus = () => {
        const target = returnFocusRef.current;
        returnFocusRef.current = null;
        return target?.isConnected ? target : true;
    };
    const itemLabel = site.isCollection(collection)
        ? site.COLLECTION_DEFINITIONS[collection].label
        : t("folder.defaultItemLabel");
    const folderName = (id) => id
        ? `'${folders.find((f) => f.id === id)?.name ?? t("folder.parentFallback")}'`
        : t("folder.rootName", { itemLabel });
    /** Destination + particle (the Korean dictionary attaches the particle). */
    const toFolder = (id) => t(id ? "folder.to.named" : "folder.to.root", { name: folderName(id) });
    const requestCreate = (parentId) => {
        rememberFocus();
        setError(null);
        setName("");
        setNameDialog({ mode: "create", parentId });
    };
    const requestRename = (folder) => {
        rememberFocus();
        setError(null);
        setName(folder.name);
        setNameDialog({ mode: "rename", folder });
    };
    const requestDelete = (folder) => {
        rememberFocus();
        setError(null);
        setDeleteDialog({ folder });
    };
    // What the delete would move to the parent, read while the dialog is open.
    const contentsQuery = useQuery({
        queryKey: foldersKeys.contents(deleteDialog?.folder.id ?? ""),
        queryFn: ({ signal }) => getFolderContents(site, deleteDialog?.folder.id ?? "", signal),
        enabled: deleteDialog !== null,
        gcTime: 0,
        retry: false,
    });
    const contents = deleteDialog ? (contentsQuery.data ?? null) : null;
    const shownError = error ??
        (deleteDialog && contentsQuery.error ? errorText(site, contentsQuery.error, t("folder.loadFailed")) : null);
    /** Moves a folder to another parent (or the top level). If the same name exists, the server rejects and explains. */
    const move = useCmsMutation({
        fn: ({ folder, parentId }, { site }) => updateFolder(site, folder.id, { parentId, expectedVersion: folder.version }, t("folder.moveFailed")),
        success: (_result, { folder, parentId }) => t("folder.moved", { name: folder.name, destination: toFolder(parentId) }),
        failure: t("folder.moveFailed"),
        onSuccess: () => void onChanged(),
    });
    const moveFolder = (folder, parentId) => move.mutate({ folder, parentId });
    const save = useCmsMutation({
        fn: (dialog, { site }) => {
            const trimmed = name.trim();
            return dialog.mode === "create"
                ? createFolder(site, { collection, name: trimmed, parentId: dialog.parentId }, t("folder.addFailed"))
                : updateFolder(site, dialog.folder.id, { name: trimmed, expectedVersion: dialog.folder.version }, t("folder.renameFailed"));
        },
        success: (_result, dialog) => (dialog.mode === "create" ? t("folder.added", { name: name.trim() }) : tc("saved")),
        failure: t("folder.saveFailed"),
        inline: true,
        onSuccess: () => {
            setNameDialog(null);
            void onChanged();
        },
        onError: (err) => setError(errorText(site, err, t("folder.saveFailed"))),
    });
    const submitName = () => {
        if (!nameDialog || !name.trim())
            return;
        setError(null);
        save.mutate(nameDialog);
    };
    const remove = useCmsMutation({
        fn: ({ folder }, { site }) => deleteFolder(site, folder.id, folder.version, t("folder.deleteFailed")),
        success: (_result, { folder }) => contents && contents.entryCount + contents.childFolders.length > 0
            ? t("folder.deletedMoved", { name: folder.name, destination: toFolder(folder.parentId) })
            : t("folder.deleted", { name: folder.name }),
        failure: t("folder.deleteFailed"),
        inline: true,
        onSuccess: (_result, { folder }) => {
            setDeleteDialog(null);
            void onChanged(folder.id);
        },
        // If a child folder name collides in the parent, guide the user to rename first.
        onError: (err) => setError(errorText(site, err, t("folder.deleteFailed"))),
    });
    const isBusy = save.isPending || remove.isPending;
    const confirmDelete = () => {
        if (!deleteDialog)
            return;
        setError(null);
        remove.mutate(deleteDialog);
    };
    const destination = deleteDialog ? toFolder(deleteDialog.folder.parentId) : "";
    const dialogs = (_jsxs(_Fragment, { children: [_jsx(Dialog, { open: nameDialog !== null, onOpenChange: (open) => !open && setNameDialog(null), children: _jsxs(DialogContent, { className: "max-w-sm", finalFocus: restoreFocus, children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: nameDialog?.mode === "rename"
                                        ? t("folder.renameTitle")
                                        : nameDialog?.parentId
                                            ? tc("addSubfolder")
                                            : tc("addFolder") }), _jsx(DialogDescription, { children: nameDialog?.mode === "create"
                                        ? t("folder.location", { name: folderName(nameDialog.parentId) })
                                        : t("folder.uniqueName") })] }), _jsxs("form", { onSubmit: (event) => {
                                event.preventDefault();
                                void submitName();
                            }, className: "space-y-4", children: [_jsxs(Field, { "data-invalid": Boolean(shownError) || undefined, children: [_jsx(FieldLabel, { htmlFor: "folder-name", className: "sr-only", children: t("folder.nameLabel") }), _jsx(Input, { id: "folder-name", autoFocus: true, value: name, maxLength: 100, "aria-invalid": Boolean(shownError) || undefined, onChange: (e) => setName(e.target.value), onKeyDown: (event) => {
                                                // While composing Hangul, Enter is the key that finishes the character. Do not submit the form.
                                                if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) {
                                                    event.preventDefault();
                                                }
                                            } }), shownError && _jsx(FieldError, { children: shownError })] }), _jsx(DialogFormFooter, { onCancel: () => setNameDialog(null), cancelLabel: tc("cancel"), submitLabel: tc("save"), busyLabel: tc("saving"), busy: isBusy, disabled: !name.trim() })] })] }) }), _jsx(AlertDialog, { open: deleteDialog !== null, onOpenChange: (open) => !open && setDeleteDialog(null), children: _jsxs(AlertDialogContent, { finalFocus: restoreFocus, children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: t("folder.deleteTitle", { name: deleteDialog?.folder.name ?? "" }) }), _jsx(AlertDialogDescription, { children: t("folder.deleteAsk", { itemLabel, destination }) })] }), contents ? (_jsxs("ul", { className: "list-disc space-y-1 pl-5 text-sm", children: [_jsx("li", { children: t("folder.entryCount", { itemLabel, count: contents.entryCount }) }), _jsxs("li", { children: [t("folder.childCount", { count: contents.childFolders.length }), contents.childFolders.length > 0 &&
                                            `: ${contents.childFolders.map((folder) => folder.name).join(", ")}`] })] })) : (!shownError && (_jsxs("div", { "aria-hidden": true, className: "space-y-2", children: [_jsx(Skeleton, { className: "h-4 w-40" }), _jsx(Skeleton, { className: "h-4 w-56" })] }))), shownError && _jsx(FieldError, { children: shownError }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { type: "button", children: tc("cancel") }), _jsx(Button, { type: "button", variant: "destructive", disabled: !contents || isBusy, onClick: () => void confirmDelete(), children: isBusy ? tc("deleting") : tc("delete") })] })] }) })] }));
    return { requestCreate, requestRename, requestDelete, moveFolder, dialogs };
}
