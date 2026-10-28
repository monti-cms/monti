"use client";

import {
	Add,
	AppConnectivity,
	Archive,
	Book,
	Bookmark,
	Box,
	Bullhorn,
	Calendar,
	CenterCircle,
	Chat,
	CloseOutline,
	CodeReference,
	ColorPalette,
	Compass,
	Dashboard,
	DataBase,
	Document,
	DocumentBlank,
	DocumentView,
	Email,
	Favorite,
	Fire,
	Flag,
	Flash,
	Folder,
	Gift,
	Globe,
	Hashtag,
	Idea,
	Image,
	Layers,
	Link,
	List,
	Location,
	Music,
	Notebook,
	NotebookReference,
	Package,
	Password,
	Pin,
	Plug,
	Portfolio,
	Quotes,
	Rocket,
	Rss,
	Screen,
	Search,
	Settings,
	Shapes,
	ShoppingBag,
	Sigma,
	Star,
	Subtract,
	Table,
	Tag,
	Terminal,
	TextHighlight,
	Ticket,
	Time,
	User,
	UserMultiple,
	Video,
	WarningAlt,
} from "@carbon/icons-react";
import { useSite } from "@monti-cms/core/site";
import { type MontiIcon, Spark } from "@monti-cms/ui";
import { useCallback } from "react";
import { useAdminComponents } from "../../admin-components";

/**
 * Built-in icons selectable by a collection definition's `icon`, a plugin sidebar item's `icon`, a block definition's `editor.icon`, or a code-line effect's
 * `icon`, by their IBM Carbon icon name (`document`, `warning--alt`, `text--highlight`) and `spark` for the assistant's ✦.
 * Only frequently used ones are included so not every icon is bundled. For other names, plugins/the site
 * register them through `icons` of `AdminComponentsProvider`. For an unknown collection icon name, publishable collections use a document icon and taxonomy collections a tag icon.
 */
export const ICONS: Readonly<Record<string, MontiIcon>> = {
	add: Add,
	"app-connectivity": AppConnectivity,
	archive: Archive,
	book: Book,
	bookmark: Bookmark,
	box: Box,
	bullhorn: Bullhorn,
	calendar: Calendar,
	"center--circle": CenterCircle,
	chat: Chat,
	"close--outline": CloseOutline,
	"code--reference": CodeReference,
	"color-palette": ColorPalette,
	compass: Compass,
	dashboard: Dashboard,
	"data--base": DataBase,
	document: Document,
	"document--blank": DocumentBlank,
	"document--view": DocumentView,
	email: Email,
	favorite: Favorite,
	fire: Fire,
	flag: Flag,
	flash: Flash,
	folder: Folder,
	gift: Gift,
	globe: Globe,
	hashtag: Hashtag,
	idea: Idea,
	image: Image,
	layers: Layers,
	link: Link,
	list: List,
	location: Location,
	music: Music,
	notebook: Notebook,
	"notebook--reference": NotebookReference,
	package: Package,
	password: Password,
	pin: Pin,
	plug: Plug,
	portfolio: Portfolio,
	quotes: Quotes,
	rocket: Rocket,
	rss: Rss,
	screen: Screen,
	search: Search,
	settings: Settings,
	shapes: Shapes,
	"shopping--bag": ShoppingBag,
	sigma: Sigma,
	star: Star,
	subtract: Subtract,
	table: Table,
	tag: Tag,
	terminal: Terminal,
	"text--highlight": TextHighlight,
	ticket: Ticket,
	time: Time,
	user: User,
	"user--multiple": UserMultiple,
	video: Video,
	"warning--alt": WarningAlt,
	spark: Spark,
};

export const COLLECTION_ICON_NAMES = Object.keys(ICONS);

/**
 * Function that picks an icon by name. Looks at registered icons (`AdminComponents.icons`) first, then the built-in icons.
 * `undefined` for an unknown name.
 */
export function useIconByName(): (name: string | undefined) => MontiIcon | undefined {
	const { icons } = useAdminComponents();
	return useCallback((name) => (name ? (icons?.[name] ?? ICONS[name]) : undefined), [icons]);
}

export function CollectionIcon({ collection }: { collection: string }) {
	const site = useSite();
	const iconByName = useIconByName();
	const name = site.isCollection(collection) ? site.schemaOf(collection).icon : undefined;
	const Icon = iconByName(name) ?? (site.isItemCollection(collection) ? Tag : Document);
	return <Icon />;
}

/** Icon picked by name. For an unknown name, the plug icon. */
export function NamedIcon({ name }: { name?: string }) {
	const Icon = useIconByName()(name) ?? Plug;
	return <Icon />;
}
