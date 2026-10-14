import { packageTests } from "../../vitest.shared";

export default packageTests({
	dir: import.meta.dirname,
	name: "blocks",
	environment: "jsdom",
	dom: true,
});
