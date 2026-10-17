"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useSite } from "@monti-cms/core/site";
import { Archive, Bookmark, BookOpen, Box, Briefcase, Calendar, CircleX, Clock, Compass, Database, File, FileCode, FileText, Film, Flag, Flame, Focus, Folder, Gift, Globe, Hash, Heart, Highlighter, Image, Inbox, Key, Layers, Layout, Lightbulb, Link, List, Mail, MapPin, Megaphone, MessageSquare, Minus, Music, Newspaper, NotebookPen, Package, Palette, Pin, Plug, Plus, Puzzle, Quote, Rocket, Rss, Search, Settings, Shapes, ShoppingBag, Sigma, Sparkles, Star, StickyNote, Table, Tag, Terminal, Ticket, TriangleAlert, Tv, User, Users, Video, Zap, } from "lucide-react";
import { useCallback } from "react";
import { useAdminComponents } from "../../admin-components.js";
/**
 * Built-in icons selectable by a collection definition's `icon`, a plugin sidebar item's `icon`, a block definition's `editor.icon`, or a code-line effect's `icon` (lucide name).
 * Only frequently used ones are included so not every icon is bundled. For other names, plugins/the site
 * register them through `icons` of `AdminComponentsProvider`. For an unknown collection icon name, publishable collections use a document icon and taxonomy collections a tag icon.
 */
export const ICONS = {
    archive: Archive,
    bookmark: Bookmark,
    "book-open": BookOpen,
    box: Box,
    briefcase: Briefcase,
    calendar: Calendar,
    "circle-x": CircleX,
    clock: Clock,
    compass: Compass,
    database: Database,
    file: File,
    "file-code": FileCode,
    "file-text": FileText,
    film: Film,
    flag: Flag,
    flame: Flame,
    focus: Focus,
    folder: Folder,
    gift: Gift,
    globe: Globe,
    hash: Hash,
    heart: Heart,
    highlighter: Highlighter,
    image: Image,
    inbox: Inbox,
    key: Key,
    layers: Layers,
    layout: Layout,
    lightbulb: Lightbulb,
    link: Link,
    list: List,
    mail: Mail,
    "map-pin": MapPin,
    megaphone: Megaphone,
    "message-square": MessageSquare,
    minus: Minus,
    music: Music,
    newspaper: Newspaper,
    "notebook-pen": NotebookPen,
    package: Package,
    palette: Palette,
    pin: Pin,
    plug: Plug,
    plus: Plus,
    puzzle: Puzzle,
    quote: Quote,
    rocket: Rocket,
    rss: Rss,
    search: Search,
    settings: Settings,
    shapes: Shapes,
    "shopping-bag": ShoppingBag,
    sigma: Sigma,
    sparkles: Sparkles,
    star: Star,
    "sticky-note": StickyNote,
    table: Table,
    tag: Tag,
    terminal: Terminal,
    ticket: Ticket,
    "triangle-alert": TriangleAlert,
    tv: Tv,
    user: User,
    users: Users,
    video: Video,
    zap: Zap,
};
export const COLLECTION_ICON_NAMES = Object.keys(ICONS);
/**
 * Function that picks an icon by name. Looks at registered icons (`AdminComponents.icons`) first, then the built-in icons.
 * `undefined` for an unknown name.
 */
export function useIconByName() {
    const { icons } = useAdminComponents();
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
