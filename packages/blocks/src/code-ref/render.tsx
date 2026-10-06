import { translate } from "@monti-cms/core";
import type { DocumentComponentsContext, LooseDocumentComponents, MarkBlockProps } from "@monti-cms/core/render";
import type { PropsWithChildren } from "react";
import type { codeRefBlock } from "./definition";
import { codeRefMessages } from "./messages";
import { CodeRef } from "./render.client";

export { CodeRef };

const labelsFor = (locale?: string) => {
	const language = (locale ?? "").toLowerCase().split(/[-_]/)[0] ?? "";
	return { back: translate(codeRefMessages, language, "back") };
};

/** Public components for code-ref in the JSON renderer (`renderDocument`): the mark `code-ref`. */
export const documentComponents = ({ locale }: DocumentComponentsContext): LooseDocumentComponents => {
	const labels = labelsFor(locale);
	return {
		marks: {
			"code-ref": ({ to, children }: MarkBlockProps<typeof codeRefBlock>) => (
				<CodeRef to={to} labels={labels}>
					{children}
				</CodeRef>
			),
		},
	};
};
