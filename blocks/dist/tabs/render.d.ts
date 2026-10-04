import { type PropsWithChildren } from "react";
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
export default _default;
/** Public component for tabs (called by `@monti-cms/core/render`). */
declare function _default(): {
    Tabs: typeof Tabs;
    Tab: typeof Tab;
};
