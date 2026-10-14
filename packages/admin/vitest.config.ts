import { packageTests } from "../../vitest.shared";

export default packageTests({
	dir: import.meta.dirname,
	name: "admin",
	environment: "jsdom",
	dom: true,
});
