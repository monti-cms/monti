import { translate } from "@monti-cms/core";
import type { DocumentComponentsContext, LooseDocumentComponents, MarkBlockProps } from "@monti-cms/core/render";
import type { PropsWithChildren } from "react";
import type { codeRefBlock } from "./definition";
import { codeRefMessages } from "./messages";
import { CodeRef } from "./render.client";

export { CodeRef };

type CodeRefProps = PropsWithChildren<{ to: string }>;

const labelsFor = (locale?: string) => {
	const language = (locale ?? "").toLowerCase().split(/[-_]/)[0] ?? "";
	return { back: translate(codeRefMessages, language, "back") };
};

/** Public component for code-ref (called by `@monti-cms/core/render`). Code line highlighting happens in the browser (client component). */
export default ({ locale }: { locale?: string }) => {
	const labels = labelsFor(locale);
	return { CodeRef: (props: CodeRefProps) => <CodeRef {...props} labels={labels} /> };
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
