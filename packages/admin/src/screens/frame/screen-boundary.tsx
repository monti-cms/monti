import { Banner, EditorHeader, Inline, PageBanner, StandalonePage, TextButton } from "@monti-cms/ui";
import { Component, type ReactNode } from "react";
import { useAdmin } from "../../operations/admin-context";

/** The banner of a screen that could not be drawn, in the words of a screen that could not be read, with the way to draw it again. */
function ScreenFailed({ onAgain }: { onAgain: () => void }) {
	const { t } = useAdmin();
	return (
		<Banner tone="danger" title={t("frame.readFailed")} plainMeta>
			<TextButton onClick={onAgain}>{t("frame.readAgain")}</TextButton>
		</Banner>
	);
}

type Props = {
	/** The address of the screen inside: another address is another screen, drawn anew. */
	at: string;
	/**
	 * A screen outside the sidebar's frame (an editor) has no sidebar to leave by: the banner stands at the top of a page of its own, over a
	 * head that holds this, the editor's own way back to its list.
	 */
	back?: ReactNode;
	children: ReactNode;
};

type State = { failed: boolean; at: string };

/**
 * Around the screen an address opens: a screen that throws while it is drawn takes only itself down. In its place the banner at the screen's
 * top says so ("try again" draws it once more), and what is around it stays as it was: the sidebar, the banners of the frame, the assistant.
 * Moving to another screen draws that screen. An editor stands outside the frame: its place keeps the head with the way back to its list.
 */
export class ScreenBoundary extends Component<Props, State> {
	state: State = { failed: false, at: this.props.at };

	static getDerivedStateFromError(): Partial<State> {
		return { failed: true };
	}

	// Only the screen that failed is kept away: at another address the screen under it is drawn at once.
	static getDerivedStateFromProps(props: Props, state: State): State | null {
		return props.at === state.at ? null : { failed: false, at: props.at };
	}

	render() {
		if (!this.state.failed) return this.props.children;
		const again = () => this.setState({ failed: false });
		return this.props.back ? (
			<StandalonePage banner={<ScreenFailed onAgain={again} />}>
				<EditorHeader>
					<Inline gap={12} minWidth={0} paddingX={12}>
						{this.props.back}
					</Inline>
				</EditorHeader>
			</StandalonePage>
		) : (
			<PageBanner>
				<ScreenFailed onAgain={again} />
			</PageBanner>
		);
	}
}
