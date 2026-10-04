"use client";

import { isCollection, isItemCollection, schemaOf } from "@monti-cms/core/client";
import {
	Bookmark,
	BookOpen,
	Box,
	Calendar,
	CircleX,
	FileText,
	Folder,
	Highlighter,
	Image,
	Layers,
	Link,
	List,
	type LucideIcon,
	MessageSquare,
	Minus,
	Newspaper,
	NotebookPen,
	Plug,
	Plus,
	Puzzle,
	Settings,
	Shapes,
	Sigma,
	Star,
	Tag,
	TriangleAlert,
	User,
	Users,
	Video,
} from "lucide-react";
import { useCallback } from "react";
import { useCmsAdminComponents } from "../../admin-components";

/**
 * Built-in icons selectable by a collection definition's `icon`, a plugin sidebar item's `icon`, a block definition's `editor.icon`, or a code-line effect's `icon` (lucide name).
 * Only frequently used ones are included so not every icon is bundled. For other names, plugins/the site
 * register them through `icons` of `CmsAdminComponentsProvider`. For an unknown collection icon name, publishable collections use a document icon and taxonomy collections a tag icon.
 */
const ICONS: Readonly<Record<string, LucideIcon>> = {
	bookmark: Bookmark,
	"book-open": BookOpen,
	box: Box,
	calendar: Calendar,
	"circle-x": CircleX,
	"file-text": FileText,
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
export function useIconByName(): (name: string | undefined) => LucideIcon | undefined {
	const { icons } = useCmsAdminComponents();
	return useCallback((name) => (name ? (icons?.[name] ?? ICONS[name]) : undefined), [icons]);
}

export function CollectionIcon({ collection }: { collection: string }) {
	const iconByName = useIconByName();
	const name = isCollection(collection) ? schemaOf(collection).icon : undefined;
	const Icon = iconByName(name) ?? (isItemCollection(collection) ? Tag : FileText);
	return <Icon />;
}

/** Icon picked by name. For an unknown name, the plug icon. */
export function NamedIcon({ name }: { name?: string }) {
	const Icon = useIconByName()(name) ?? Plug;
	return <Icon />;
}
