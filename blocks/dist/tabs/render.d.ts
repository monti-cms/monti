import type { BlockProps, DocumentComponentsContext, LooseDocumentComponents } from "@monti-cms/core/render";
import { type PropsWithChildren } from "react";
import type { tabsBlock } from "./definition.js";
/** One tab. `Tabs` reads its name and body, so when used on its own only the body is rendered. */
export declare function Tab({ children }: PropsWithChildren<{
    label?: string;
}>): import("react").JSX.Element;
/**
 * Tab group. Builds the tab row from the child `Tab` names (`label`) and each tab's panel from its body. The initially open tab (`defaultValue`) is a tab name,
 * or the first tab if it is absent or matches no tab. Switching is done by a client component (`TabsView`).
 */
export declare function Tabs({ defaultValue, children }: PropsWithChildren<{
    defaultValue?: string;
}>): import("react").JSX.Element;
/**
 * Tab group of the JSON renderer. It reads the tabs from the block's `items` (the stored `tab` nodes and what each renders to), not from the props of
 * child elements: the tab names are the `label` attributes and each panel is the content of its tab.
 */
export declare function DocumentTabs({ defaultValue, items, children }: BlockProps<typeof tabsBlock>): import("react").JSX.Element;
/** Public components for tabs in the JSON renderer (`renderDocument`): the blocks `tabs` and `tab`. */
export declare const documentComponents: (_context: DocumentComponentsContext) => LooseDocumentComponents;
