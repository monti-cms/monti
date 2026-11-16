import { COLLECTION_ICONS, type CollectionIcon } from "@monti-cms/core";
import {
	Book,
	Bookmark,
	Box,
	Calendar,
	Chat,
	Document,
	Email,
	Favorite,
	Flag,
	Folder,
	Gift,
	Globe,
	Hashtag,
	Idea,
	Image,
	Layers,
	List,
	Tag,
	User,
	UserMultiple,
} from "@monti-cms/ui/icons";
import type { ComponentType, ReactNode } from "react";
import { useRead } from "../operations/use-operation";
import type { SchemaRead } from "../screens/settings/schema-draft";

/** The icon each name of a collection's icon list is drawn with. The one place that says which is which. */
const DRAWN: Record<CollectionIcon, ComponentType<{ "aria-hidden"?: boolean; "data-collection-icon"?: string }>> = {
	tag: Tag,
	user: User,
	"user-multiple": UserMultiple,
	book: Book,
	folder: Folder,
	document: Document,
	bookmark: Bookmark,
	favorite: Favorite,
	calendar: Calendar,
	chat: Chat,
	globe: Globe,
	image: Image,
	idea: Idea,
	flag: Flag,
	gift: Gift,
	layers: Layers,
	list: List,
	box: Box,
	email: Email,
	hashtag: Hashtag,
};

/** The names of the list, in the order the settings offer them. */
export const COLLECTION_ICON_NAMES = COLLECTION_ICONS;

/** What a collection wears until one is picked: the mark of its kind (an entry's page, an item's tag). */
export const iconOfKind = (kind: "document" | "item"): CollectionIcon => (kind === "item" ? "tag" : "document");

/** The icon a collection shows: the one picked in its settings, or the one of its kind. The one function every place that names a collection draws it by. */
export function collectionIcon(icon: CollectionIcon | undefined, kind: "document" | "item"): ReactNode {
	const name = icon ?? iconOfKind(kind);
	const Drawn = DRAWN[name];
	return <Drawn aria-hidden data-collection-icon={name} />;
}

/** The mark of a name of the list, for the picker. */
export const iconNamed = (name: CollectionIcon): ReactNode => collectionIcon(name, "document");

/**
 * `collectionIcon` for a collection by its identifier, read from the schema's admin values: the sidebar's row, a relation's submenu, the menus that
 * name another collection. `kind` is the one of the schema when the collection is not known yet (a relation's target read before the schema).
 */
export function useCollectionIcon(): (collection: string | undefined, kind?: "document" | "item") => ReactNode {
	const schema = useRead<SchemaRead>("schema.read");
	return (collection, kind) => {
		const known = collection === undefined ? undefined : schema.data?.schema.collections[collection];
		return collectionIcon(
			collection === undefined ? undefined : schema.data?.adminValues[collection]?.icon,
			known?.kind ?? kind ?? "document",
		);
	};
}
