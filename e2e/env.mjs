/** The port of the example app under test: not the owner's preview (3990) or the usual dev ports. */
export const E2E_PORT = "3871";
export const E2E_URL = `http://127.0.0.1:${E2E_PORT}`;

/**
 * What the example app runs with in the flow tests. Only the test database, never `DATABASE_URL` from the shell. The GitHub values are
 * placeholders: GitHub login is configured (its button shows), but no test signs in with it.
 */
export const E2E_ENV = (rootEnv = {}) => ({
	E2E_PORT,
	DATABASE_URL: process.env.CMS_TEST_DATABASE_URL || rootEnv.CMS_TEST_DATABASE_URL || "postgres://localhost/monti_test",
	DATABASE_SCHEMA: "cms_e2e",
	MONTI_SECRET: "e2e-only-secret-e2e-only-secret-e2e-only",
	SITE_URL: E2E_URL,
	// The site's public URL for the login (Auth.js trusts the host it names), as a deployed site without a proxy sets it.
	AUTH_URL: E2E_URL,
	AUTH_GITHUB_ID: "e2e-placeholder",
	AUTH_GITHUB_SECRET: "e2e-placeholder",
	MONTI_ADMIN_GITHUB_ID: "1",
	NEXT_TELEMETRY_DISABLED: "1",
});
