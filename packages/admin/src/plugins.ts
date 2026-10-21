import type { Site } from "@monti-cms/core/site";
import type { ComponentType, ReactNode } from "react";
import type { AdminComponents } from "./admin-components";
import type { AdminEvents } from "./events";
import type { StatusItems } from "./screens/shared/status-bar";
import type { SlotSource } from "./slots/registry";

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
	 * Items the plugin adds to the status bar at the bottom of every screen, by name: `{ align: "start" | "end", order, Component }`. The component renders a
	 * `StatusBarItem` (from `@monti-cms/admin/kit`), or `null` to hide, and reads where it is shown with `useStatusBarContext`. An item shows only changing
	 * state that leads somewhere when clicked, and hides when there is nothing to say. Give a function of the site when the items depend on the site config.
	 * The components are client components, so give them from a `"use client"` module.
	 */
	readonly statusItems?: StatusItems | ((site: Site) => StatusItems);
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
