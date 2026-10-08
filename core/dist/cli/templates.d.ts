import type { ContentFolder, FrontMatterKey } from "./init-detect.js";
/** Contents of the files `monti init` creates (developer-facing, so English). A starting point the app edits right away. */
/** Defaults `monti init` writes into a new config. */
export declare const DEFAULT_INIT_LOCALE = "en";
export declare const DEFAULT_INIT_TIME_ZONE = "UTC";
/** The admin path `monti init` asks for and writes by default. */
export declare const DEFAULT_INIT_ADMIN_PATH = "/studio";
export declare const DEFAULT_SITE_URL = "http://localhost:3000";
/** A body block or inline mark of `@monti-cms/blocks`, as `monti init` offers it. */
export interface BlockChoice {
    /** The name used in flags (`--blocks callout,tabs`). */
    readonly id: string;
    /** The function listed in `plugins`: exported by `@monti-cms/blocks`, or by `@monti-cms/blocks/<id>` for a block with a `needs` (the heavy ones, so the barrel never loads their library). */
    readonly fn: string;
    /** One line for the list and for the comment in the config. */
    readonly description: string;
    /** An npm package the block needs besides `@monti-cms/blocks`. */
    readonly needs?: string;
    /** Why the block is not in the default set: what it adds to the app. Set only for blocks that are opt-in. */
    readonly heavy?: string;
}
/** Every block of `@monti-cms/blocks`, in the order the plugins are listed (the inline marks last: overlapping marks are stored in this order). */
export declare const BLOCK_CHOICES: readonly BlockChoice[];
/**
 * The blocks `monti init` turns on when nobody chose: the light ones. The heavy ones (`mermaid`, `chart`) are opt-in (`--blocks all` or a list that names them),
 * because each adds a large package to the app. `columns`, `code-explorer` and `tooltip` are also left out: they are small, but a first blog rarely needs them.
 */
export declare const DEFAULT_BLOCK_IDS: readonly string[];
/** What the questions of `monti init` decided. Every field has a flag. */
export interface InitAnswers {
    /** Public URL of the site, for the `SITE_URL` example in `.env.example`. */
    readonly siteUrl: string;
    /** Locale codes, the default first. */
    readonly locales: readonly string[];
    readonly timeZone: string;
    readonly storage: "none" | "s3";
    readonly ai: boolean;
    readonly gitSync: boolean;
    /** Ids of {@link BLOCK_CHOICES}. */
    readonly blocks: readonly string[];
    readonly adminPath: string;
    /** How people sign in to the admin: the built-in email and password login, or GitHub (an OAuth app). */
    readonly login: "password" | "github";
}
/** A key from front matter as a field name: kept as it is when it is one word of letters and digits, else camel-cased. `undefined` if nothing usable is left. */
export declare function fieldNameOf(key: string): string | undefined;
type SchemaField = Record<string, unknown>;
/** What the starter schema holds, and what was decided on the way (for the init report). */
export interface StarterSchema {
    /** `post` first, then the collections its relations point to. */
    readonly collections: Record<string, {
        readonly fields: Record<string, SchemaField>;
    } & Record<string, unknown>>;
    /** Plain-words lines about front matter keys that got a relation, or that need no field. */
    readonly notes: string[];
}
/**
 * The collections of the starter schema: `post` with the fields every blog has, then (when a content folder was found) one field per front matter key, read by the
 * table in `front-matter-keys.ts`:
 *
 * - `date` and the other publish date keys get no field: the entry has its own publish date.
 * - `description`, `summary`, `excerpt` and the like become the field with the `summary` role.
 * - `tags` (also `keywords`, `topics`) become the collection `tag` and a relation `tagIds`. `category` becomes `category` and `categoryId`, and `categories` (a list)
 *   `categoryIds`.
 * - `draft`, `published` and the language keys are the CMS's own and get no field.
 */
export declare function starterCollections(keys: readonly FrontMatterKey[], multiLocale: boolean): StarterSchema;
/** The public address shape for a content folder: its last folder name (`content/blog` -> `/blog/:slug`), else `/posts/:slug`. */
export declare function pathFor(folder: ContentFolder | undefined): string;
/**
 * The schema file `monti init` creates (`monti.schema.json`): the `post` collection (and the tag and category collections its front matter asks for), the locales and
 * time zone, the site name and the admin path when it is not the default. It holds the plain data of the site;
 * `monti.config.ts` loads it. `link` is the path of the JSON Schema from the schema file (editors use it for autocomplete). With `folder` (a content folder the app
 * already has) the fields follow its front matter, and `path` follows its name.
 */
export declare function schemaTemplate(answers: Pick<InitAnswers, "adminPath" | "locales" | "timeZone">, options?: {
    readonly siteName?: string;
    readonly folder?: ContentFolder;
    readonly link?: string;
}): string;
/** The module a block's function is imported from. */
export declare const blockEntry: (block: BlockChoice) => string;
/** The block choices for the ids, in the order of {@link BLOCK_CHOICES}. */
export declare const chosenBlocks: (ids: readonly string[]) => readonly BlockChoice[];
/**
 * The config file `monti init` creates: the one place the site is set up. It loads the schema file and lists the plugins, the database and the login, one line each
 * with a short comment. Nothing here is a preset: every line is a feature that is on, and deleting the line turns it off.
 */
export declare function configTemplate(answers: InitAnswers): string;
/**
 * The generated files import the CMS instance from the config file. `configImport` is its import path from the generated file, without an extension.
 * `instant`: the app turns on Next's `cacheComponents`, so the page opts out of the development-only instant navigation validation. The export is only valid with that
 * option (Next fails the build on it otherwise), which is why the template writes it only then.
 */
export declare const adminPageTemplate: (configImport: string, options?: {
    readonly instant?: boolean;
}) => string;
export declare const adminLayoutTemplate: (configImport: string, options?: {
    readonly blocks?: boolean;
}) => string;
export declare const apiRouteTemplate: (configImport: string) => string;
export declare function nextConfigTemplate(): string;
/** The OAuth callback URL of the GitHub login for a site URL. */
export declare const githubCallbackUrl: (siteUrl: string) => string;
/** How to add GitHub login to a config that has none: the one how-to `monti init` and `monti doctor` both print. */
export declare function githubLoginHowTo(siteUrl: string): string;
/**
 * `.env.example`: every variable the chosen features read, in order, each with what it is and where to get it. Committed to git, so it holds placeholders only,
 * never a secret. The person copies it to `.env.local` (`cp .env.example .env.local`) and fills it in.
 */
export declare function envExampleTemplate(answers: InitAnswers): string;
/** The npm packages the answers need, besides what the app already lists. */
export declare function packagesFor(answers: InitAnswers): string[];
export {};
