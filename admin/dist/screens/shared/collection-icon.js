"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useSite } from "@monti-cms/core/client";
import { Bookmark, BookOpen, Box, Calendar, CircleX, FileText, Focus, Folder, Highlighter, Image, Layers, Link, List, MessageSquare, Minus, Newspaper, NotebookPen, Plug, Plus, Puzzle, Settings, Shapes, Sigma, Star, Tag, TriangleAlert, User, Users, Video, } from "lucide-react";
import { useCallback } from "react";
import { useCmsAdminComponents } from "../../admin-components.js";
/**
 * Built-in icons selectable by a collection definition's `icon`, a plugin sidebar item's `icon`, a block definition's `editor.icon`, or a code-line effect's `icon` (lucide name).
 * Only frequently used ones are included so not every icon is bundled. For other names, plugins/the site
 * register them through `icons` of `CmsAdminComponentsProvider`. For an unknown collection icon name, publishable collections use a document icon and taxonomy collections a tag icon.
 */
const ICONS = {
    bookmark: Bookmark,
    "book-open": BookOpen,
    box: Box,
    calendar: Calendar,
    "circle-x": CircleX,
    "file-text": FileText,
    focus: Focus,
    folder: Folder,
    highlighter: Highlighter,
    image: Image,
    layers: Layers,
    link: Link,
    list: List,
    "message-square": MessageSquare,
    minus: Minus,
    newspaper: Newspaper,
    "notebook-pen": NotebookPen,
    plug: Plug,
    plus: Plus,
    puzzle: Puzzle,
    settings: Settings,
    shapes: Shapes,
    sigma: Sigma,
    star: Star,
    tag: Tag,
    "triangle-alert": TriangleAlert,
    user: User,
    users: Users,
    video: Video,
};
export const COLLECTION_ICON_NAMES = Object.keys(ICONS);
/**
 * Function that picks an icon by name. Looks at registered icons (`CmsAdminComponents.icons`) first, then the built-in icons.
 * `undefined` for an unknown name.
 */
export function useIconByName() {
    const { icons } = useCmsAdminComponents();
    return useCallback((name) => (name ? (icons?.[name] ?? ICONS[name]) : undefined), [icons]);
}
export function CollectionIcon({ collection }) {
    const site = useSite();
    const iconByName = useIconByName();
    const name = site.isCollection(collection) ? site.schemaOf(collection).icon : undefined;
    const Icon = iconByName(name) ?? (site.isItemCollection(collection) ? Tag : FileText);
    return _jsx(Icon, {});
}
/** Icon picked by name. For an unknown name, the plug icon. */
export function NamedIcon({ name }) {
    const Icon = useIconByName()(name) ?? Plug;
    return _jsx(Icon, {});
}
