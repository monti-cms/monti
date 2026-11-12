import { PageToolbar, TabLink, TabLinks } from "@monti-cms/ui";
import { useAdmin } from "../../operations/admin-context";
import { linkTo, type Route } from "../../route";

/** The tools' tab row (tools.md, the tools frame): one tab is one page, and each is a link with its own address. */
export function ToolsTabs({ current, go }: { current: "templates" | "keys"; go: (route: Route) => void }) {
	const { t } = useAdmin();
	return (
		<PageToolbar inset>
			<TabLinks variant="toolbar">
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
