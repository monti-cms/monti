import { type GitHubClient, type GitHubClientFactory, type GitHubClientOptions } from "./client.js";
/** The fetch the client calls. Replaceable, so a test can check the requests without a network. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;
/**
 * The GitHub client over the REST API (and one GraphQL call for auto-merge). Every call that fails throws a {@link GitHubApiError} with the HTTP status, so the
 * event outbox retries it. The token is sent only in the `Authorization` header.
 */
export declare function createGitHubClient(options: GitHubClientOptions, fetchImpl?: FetchLike): GitHubClient;
/** The real client as a factory (what the plugin uses unless `gitSync({ client })` gives another one). */
export declare const githubClientFactory: GitHubClientFactory;
