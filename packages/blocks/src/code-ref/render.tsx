import { translate } from "@monti-cms/core";
import type { PropsWithChildren } from "react";
import { codeRefMessages } from "./messages";
import { CodeRef } from "./render.client";

export { CodeRef };

type CodeRefProps = PropsWithChildren<{ to: string }>;

/** Public component for code-ref (called by `@monti-cms/core/render`). Code line highlighting happens in the browser (client component). */
export default ({ locale }: { locale?: string }) => {
	const language = (locale ?? "").toLowerCase().split(/[-_]/)[0] ?? "";
	const labels = { back: translate(codeRefMessages, language, "back") };
	return { CodeRef: (props: CodeRefProps) => <CodeRef {...props} labels={labels} /> };
};
