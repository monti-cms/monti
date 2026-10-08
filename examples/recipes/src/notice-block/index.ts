import { definePlugin } from "@monti-cms/core";
import { noticeBlock } from "./definition";

export { noticeBlock } from "./definition";

/**
 * The notice block as a plugin: `plugins: [notice()]`. The three loaders are read only where they are used: the admin loads `admin` (the
 * editor view), the public page `render` (the component), and neither reaches the other's bundle.
 */
export const notice = () =>
	definePlugin({
		name: "notice",
		options: {},
		blocks: [noticeBlock],
		admin: () => import("./admin"),
		render: () => import("./render"),
	});
