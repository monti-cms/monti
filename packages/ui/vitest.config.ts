import { packageTests } from "../../vitest.shared";

export default packageTests({
	dir: import.meta.dirname,
	name: "ui",
	environment: "jsdom",
	dom: true,
});
