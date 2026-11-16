import { createContext } from "react";
import type { Catalog } from "./catalog";

/** The site's blocks, read once for every body read and every name said below it (`ReadBodies`); `null` without one. */
export const ReadCatalog = createContext<{ kit: Catalog | null } | null>(null);
