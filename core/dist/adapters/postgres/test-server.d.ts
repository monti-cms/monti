import type { CmsServerConfig } from "../../server/define.js";
/** What {@link testServer} returns: the server options to spread into `defineConfig`, and the cleanup. */
export interface TestServer {
    /** `{ database, auth }`: spread it into `defineConfig({ …, ...server })`. */
    readonly server: Pick<CmsServerConfig, "database" | "auth">;
    /** The name of the schema this test owns. */
    readonly schema: string;
    /** Drops the schema. Call `cms.close()` first. */
    drop(): Promise<void>;
}
/**
 * The server options for a test that runs the real write pipeline: a Postgres adapter on a schema of its own in `CMS_TEST_DATABASE_URL`, and a login where every
 * request is signed in as an admin (so `cms.handle(request)` reaches the admin routes). `cms.migrate()` creates the tables, `drop()` removes the schema, so tests never see each other's data.
 *
 * ```ts
 * const test = testServer();
 * const cms = defineConfig({ schema, plugins: [myPlugin()], ...test.server });
 * beforeAll(() => cms.migrate());
 * afterAll(async () => { await cms.close(); await test.drop(); });
 * ```
 */
export declare function testServer(): TestServer;
