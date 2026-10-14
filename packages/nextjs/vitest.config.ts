import { packageTests } from "../../vitest.shared";

export default packageTests({
	dir: import.meta.dirname,
	name: "nextjs",
	environment: "jsdom",
	dom: true,
});
