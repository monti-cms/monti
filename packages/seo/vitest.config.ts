import { packageTests } from "../../vitest.shared";

export default packageTests({
	dir: import.meta.dirname,
	name: "seo",
	environment: "jsdom",
	dom: true,
});
