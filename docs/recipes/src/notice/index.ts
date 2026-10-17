import { definePlugin } from "@monti-cms/core";
import { noticeBlock } from "./block";

export const notice = () =>
	definePlugin({
		name: "notice",
		blocks: [noticeBlock],
		admin: () => import("./admin"),
		render: () => import("./render"),
	});
