import type { Site } from "../site/index.js";
import { issueMessages } from "./issues.messages.js";
import type { BodyPosition } from "./types.js";
export { issueMessages };
type IssueSite = Pick<Site, "createTranslator">;
/** What {@link issueText} reads of an issue: a content issue (`Issue`), a format's finding, or a value of a request that did not check (a zod issue). */
export interface IssueLike {
    readonly code?: string;
    readonly message?: string;
    readonly path?: string | readonly PropertyKey[];
    readonly position?: BodyPosition;
}
/** The person's text of an issue: what is wrong (`text`) and, when the issue has a place, where (`where`: a line and column in a body text, or the field path). */
export interface IssueText {
    readonly text: string;
    readonly where?: string;
}
/** An issue as an admin answer sends it: the issue with its {@link IssueText}. */
export type ToldIssue<I extends IssueLike = IssueLike> = I & IssueText;
/**
 * The text of an issue in the admin language. A code in the `cms.core.issues` dictionary has its text there (a required or too long field names the field
 * from `message`, its label); a code whose `message` names the target adds it. A code the dictionary does not have is shown as its own `message`, which a
 * hook writes for a person.
 */
export declare function issueText(site: IssueSite, issue: IssueLike): IssueText;
/** The issues with their text, as an admin answer sends them. */
export declare const tellIssues: <I extends IssueLike>(site: IssueSite, issues: readonly I[]) => ToldIssue<I>[];
