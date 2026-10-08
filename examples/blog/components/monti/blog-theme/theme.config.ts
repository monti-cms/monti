import type { DocumentComponents } from "@monti-cms/core/render";
import { cms } from "@/monti.config";

/** The collection the theme reads: the name of a collection in `monti.schema.json`. */
type ThemeCollection = Parameters<typeof cms.read.listEntries>[0]["collection"];

export interface BlogThemeConfig {
	/** Your CMS instance (`cms` of `monti.config.ts`), the one the admin and the API route use. Change the import above if it lives elsewhere. */
	cms: typeof cms;
	/** The collection of the posts. */
	collection: ThemeCollection;
	/** Where the list page is mounted, without the language prefix: `/blog`. Used for the links back to the list. Moving the route folder means changing this too. */
	routeBase: string;
	/** Posts per page of the list. */
	pageSize: number;
	/** Name of the relation field that points to the author, or `undefined` for none. */
	authorField?: string;
	/** Name of the relation field that points to the topics (tags), or `undefined` for none. */
	topicsField?: string;
	/** Name of the relation field that points to the category (or categories) of a post, shown in the byline, or `undefined` for none. */
	categoryField?: string;
	/** Name of the text field with the summary, shown in the list and used as the page description, or `undefined` for none. */
	excerptField?: string;
	/** Title of the list page, and the label of the link back to it. */
	blogTitle: string;
	/** Public components of your blocks, passed to the renderer (see `DocumentComponents`). */
	components?: DocumentComponents;
	/** How many of the newest posts are searched for the previous and next post of a post. `0` turns the links off. */
	neighborWindow: number;
}

/** The one place to edit: the collection, the route base and the names of your fields. */
export const blogTheme: BlogThemeConfig = {
	cms,
	collection: "post",
	routeBase: "/posts",
	pageSize: 10,
	topicsField: "tagIds",
	categoryField: "categoryId",
	excerptField: "summary",
	blogTitle: "Posts",
	neighborWindow: 100,
};
