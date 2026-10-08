/** Chart (` ```chart `). The chart syntax is read by `parseChartDsl`, and its errors are warnings on save and publish (`validate`). The editor preview comes from the extension (a site can replace it); the public page is rendered by the site. */
export declare const chartBlock: {
    readonly name: "chart";
    readonly label: string;
    readonly description: string;
    readonly syntax: {
        readonly kind: "fence";
        readonly lang: "chart";
    };
    readonly component: "Chart";
    readonly attributes: {};
    readonly validate: import("@monti-cms/core").BlockValidate;
    readonly editor: {
        readonly view: "node";
        readonly insertable: true;
        readonly keywords: string[];
        readonly icon: "chart-column";
        readonly placeholder: string;
        readonly insert: {
            code: string;
        };
    };
};
