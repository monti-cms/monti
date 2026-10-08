/**
 * `@monti-cms/git-sync/server` for the browser bundle. The site config is also read in the browser, which would bundle the code that loads the server side;
 * this empty entry point replaces it so server code (Node crypto, the GitHub client) is not sent to the browser (the `browser` condition of package.json `exports`).
 */
const empty = {};
export default empty;
