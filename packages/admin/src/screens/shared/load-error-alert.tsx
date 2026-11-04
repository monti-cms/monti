import { useTranslator } from "@monti-cms/core/site";
import { Banner, Button } from "@monti-cms/ui";
import { commonMessages } from "../../lib/common.messages";

/** The one load-failure notice of a screen: what went wrong, and a retry beside it. A notice strip, so it runs the width of the pane it is put in. */
export function LoadErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
	const t = useTranslator(commonMessages);
	return (
		<Banner role="alert" tone="danger" title={message}>
			{onRetry && (
				<Button variant="ghost" size="sm" type="button" onClick={onRetry}>
					{t("retry")}
				</Button>
			)}
		</Banner>
	);
}
