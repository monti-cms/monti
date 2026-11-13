import { defineMark, z } from "@monti-cms/core";
import { COLORS, ColorMark } from "./site";

const names = {
	gray: { ko: "회색", en: "Gray" },
	red: { ko: "빨강", en: "Red" },
	orange: { ko: "주황", en: "Orange" },
	yellow: { ko: "노랑", en: "Yellow" },
	green: { ko: "초록", en: "Green" },
	blue: { ko: "파랑", en: "Blue" },
	purple: { ko: "보라", en: "Purple" },
	pink: { ko: "분홍", en: "Pink" },
};

/** Text colour and background colour by name (`:color[words]{color="red"}`, doc 18). The site gives each name its light and dark shade. */
export const color = defineMark({
	type: "color",
	label: { ko: "글자 색", en: "Text colour" },
	description: `Words in a colour (\`color\`) or on one (\`background\`), each one of: ${COLORS.join(", ")}.`,
	attrs: z
		.object({ color: z.enum(COLORS).optional(), background: z.enum(COLORS).optional() })
		.refine((value) => value.color !== undefined || value.background !== undefined, "A colour or a background"),
	fields: {
		color: { label: { ko: "글자 색", en: "Text colour" }, input: "choice", options: names },
		background: { label: { ko: "바탕색", en: "Background" }, input: "choice", options: names },
	},
	Site: ColorMark,
});
