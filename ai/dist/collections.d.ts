/** Collections of the AI plugin's storage (`cms.storage("ai")`). The names are the ones the tables had before the plugin used the storage API. */
export declare const AI_COLLECTIONS: {
    /** Edited values of AI actions. Definitions live in the site config; only values edited in the admin are stored per action name. */
    readonly actionOverrides: "action-overrides";
    /** Actions made in the admin AI screen. The value holds the basic info and the edited values. */
    readonly customActions: "custom-actions";
    /** AI service connections (address, encrypted key, model): one item, `default`. The edited shared texts are the `shared` item. */
    readonly settings: "settings";
};
