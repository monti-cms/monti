import type * as React from "react";
import type { ErrorNotice as Notice } from "../api/client.js";
/**
 * An error as the person reads it: what went wrong, what to do (when known), and the developer text folded under "Details".
 * Build the notice with `errorNotice()` of `@monti-cms/admin`.
 */
declare function ErrorNoticeView({ notice, className, ...props }: React.ComponentProps<"div"> & {
    notice: Notice;
}): React.JSX.Element;
export { ErrorNoticeView };
