import { packageTests } from "../../vitest.shared";

export default packageTests({
	dir: import.meta.dirname,
	name: "mdx",
	// The source panel tests run in a browser environment (`// @vitest-environment jsdom` in the file); the rest of the package needs none.
	dom: true,
});
