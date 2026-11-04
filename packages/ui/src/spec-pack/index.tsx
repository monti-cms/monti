import { cn } from "../cn";
import type { Catalog } from "../spec/check";
import { createScreenSpec, type ScreenPack } from "../spec/render";
import catalog from "./catalog.generated.json";
import { parts } from "./parts";
import { spacing } from "./spacing";

/** Draws a screen spec with Monti's design system (`@monti-cms/ui/spec`). */
export const ScreenSpec = createScreenSpec({
	parts: parts as ScreenPack["parts"],
	catalog: catalog as Catalog,
	spacing,
	join: cn,
});

export type { ScreenSpecDocument } from "../spec/format";
export { ScreenSpecError } from "../spec/render";
