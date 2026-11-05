// The core's server-only modules (the Postgres pool of `openMonti`, the schema files of the dev server) are never called in Storybook, where the
// site runs on PGlite with `files: null`. These stand in for them so the core's index loads in the browser.
export class Pool {}
export const mkdir = async () => {};
export const readdir = async () => [];
export const readFile = async () => "";
export const writeFile = async () => {};
const path = { join: (...parts: string[]) => parts.join("/") };
export default path;
