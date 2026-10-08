/**
 * What the admin screens that run on the server need from the framework: stopping the render with a redirect or a 404.
 * A host package supplies it to `AdminPage` (`@monti-cms/nextjs` passes Next's `redirect` and `notFound`).
 */
export interface AdminServer {
    /** Sends the browser to an address inside the site. Never returns (it unwinds the render the way the framework does). */
    redirect(href: string): never;
    /** Answers 404. Never returns. */
    notFound(): never;
}
