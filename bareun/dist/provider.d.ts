import { type ReactNode } from "react";
/**
 * Adds the Bareun check button to the editor toolbar (results appear as wavy underlines and a results panel). The checker sends only paragraphs
 * to the site's server route (the server holds the key); its settings are those of the Bareun plugin in the site config.
 */
export declare function BareunProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
