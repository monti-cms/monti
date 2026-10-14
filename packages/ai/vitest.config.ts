import { packageTests } from "../../vitest.shared";

export default packageTests({
	dir: import.meta.dirname,
	name: "ai",
	// Server-side tests run in node. Admin UI tests switch to jsdom with `@vitest-environment jsdom` at the top of the file.
	dom: true,
});
