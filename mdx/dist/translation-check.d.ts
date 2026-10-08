import { type Site, type StructureCheck } from "@monti-cms/core/client";
import type { SyntaxExtension } from "./syntax/types.js";
/** Whether it can be read as MDX (even with the structure check off, it must be readable to go into the body). */
export declare function readableMdx(site: Site, mdx: string, syntax?: readonly SyntaxExtension[]): StructureCheck;
/** Whether the translated MDX has the same skeleton as the source MDX. Failure if either cannot be read as MDX. */
export declare function compareMdxStructure(site: Site, sourceMdx: string, translatedMdx: string, syntax?: readonly SyntaxExtension[]): StructureCheck;
