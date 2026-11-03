// Pilot check (run with `npx tsx src/spec/catalog.check.ts`): the login spec passes the catalog, and specs that leave the design system fail it.
import loginSpec from "../screens/login.spec.json";
import { checkSpec } from "./catalog";

// biome-ignore lint/suspicious/noExplicitAny: the cases break the spec on purpose.
const clone = () => structuredClone(loginSpec) as unknown as { elements: Record<string, any> };
const cases: [string, unknown][] = [
	["the login spec", loginSpec],
	[
		"a button variant the design system has no",
		(() => {
			const s = clone();
			s.elements["sign-in-submit"].props.variant = "blue";
			return s;
		})(),
	],
	[
		"a part outside the catalog",
		(() => {
			const s = clone();
			s.elements.rule.type = "Card";
			return s;
		})(),
	],
	[
		"a gap off the spacing scale",
		(() => {
			const s = clone();
			s.elements.column.props.gap = 30;
			return s;
		})(),
	],
	[
		"a prop the part does not take",
		(() => {
			const s = clone();
			s.elements.site.props.className = "my-own-look";
			return s;
		})(),
	],
];
for (const [name, spec] of cases) {
	const problems = checkSpec(spec);
	console.log(`${problems.length === 0 ? "PASS" : "FAIL"}  ${name}${problems.length === 0 ? "" : `: ${problems[0]}`}`);
}
