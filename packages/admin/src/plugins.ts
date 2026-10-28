import type { Site } from "@monti-cms/core/site";
import type { ComponentType, ReactNode } from "react";
import type { AdminComponents } from "./admin-components";
import type { AdminEvents } from "./events";
import type { StatusCells } from "./screens/shared/status-bar";
import type { SlotSource } from "./slots/registry";

/**
 * A side panel a plugin adds to the admin: a button in the header of every screen opens it on the right (a sheet on narrow screens), and the admin remembers
 * whether it is open and how wide. Its component reads where the admin is with `useScreenContext`, and on the entry editor the open entry with `useOpenEditor`.
 * The component is a client component, so give the panel from a `"use client"` module.
 */
export interface AdminPanel {
	/** Name of the panel, for its button and its title. */
	readonly label: string;
	/** The icon of its button. */
	readonly icon: ComponentType<{ readonly "aria-hidden"?: boolean }>;
	/** The panel's content. It draws its own frame (`SidePanelFrame` from `@monti-cms/admin/kit` has the header, the body and the footer) and closes itself with `onClose`. */
	readonly Component: ComponentType<AdminPanelProps>;
}

/** What the admin gives a panel's component. */
export interface AdminPanelProps {
	/** Closes the panel (the header's close button calls it). */
	readonly onClose: () => void;
}

/**
 * The admin side of a plugin: the default export of the module the plugin definition's `admin` loads (`definePlugin({ admin: () => import("./admin") })`).
 * Everything is declared; the admin applies it. The module ends up in the browser bundle, so it holds no server-only code (DB, secrets). It may be a
 * `"use client"` module itself, with its components in it, or a plain module whose components come from `"use client"` modules: the admin hands the
 * declaration to the browser as it is, and a function the browser cannot receive (one written in a plain module) fails there.
 */
export interface AdminPlugin {
	/**
	 * The plugin's pages in the Tools group of the sidebar, by the `path` of a `nav` item of the plugin definition (`<admin path>/tools/<path>`): client
	 * components, framed by the admin (sidebar, title). The admin login check happens before the admin UI renders.
	 */
	readonly pages?: Readonly<Record<string, ComponentType>>;
	/**
	 * What the plugin adds to the admin: field inputs and views, list cells, block views, marks, editor extensions, code fence previews, text checkers, source
	 * panels, formats and icons (`AdminComponents`). Give a function of the site when they depend on the site config (its options, its language).
	 */
	readonly components?: AdminComponents | ((site: Site) => AdminComponents);
	/** Actions attached to the screen slots (the button next to a field, a menu in the editor), as `SlotSource`s. */
	readonly slots?: readonly SlotSource[];
	/**
	 * The cells the plugin fills in the status bar under the editor, by name: `statusCells: { spelling: SpellingCell }`. The core provides the slot (after
	 * the to-do cell, in the source editor and the translation editor alike) and the cell and the list that opens from it; the plugin brings only what
	 * goes in them. A cell component renders `StatusBarPluginCell` (from `@monti-cms/admin/kit`: its name, its findings, each with one action, and the
	 * settings and "fix all" actions of the list), or `null` to draw nothing, and reads where it is shown with `useStatusBarContext`. Give a function of the
	 * site when the cells depend on the site config. The components are client components, so give them from a `"use client"` module.
	 */
	readonly statusCells?: StatusCells | ((site: Site) => StatusCells);
	/**
	 * A side panel (see {@link AdminPanel}). The admin shows one panel for now: when several plugins declare one, the plugin registered last wins. Give a
	 * function of the site when the label depends on the site config.
	 */
	readonly panel?: AdminPanel | ((site: Site) => AdminPanel);
	/**
	 * A provider around the admin, for a plugin that needs a React context of its own (state shared between its parts, a query it keeps). Most plugins
	 * declare `components` and `slots` and need none.
	 */
	readonly Provider?: ComponentType<{ readonly children: ReactNode }>;
	/**
	 * What the plugin reacts to in the admin, by target and event: `on: { editor: { imageInserted: [fillAltText] } }` (see `AdminEvents`). The same shape
	 * as `on` of the server side. Give a function of the site when the subscribers depend on the site config (an option that turns them on). The
	 * subscribers, and that function, are client functions, so give them from a `"use client"` module.
	 */
	readonly on?: AdminEvents | ((site: Site) => AdminEvents);
}

/** Declares the admin side of a plugin. It returns what it is given, typed. */
export const defineAdminPlugin = (plugin: AdminPlugin): AdminPlugin => plugin;
