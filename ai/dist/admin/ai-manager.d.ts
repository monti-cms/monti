/**
 * Admin AI screen. The Actions tab lists actions defined in code and actions created in the screen; for each action you edit enabled, ask-for-request,
 * connection, model, content to send, instructions and checks, then test before saving. The Connections tab stores several service URLs, keys and default models.
 * The Shared texts tab edits and adds the text that goes into `{{shared.key}}` in instructions. All three tabs are a list + a detail pane.
 * Opening another item or tab with unsaved content asks whether to discard it.
 */
export declare function AiManager(): import("react").JSX.Element;
