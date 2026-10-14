import type * as React from "react";
declare function Card({ className, size, ...props }: React.ComponentProps<"div"> & {
    size?: "default" | "sm";
}): React.JSX.Element;
declare function CardHeader({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element;
declare function CardTitle({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element;
declare function CardDescription({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element;
declare function CardAction({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element;
declare function CardContent({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element;
declare function CardFooter({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element;
/** The plain bordered surface for a section of a screen: a list, a form group, a table. Lay out its content yourself; `Card` is for titled cards. */
declare function Panel({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element;
export { Card, Panel, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };
