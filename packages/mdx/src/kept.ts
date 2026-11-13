/**
 * The languages a kept-as-written piece is stored under (a code block): a component or directive no block is known for, and a chunk of
 * HTML. The writer puts each back as it was, and the to-do finds the first. They are not `mdx` and `html`: a code block a person wrote in
 * those languages is code, and is written fenced.
 */
export const KEPT = "mdx-kept";
export const KEPT_HTML = "html-kept";
