import type { AuthGateway } from "../adapters/auth/index.js";
import type { ContentStore } from "../core/store/index.js";
import type { CmsFormat } from "../format/types.js";
import type { MediaStore } from "../media/store.js";
import { type LoadedServerPlugin } from "../plugin/server.js";
import type { PluginStorage } from "../plugin/storage.js";
import type { CmsAuth, CmsServerConfig } from "../server/define.js";
import type { AnyCmsConfig } from "../site/index.js";
import { type BulkService, type Cms, type ContentService } from "./create-cms.js";
/** What a test supplies to {@link fakeCms}. Whatever it leaves out fails loudly when the code under test touches it. */
export interface FakeCmsParts<Config extends AnyCmsConfig = AnyCmsConfig> {
    /**
     * The site config the instance is created with. Default: a minimal one (an English site with one `page` collection), enough for code that only
     * needs some site. Pass the config the code under test is written against.
     */
    readonly config?: Config;
    /** The content store (`cms.store()`). Only the methods the code under test calls are needed. */
    readonly store?: Partial<ContentStore>;
    readonly contentService?: Partial<ContentService>;
    readonly bulkService?: Partial<BulkService>;
    readonly mediaStore?: Partial<MediaStore>;
    /** Plugin storage (`cms.storage(name)`). Default: in memory, one per instance, so plugins keep their data between calls of a test. */
    readonly storage?: (plugin: string) => PluginStorage;
    /** The admin check. Default: every request is an admin. Make it throw an `AuthError` to test a refused request. */
    readonly verifyAdmin?: AuthGateway["verifyAdmin"];
    /** Pieces of the login connection (`cms.auth()`): session, providers, handlers and so on. */
    readonly auth?: Partial<CmsAuth>;
    /** Other server config values (`hooks`, `publicApi`, `secret`, `trustHost`, ...). */
    readonly server?: Partial<CmsServerConfig>;
    /** The server side of the site's plugins (routes, features, hooks, migrations), as if the site config listed them. Default: none. */
    readonly plugins?: readonly LoadedServerPlugin[];
    /** Formats added to the built-in ones, as if a plugin provided them. Default: none. */
    readonly formats?: readonly CmsFormat[];
}
declare const DEFAULT_CONFIG: import("..").CmsConfig<{
    readonly page: import("..").CollectionSchema<{
        readonly title: {
            readonly kind: "text";
        } & {
            readonly label: "Title";
            readonly required: true;
        };
        readonly slug: {
            readonly kind: "slug";
        } & {
            readonly label: "Slug";
            readonly from: "title";
            readonly required: true;
        };
    }, "document">;
}, "en", readonly [], readonly []>;
/** A login connection for tests: no session, every request is an admin, and `parts` replaces whatever a test needs (`session`, `providers`, ...). */
export declare const fakeAuth: (parts?: Partial<CmsAuth>) => CmsServerConfig["auth"];
/**
 * A CMS instance for tests that call route handlers, the read API or plugin code directly. It is a real instance (`createCms`) over a server config
 * whose database, media store and login are the parts the test provides, so the code under test goes through `cms` exactly as in the app.
 * Several fake instances can live in one test file, each with its own parts.
 */
export declare function fakeCms<const Config extends AnyCmsConfig = typeof DEFAULT_CONFIG>(parts?: FakeCmsParts<Config>): Cms<Config>;
export {};
