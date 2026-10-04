import { type LucideIcon } from "lucide-react";
export declare const COLLECTION_ICON_NAMES: string[];
/**
 * Function that picks an icon by name. Looks at registered icons (`CmsAdminComponents.icons`) first, then the built-in icons.
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
