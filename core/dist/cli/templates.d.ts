import { type InitAnswers } from "./init-answers.js";
import type { ContentFolder } from "./init-detect.js";
/** Contents of the files `monti init` creates (developer-facing, so English). A starting point the app edits right away. */
/**
 * The schema file `monti init` creates (`monti.schema.ts`): the `post` collection (and the tag and category collections its front matter asks for), the locales and
 * time zone, the site name and the admin path when it is not the default. It holds the plain data of the site;
 * `monti.config.ts` imports it. It is the text `printSchemaFile` writes, so the admin can rewrite it. With `folder` (a content folder the app
 * already has) the fields follow its front matter, and `path` follows its name.
 */
export declare function schemaTemplate(answers: Pick<InitAnswers, "adminPath" | "locales" | "timeZone">, options?: {
    readonly siteName?: string;
    readonly folder?: ContentFolder;
}): string;
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
