import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { AssistantScreen } from "./assistant";
import { AssistantFirstScreen } from "./assistant-first";
import { AssistantPanelScreen, AssistantWorkingScreen } from "./assistant-panel";
import { AssistantStateScreen, type AssistantView } from "./assistant-states";
import { CollectionBasicsScreen } from "./collection-basics";
import { CollectionEditorScreen } from "./collection-editor";
import { ProposalReviewScreen, ProposalReviewView } from "./proposal-review";
import { ProposalReviewSideScreen } from "./proposal-review-side";
import { ProposalReviewTranslateScreen } from "./proposal-review-translate";

// The design reference screens of the assistant and the collection settings, drawn with the design system's parts only.
const meta = { title: "Screens/Reference/Assistant", parameters: { layout: "fullscreen", bleed: true } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Assistant: Story = { render: () => <AssistantScreen /> };
/** The list as the assistant filtered it (flow 2, step 3): its filter is blue. */
export const AssistantListFiltered: Story = { render: () => <AssistantScreen mode="filtered" /> };
/** The rows the assistant picked (step 10): blue checks, and the bar's "✦ 요청" puts them in the panel's box. */
export const AssistantListPicked: Story = { render: () => <AssistantScreen mode="picked" /> };
export const AssistantFirst: Story = { render: () => <AssistantFirstScreen /> };
export const AssistantPanel: Story = { render: () => <AssistantPanelScreen /> };
export const AssistantWorking: Story = { render: () => <AssistantWorkingScreen /> };
/** One state of the panel, by the name flow 2 gives it. */
const state = (view: AssistantView): Story => ({ render: () => <AssistantStateScreen view={view} /> });

// Flow 2, in its order; then what the run engine adds.
export const AssistantAsking = state("asking");
export const AssistantWriting = state("writing");
export const AssistantFiltered = state("filtered");
export const AssistantOpened = state("opened");
export const AssistantBlocked = state("blocked");
export const AssistantDropped = state("dropped");
export const AssistantRequestInEntry = state("requestInEntry");
export const AssistantOnEntry = state("onEntry");
export const AssistantDelegate = state("delegate");
export const AssistantCard = state("card");
export const AssistantCardApplying = state("cardApplying");
export const AssistantApplied = state("applied");
export const AssistantReverted = state("reverted");
export const AssistantDiscarded = state("discarded");
export const AssistantAltText = state("altText");
export const AssistantSettings = state("settings");
export const AssistantNoKey = state("noKey");
export const AssistantModels = state("models");
/** The thinking levels, opened at the side of the model menu. */
export const AssistantThinking: Story = {
	...state("models"),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement.ownerDocument.body);
		await userEvent.click(await page.findByRole("menuitem", { name: /생각/ }));
		await page.findByRole("menuitemradio", { name: "높음" });
	},
};
export const AssistantThinkingHigh = state("thinkingHigh");
export const AssistantNoThinking = state("noThinking");
export const AssistantRefused = state("refused");
export const AssistantHistory = state("history");
export const AssistantHistoryEmpty = state("historyEmpty");
export const AssistantReopened = state("reopened");
export const AssistantStopped = state("stopped");
export const AssistantLimit = state("limit");
export const AssistantNoAnswer = state("noAnswer");
export const AssistantToolFailed = state("toolFailed");
export const AssistantToolOpen = state("toolOpen");

export const ProposalReview: Story = { render: () => <ProposalReviewScreen /> };
export const ProposalReviewSide: Story = { render: () => <ProposalReviewSideScreen /> };
export const ProposalReviewApplying: Story = { render: () => <ProposalReviewView stage="applying" /> };
export const ProposalReviewResult: Story = { render: () => <ProposalReviewView stage="result" /> };
/** An apply that was cut off: what is done stays done, and the rest can be applied. */
export const ProposalReviewCut: Story = { render: () => <ProposalReviewView stage="cut" /> };
export const ProposalReviewReverted: Story = { render: () => <ProposalReviewView stage="reverted" /> };
/** One item being made again for the post as it is now. */
export const ProposalReviewRemaking: Story = { render: () => <ProposalReviewView stage="remaking" /> };
export const ProposalReviewTranslate: Story = { render: () => <ProposalReviewTranslateScreen /> };
export const CollectionBasics: Story = { render: () => <CollectionBasicsScreen /> };
export const CollectionEditor: Story = { render: () => <CollectionEditorScreen /> };
