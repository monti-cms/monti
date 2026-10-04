import { createTranslator, taxonomyFieldsOf } from "@monti-cms/core/client";
import { Archive, ArchiveRestore, Copy, ExternalLink, Folder as FolderIcon, FolderInput, FolderUp, PanelRightOpen, RotateCcw, SquarePen, Tag, Tags, Trash2, } from "lucide-react";
import { screensMessages } from "./messages.js";
const t = createTranslator(screensMessages);
export const toSelection = (item) => ({
    id: item.id,
    expectedVersion: item.version,
    title: item.title,
});
/**
 * Target of right-click / Delete key. If the pressed row is one of the selected rows and two or more are selected, all selected rows; otherwise just that row.
 */
export function actionTargets(item, items, selectedIds) {
    return selectedIds.has(item.id) && selectedIds.size > 1 ? items.filter((row) => selectedIds.has(row.id)) : [item];
}
/** Row menu. One row gets open and duplicate; several rows get the item count at the top. Trash has only restore and permanent delete. */
export function rowMenuActions(group, context, handlers) {
    const targets = group.map(toSelection);
    const single = group.length === 1 ? group[0] : undefined;
    const header = single ? [] : [{ kind: "label", label: t("menu.items", { count: group.length }) }];
    if (context.mode === "trash") {
        return [
            ...header,
            { kind: "item", label: t("list.restore"), icon: RotateCcw, onSelect: () => handlers.restore(targets) },
            { kind: "separator" },
            {
                kind: "item",
                label: t("list.permanentDelete"),
                icon: Trash2,
                shortcut: "Del",
                destructive: true,
                onSelect: () => handlers.confirmPermanentDelete(targets),
            },
        ];
    }
    const open = !single
        ? []
        : context.isRecord
            ? [{ kind: "item", label: t("common.open"), icon: PanelRightOpen, onSelect: () => handlers.openRecord(single) }]
            : [
                { kind: "item", label: t("common.open"), icon: SquarePen, onSelect: () => handlers.openEditor(single) },
                {
                    kind: "item",
                    label: t("menu.openNewTab"),
                    icon: ExternalLink,
                    onSelect: () => handlers.openInNewTab(single),
                },
                { kind: "item", label: t("menu.duplicate"), icon: Copy, onSelect: () => handlers.duplicate(single) },
            ];
    const allArchived = group.every((row) => row.status === "archived");
    const addActions = taxonomyFieldsOf(context.collection).flatMap((stored) => {
        if (stored.field.kind !== "relation" || !stored.field.many)
            return [];
        const label = stored.field.label;
        return [
            {
                kind: "sub",
                label: t("menu.addRelation", { label }),
                icon: Tags,
                emptyLabel: t("menu.relationEmpty", { label }),
                items: (context.options[stored.name] ?? []).map((option) => ({
                    kind: "item",
                    label: option.title,
                    icon: Tag,
                    onSelect: () => handlers.bulk("relation.add", t("bulk.addRelation", { label }), targets, {
                        field: stored.name,
                        ids: [option.id],
                    }),
                })),
            },
        ];
    });
    const contentActions = context.isContent
        ? [
            ...addActions,
            { kind: "separator" },
            allArchived
                ? {
                    kind: "item",
                    label: t("menu.unarchive"),
                    icon: ArchiveRestore,
                    onSelect: () => handlers.bulk("unarchive", t("bulk.unarchive"), targets),
                }
                : { kind: "item", label: t("menu.archive"), icon: Archive, onSelect: () => handlers.confirmArchive(targets) },
        ]
        : [{ kind: "separator" }];
    return [
        ...header,
        ...open,
        { kind: "separator" },
        {
            kind: "sub",
            label: t("menu.moveToFolder"),
            icon: FolderInput,
            items: [
                {
                    kind: "item",
                    label: t("menu.root"),
                    icon: FolderUp,
                    onSelect: () => handlers.bulk("folder.move", t("bulk.move"), targets, { folderId: null }),
                },
                ...context.folders.map((folder) => ({
                    kind: "item",
                    label: folder.name,
                    icon: FolderIcon,
                    onSelect: () => handlers.bulk("folder.move", t("bulk.move"), targets, { folderId: folder.id }),
                })),
            ],
        },
        ...contentActions,
        {
            kind: "item",
            label: t("menu.trash"),
            icon: Trash2,
            shortcut: "Del",
            destructive: true,
            onSelect: () => handlers.confirmTrash(targets),
        },
    ];
}
