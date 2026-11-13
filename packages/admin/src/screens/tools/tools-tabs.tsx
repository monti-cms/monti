import { PageToolbar, TabLink, TabLinks } from "@monti-cms/ui";
import { useAdmin } from "../../operations/admin-context";
import { linkTo, type Route } from "../../route";
import { useFocusHandOff } from "../frame/focus-hand-off";

/**
 * The tools' tab row (tools.md, the tools frame): one tab is one page, and each is a link with its own address.
 *
 * A tab pressed with the keyboard opens another page, which draws this row anew: the focus the pressed tab held goes to the same tab in the
 * new row, now the open one, as on a page whose tab row stays (settings). Decided while building, 2026-11-13.
 */
export function ToolsTabs({ current, go }: { current: "templates" | "keys"; go: (route: Route) => void }) {
	const { t } = useAdmin();
	const handOff = useFocusHandOff(
		() => () =>
			// A frame on: the page that takes this one's place draws its row with it.
			requestAnimationFrame(() => {
				if (document.activeElement !== document.body) return;
				document.querySelector<HTMLElement>('[data-slot=tab-links] [aria-current="page"]')?.focus();
			}),
	);
	return (
		<PageToolbar inset>
			<TabLinks ref={handOff} variant="toolbar">
				<TabLink current={current === "templates"} {...linkTo({ screen: "place", place: "tools" }, go)}>
					{t("tools.templates")}
				</TabLink>
				<TabLink current={current === "keys"} {...linkTo({ screen: "place", place: "tools", tab: "keys" }, go)}>
					{t("tools.keys")}
				</TabLink>
			</TabLinks>
		</PageToolbar>
	);
}
