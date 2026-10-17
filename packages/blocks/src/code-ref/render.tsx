import { translate } from "@monti-cms/core";
import { defineRender, type MarkBlockProps } from "@monti-cms/core/render";
import type { codeRefBlock } from "./definition";
import { codeRefMessages } from "./messages";
import { CodeRef } from "./render.client";

export { CodeRef };

const labelsFor = (locale?: string) => {
	const language = (locale ?? "").toLowerCase().split(/[-_]/)[0] ?? "";
	return { back: translate(codeRefMessages, language, "back") };
};

/** Public components for code-ref in the JSON renderer (`renderDocument`): the mark `code-ref`. */
export default defineRender({
	marks: {
		"code-ref": ({ to, children, ctx }: MarkBlockProps<typeof codeRefBlock>) => (
			<CodeRef to={to} labels={labelsFor(ctx.locale)}>
				{children}
			</CodeRef>
		),
	},
});
