import {
	Banner,
	EditorHeader,
	Inline,
	PageBanner,
	PageColumn,
	PageHeader,
	StandalonePage,
	TextButton,
} from "@monti-cms/ui";
import { Component, type ReactNode } from "react";
import { labelOfCollection } from "../../format/names";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";
import type { SchemaRead } from "../settings/schema-draft";
import type { Place } from "./admin-frame";
import { firstStop, nextStop, useFocusHandOff } from "./focus-hand-off";

/** The banner of a screen that could not be drawn, in the words of a screen that could not be read, with the way to draw it again. */
function ScreenFailed({ onAgain }: { onAgain: () => void }) {
	const { t } = useAdmin();
	// "Try again" goes with the banner once the screen is drawn: the keyboard's focus it held goes on to the screen, not to the page.
	const handOff = useFocusHandOff((banner) => nextStop(banner) ?? firstStop());
	return (
		<Banner ref={handOff} tone="danger" title={t("frame.readFailed")} plainMeta>
			<TextButton onClick={onAgain}>{t("frame.readAgain")}</TextButton>
		</Banner>
	);
}

/** What a screen of the frame is called where it cannot draw itself: the name its sidebar row has (the site's own name for a page with no row). */
function ScreenName({ place }: { place: Place | null }) {
	const { t, siteName } = useAdmin();
	const schema = useRead<SchemaRead>("schema.read");
	if (place === null) return siteName;
	if (typeof place === "object") return labelOfCollection(schema.data?.adminValues, place.collection);
	return t(`frame.${place}`);
}

type Props = {
	/** The address of the screen inside: another address is another screen, drawn anew. */
	at: string;
	/**
	 * A screen outside the sidebar's frame (an editor) has no sidebar to leave by: the banner stands at the top of a page of its own, over a
	 * head that holds this, the editor's own way back to its list.
	 */
	back?: ReactNode;
	/** The gap of that head's start, as the editor's own head has it. */
	backGap?: 12 | 16;
	/** A screen of the frame: the sidebar row it belongs to, whose name heads the page that stands in its place (null where it has no row). */
	place?: Place | null;
	children: ReactNode;
};

type State = { failed: boolean; at: string };

/**
 * Around the screen an address opens: a screen that throws while it is drawn takes only itself down. In its place the banner at the screen's
 * top says so ("try again" draws it once more), and what is around it stays as it was: the sidebar, the banners of the frame, the assistant.
 * Moving to another screen draws that screen. A screen of the frame keeps a head row with its name, so the ✦ stays where it always is; an editor stands
 * outside the frame: its place keeps the head with the way back to its list.
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
					<Inline gap={this.props.backGap ?? 12} minWidth={0} paddingX={12}>
						{this.props.back}
					</Inline>
				</EditorHeader>
			</StandalonePage>
		) : (
			<>
				<PageBanner>
					<ScreenFailed onAgain={again} />
				</PageBanner>
				<PageColumn>
					<PageHeader title={<ScreenName place={this.props.place ?? null} />} />
				</PageColumn>
			</>
		);
	}
}
