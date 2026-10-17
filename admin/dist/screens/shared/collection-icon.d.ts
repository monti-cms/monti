import { type LucideIcon } from "lucide-react";
/**
 * Built-in icons selectable by a collection definition's `icon`, a plugin sidebar item's `icon`, a block definition's `editor.icon`, or a code-line effect's `icon` (lucide name).
 * Only frequently used ones are included so not every icon is bundled. For other names, plugins/the site
 * register them through `icons` of `AdminComponentsProvider`. For an unknown collection icon name, publishable collections use a document icon and taxonomy collections a tag icon.
 */
export declare const ICONS: Readonly<Record<string, LucideIcon>>;
export declare const COLLECTION_ICON_NAMES: string[];
/**
 * Function that picks an icon by name. Looks at registered icons (`AdminComponents.icons`) first, then the built-in icons.
 * `undefined` for an unknown name.
 */
export declare function useIconByName(): (name: string | undefined) => LucideIcon | undefined;
export declare function CollectionIcon({ collection }: {
    collection: string;
}): import("react").JSX.Element;
/** Icon picked by name. For an unknown name, the plug icon. */
export declare function NamedIcon({ name }: {
    name?: string;
}): import("react").JSX.Element;
