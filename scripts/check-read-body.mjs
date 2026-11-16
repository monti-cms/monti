/**
 * One way to read a body (`check:design` runs it): every view that shows a body without editing it (the comparison of two copies, a change a proposal
 * makes, the source beside a translation, an answer of the assistant) draws it with `ReadBody` (`packages/admin/src/editor/read-body.tsx`): the editor's own
 * schema makes each block's element, under the editor's own body classes.
 *
 *   one-body   The parts that read a body in a way of their own are gone, and the code names none of them: `shownBlocks` (the body flattened to heading,
 *              code or text), `ReadBlock`, `CompareParagraph`, `CompareHeading`, `CompareCode`, `DocCallout`, `DocCode` and `DocTable`. There is no list
 *              of files that may: a view that needs one of them is drawn with `ReadBody`, or `ReadBody` is changed for everyone.
 *
 * Cannot see: a new part that does the same job under another name (a `ReadParagraph`, a `CompareBlockText`), a body flattened to text by a function
 * with another name, and a read-only view drawn from raw elements and classes written by hand. Those are what the `design-review` agent reads for.
 */

/** The names of the old parts, as whole words. */
export const OLD_READ_PARTS = [
	"shownBlocks",
	"ReadBlock",
	"CompareParagraph",
	"CompareHeading",
	"CompareCode",
	"DocCallout",
	"DocCode",
	"DocTable",
];

const NAMES = new RegExp(`\\b(${OLD_READ_PARTS.join("|")})\\b`);

/** Source files of the packages and the examples: where a body is read. */
const inSources = (file) =>
	/\.tsx?$/.test(file) && /^(?:packages|examples)\//.test(file) && !/(?:^|\/)node_modules\//.test(file);

export function oneBody(sources) {
	const found = [];
	for (const [file, source] of Object.entries(sources)) {
		if (!inSources(file)) continue;
		source.split("\n").forEach((text, index) => {
			const name = NAMES.exec(text)?.[1];
			if (name)
				found.push({
					file,
					line: index + 1,
					message: `\`${name}\` read a body in a way of its own: draw it with ReadBody (packages/admin/src/editor/read-body.tsx)`,
				});
		});
	}
	return found;
}
