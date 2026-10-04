import { defineServerConfig, githubAuth, postgres } from "../src/server";
import { r2Storage } from "../src/storage/s3";

/**
 * Server config for the package's own tests. Store tests create connections themselves (`test-database.ts`); this config is read by code that goes through the connection container
 * (`container.ts`). Tests swap environment variables, so values are read from the environment each time.
 */
export default defineServerConfig({
	database: postgres({ connectionString: process.env.CMS_TEST_DATABASE_URL }),
	media: r2Storage({
		accessKeyId: undefined,
		secretAccessKey: undefined,
		bucket: undefined,
		endpoint: undefined,
		publicBaseUrl: undefined,
	}),
	auth: githubAuth({ clientId: undefined, clientSecret: undefined, adminIds: [] }),
	get secret() {
		return process.env.AUTH_SECRET;
	},
});
