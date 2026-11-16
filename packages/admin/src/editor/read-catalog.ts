import { createContext } from "react";
import type { Catalog } from "./catalog";

/**
 * What every body read and every name said below `ReadBodies` share: the site's blocks, read once, and the library files its pictures and files name (read
 * once for the ones asked of it: `want`). `null` without a `ReadBodies`.
 */
export const ReadCatalog = createContext<{
	kit: Catalog | null;
	files: readonly { id: string; name: string }[];
	want: (media: string) => void;
} | null>(null);
