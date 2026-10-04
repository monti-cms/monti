import type { ReactNode } from "react";
/** The Bareun checker. The browser sends only paragraphs to the site's server route (the server holds the key). */
export declare const bareunChecker: import("@monti-cms/core").TextChecker;
/** Adds the Bareun check button to the editor toolbar (results appear as wavy underlines and a results panel). */
export declare function BareunProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
