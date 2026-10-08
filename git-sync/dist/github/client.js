/**
 * The part of GitHub git-sync talks to, as an interface. The sync code never calls `fetch`: it gets a client from a factory, so tests (and other hosts later)
 * bring their own. {@link createGitHubClient} (`rest.ts`) is the real one over the GitHub REST API; `@monti-cms/git-sync/testing` has an in-memory fake.
 *
 * Everything works on the git data API (blobs, trees, commits, refs): a publish never needs a checkout, which is what serverless hosting allows.
 */
/** A failed GitHub call. `status` is the HTTP status (0 when GitHub could not be reached). */
export class GitHubApiError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.name = "GitHubApiError";
        this.status = status;
    }
}
