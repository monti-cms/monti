import { packageTests } from "../../vitest.shared";

export default packageTests({
	dir: import.meta.dirname,
	name: "bareun",
	environment: "jsdom",
	dom: true,
});
