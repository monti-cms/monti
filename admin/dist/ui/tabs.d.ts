import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { type VariantProps } from "class-variance-authority";
declare function Tabs({ className, orientation, ...props }: TabsPrimitive.Root.Props): import("react").JSX.Element;
declare const tabsListVariants: (props?: ({
    variant?: "default" | "line" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
declare function TabsList({ className, variant, ...props }: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>): import("react").JSX.Element;
declare function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props): import("react").JSX.Element;
declare function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props): import("react").JSX.Element;
/** A bar of line tabs under a header, edge to edge with a bottom border (inside a panel or a sheet). */
declare function LineTabs({ className, ...props }: Omit<TabsPrimitive.List.Props, "variant">): import("react").JSX.Element;
/** The line tabs that sit at the top of a page or a screen's main area. */
declare function PageTabs({ className, ...props }: Omit<TabsPrimitive.List.Props, "variant">): import("react").JSX.Element;
export { Tabs, TabsList, TabsTrigger, TabsContent, LineTabs, PageTabs, tabsListVariants };
