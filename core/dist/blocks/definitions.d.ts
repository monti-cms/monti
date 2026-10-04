export declare const textAlign: {
    readonly name: "text-align";
    readonly syntax: {
        readonly kind: "container";
        readonly directive: "text-align";
    };
    readonly component: "TextAlign";
    readonly attributes: {
        align: {
            readonly type: "string";
            readonly required: true;
            readonly options: {
                readonly left: string;
                readonly center: string;
                readonly right: string;
            };
        } & {
            readonly label: string;
        };
    };
    readonly translateInside: true;
    readonly editor: {
        readonly view: "attribute";
    };
} & {
    readonly label: string;
};
export declare const image: {
    readonly name: "image";
    readonly syntax: {
        readonly kind: "leaf";
        readonly directive: "image";
    };
    readonly component: "Image";
    readonly attributes: {
        mediaId: {
            readonly type: "string";
        } & {
            readonly description: string;
            readonly label: string;
        };
        src: {
            readonly type: "string";
        } & {
            readonly label: string;
        };
        alt: {
            readonly type: "string";
            readonly translatable: true;
        } & {
            readonly description: string;
            readonly label: string;
        };
        width: {
            readonly type: "string";
        } & {
            readonly description: string;
            readonly label: string;
        };
        align: {
            readonly type: "string";
            readonly options: {
                readonly left: string;
                readonly center: string;
                readonly right: string;
            };
        } & {
            readonly label: string;
        };
        caption: {
            readonly type: "string";
            readonly translatable: true;
        } & {
            readonly label: string;
        };
        decorative: {
            readonly type: "boolean";
            readonly defaultValue: false;
        } & {
            readonly label: string;
        };
        crop: {
            readonly type: "string";
        } & {
            readonly description: string;
            readonly label: string;
        };
        rotate: {
            readonly type: "string";
            readonly options: {
                readonly "0": "0°";
                readonly "90": "90°";
                readonly "180": "180°";
                readonly "270": "270°";
            };
        } & {
            readonly description: string;
            readonly label: string;
        };
        title: {
            readonly type: "string";
            readonly translatable: true;
        } & {
            readonly description: string;
            readonly label: string;
        };
    };
    readonly editor: {
        readonly view: "node";
        readonly nodeView: "image";
        readonly insertable: true;
        readonly keywords: string[];
    };
} & {
    readonly label: string;
};
/**
 * Attachment file card (`::file{mediaId="…" label="report.pdf"}`). The public view shows the name, size, type, and a download link.
 * If `label` is empty, the uploaded file name is used.
 */
export declare const file: {
    readonly name: "file";
    readonly syntax: {
        readonly kind: "leaf";
        readonly directive: "file";
    };
    readonly component: "File";
    readonly attributes: {
        mediaId: {
            readonly type: "string";
            readonly required: true;
        } & {
            readonly label: string;
        };
        label: {
            readonly type: "string";
            readonly translatable: true;
        } & {
            readonly label: string;
        };
    };
    readonly editor: {
        readonly view: "node";
        readonly nodeView: "file";
        readonly insertable: false;
        readonly keywords: string[];
    };
} & {
    readonly label: string;
};
/**
 * Untranslated notice text (`:untranslated[source text]`). A new translation wraps the source text with this marker. The editor shows it dimmed
 * and removes it when something is typed in that block. It is not shown in the public view, and the pre-publish check reports it if it remains.
 */
export declare const untranslated: {
    readonly name: "untranslated";
    readonly syntax: {
        readonly kind: "text";
        readonly directive: "untranslated";
    };
    readonly component: "Untranslated";
    readonly attributes: {};
    readonly editor: {
        readonly view: "mark";
    };
} & {
    readonly label: string;
};
export declare const underline: {
    readonly name: "br" | "sub" | "sup" | "u";
    readonly syntax: {
        readonly kind: "text";
        readonly directive: "br" | "sub" | "sup" | "u";
    };
    readonly component: "br" | "sub" | "sup" | "u";
    readonly attributes: {};
    readonly editor: {
        readonly view: "mark";
    };
} & {
    readonly label: string;
};
export declare const superscript: {
    readonly name: "br" | "sub" | "sup" | "u";
    readonly syntax: {
        readonly kind: "text";
        readonly directive: "br" | "sub" | "sup" | "u";
    };
    readonly component: "br" | "sub" | "sup" | "u";
    readonly attributes: {};
    readonly editor: {
        readonly view: "mark";
    };
} & {
    readonly label: string;
};
export declare const subscript: {
    readonly name: "br" | "sub" | "sup" | "u";
    readonly syntax: {
        readonly kind: "text";
        readonly directive: "br" | "sub" | "sup" | "u";
    };
    readonly component: "br" | "sub" | "sup" | "u";
    readonly attributes: {};
    readonly editor: {
        readonly view: "mark";
    };
} & {
    readonly label: string;
};
export declare const lineBreak: {
    readonly name: "br" | "sub" | "sup" | "u";
    readonly syntax: {
        readonly kind: "text";
        readonly directive: "br" | "sub" | "sup" | "u";
    };
    readonly component: "br" | "sub" | "sup" | "u";
    readonly attributes: {};
    readonly editor: {
        readonly view: "mark";
    };
} & {
    readonly label: string;
};
export declare const math: {
    readonly name: "math";
    readonly syntax: {
        readonly kind: "math";
    };
    readonly component: "Math";
    readonly renderedBy: "rehype-katex";
    readonly attributes: {};
    readonly editor: {
        readonly view: "node";
        readonly nodeView: "math";
        readonly insertable: true;
        readonly keywords: string[];
        readonly icon: "sigma";
    };
} & {
    readonly description: string;
    readonly label: string;
};
export declare const table: {
    readonly name: "table";
    readonly syntax: {
        readonly kind: "container";
        readonly directive: "table";
    };
    readonly component: "Table";
    readonly attributes: {
        align: {
            readonly type: "string";
        } & {
            readonly description: string;
            readonly label: string;
        };
        widths: {
            readonly type: "string";
        } & {
            readonly description: string;
            readonly label: string;
        };
    };
    readonly children: {
        readonly blocks: readonly ["row"];
        readonly min: 1;
    };
    readonly editor: {
        readonly view: "opaque";
        readonly insertable: false;
        readonly keywords: string[];
    };
} & {
    readonly description: string;
    readonly label: string;
};
export declare const row: {
    readonly name: "row";
    readonly syntax: {
        readonly kind: "container";
        readonly directive: "row";
    };
    readonly component: "TableRow";
    readonly attributes: {};
    readonly children: {
        readonly blocks: readonly ["cell"];
        readonly min: 1;
    };
    readonly parent: "table";
    readonly editor: {
        readonly view: "opaque";
    };
} & {
    readonly label: string;
};
export declare const cell: {
    readonly name: "cell";
    readonly syntax: {
        readonly kind: "leaf";
        readonly directive: "cell";
    };
    readonly component: "TableCell";
    readonly attributes: {
        colspan: {
            readonly type: "string";
        } & {
            readonly label: string;
        };
        rowspan: {
            readonly type: "string";
        } & {
            readonly label: string;
        };
        header: {
            readonly type: "boolean";
            readonly defaultValue: false;
        } & {
            readonly label: string;
        };
    };
    readonly parent: "row";
    readonly editor: {
        readonly view: "opaque";
    };
} & {
    readonly label: string;
};
/** Core blocks. Declaration order is the order in `/meta` and the docs. The blocks the site uses are `BLOCKS` in `blocks/active.ts`. */
export declare const BUILTIN_BLOCKS: readonly [{
    readonly name: "text-align";
    readonly syntax: {
        readonly kind: "container";
        readonly directive: "text-align";
    };
    readonly component: "TextAlign";
    readonly attributes: {
        align: {
            readonly type: "string";
            readonly required: true;
            readonly options: {
                readonly left: string;
                readonly center: string;
                readonly right: string;
            };
        } & {
            readonly label: string;
        };
    };
    readonly translateInside: true;
    readonly editor: {
        readonly view: "attribute";
    };
} & {
    readonly label: string;
}, {
    readonly name: "image";
    readonly syntax: {
        readonly kind: "leaf";
        readonly directive: "image";
    };
    readonly component: "Image";
    readonly attributes: {
        mediaId: {
            readonly type: "string";
        } & {
            readonly description: string;
            readonly label: string;
        };
        src: {
            readonly type: "string";
        } & {
            readonly label: string;
        };
        alt: {
            readonly type: "string";
            readonly translatable: true;
        } & {
            readonly description: string;
            readonly label: string;
        };
        width: {
            readonly type: "string";
        } & {
            readonly description: string;
            readonly label: string;
        };
        align: {
            readonly type: "string";
            readonly options: {
                readonly left: string;
                readonly center: string;
                readonly right: string;
            };
        } & {
            readonly label: string;
        };
        caption: {
            readonly type: "string";
            readonly translatable: true;
        } & {
            readonly label: string;
        };
        decorative: {
            readonly type: "boolean";
            readonly defaultValue: false;
        } & {
            readonly label: string;
        };
        crop: {
            readonly type: "string";
        } & {
            readonly description: string;
            readonly label: string;
        };
        rotate: {
            readonly type: "string";
            readonly options: {
                readonly "0": "0°";
                readonly "90": "90°";
                readonly "180": "180°";
                readonly "270": "270°";
            };
        } & {
            readonly description: string;
            readonly label: string;
        };
        title: {
            readonly type: "string";
            readonly translatable: true;
        } & {
            readonly description: string;
            readonly label: string;
        };
    };
    readonly editor: {
        readonly view: "node";
        readonly nodeView: "image";
        readonly insertable: true;
        readonly keywords: string[];
    };
} & {
    readonly label: string;
}, {
    readonly name: "file";
    readonly syntax: {
        readonly kind: "leaf";
        readonly directive: "file";
    };
    readonly component: "File";
    readonly attributes: {
        mediaId: {
            readonly type: "string";
            readonly required: true;
        } & {
            readonly label: string;
        };
        label: {
            readonly type: "string";
            readonly translatable: true;
        } & {
            readonly label: string;
        };
    };
    readonly editor: {
        readonly view: "node";
        readonly nodeView: "file";
        readonly insertable: false;
        readonly keywords: string[];
    };
} & {
    readonly label: string;
}, {
    readonly name: "untranslated";
    readonly syntax: {
        readonly kind: "text";
        readonly directive: "untranslated";
    };
    readonly component: "Untranslated";
    readonly attributes: {};
    readonly editor: {
        readonly view: "mark";
    };
} & {
    readonly label: string;
}, {
    readonly name: "br" | "sub" | "sup" | "u";
    readonly syntax: {
        readonly kind: "text";
        readonly directive: "br" | "sub" | "sup" | "u";
    };
    readonly component: "br" | "sub" | "sup" | "u";
    readonly attributes: {};
    readonly editor: {
        readonly view: "mark";
    };
} & {
    readonly label: string;
}, {
    readonly name: "br" | "sub" | "sup" | "u";
    readonly syntax: {
        readonly kind: "text";
        readonly directive: "br" | "sub" | "sup" | "u";
    };
    readonly component: "br" | "sub" | "sup" | "u";
    readonly attributes: {};
    readonly editor: {
        readonly view: "mark";
    };
} & {
    readonly label: string;
}, {
    readonly name: "br" | "sub" | "sup" | "u";
    readonly syntax: {
        readonly kind: "text";
        readonly directive: "br" | "sub" | "sup" | "u";
    };
    readonly component: "br" | "sub" | "sup" | "u";
    readonly attributes: {};
    readonly editor: {
        readonly view: "mark";
    };
} & {
    readonly label: string;
}, {
    readonly name: "br" | "sub" | "sup" | "u";
    readonly syntax: {
        readonly kind: "text";
        readonly directive: "br" | "sub" | "sup" | "u";
    };
    readonly component: "br" | "sub" | "sup" | "u";
    readonly attributes: {};
    readonly editor: {
        readonly view: "mark";
    };
} & {
    readonly label: string;
}, {
    readonly name: "math";
    readonly syntax: {
        readonly kind: "math";
    };
    readonly component: "Math";
    readonly renderedBy: "rehype-katex";
    readonly attributes: {};
    readonly editor: {
        readonly view: "node";
        readonly nodeView: "math";
        readonly insertable: true;
        readonly keywords: string[];
        readonly icon: "sigma";
    };
} & {
    readonly description: string;
    readonly label: string;
}, {
    readonly name: "table";
    readonly syntax: {
        readonly kind: "container";
        readonly directive: "table";
    };
    readonly component: "Table";
    readonly attributes: {
        align: {
            readonly type: "string";
        } & {
            readonly description: string;
            readonly label: string;
        };
        widths: {
            readonly type: "string";
        } & {
            readonly description: string;
            readonly label: string;
        };
    };
    readonly children: {
        readonly blocks: readonly ["row"];
        readonly min: 1;
    };
    readonly editor: {
        readonly view: "opaque";
        readonly insertable: false;
        readonly keywords: string[];
    };
} & {
    readonly description: string;
    readonly label: string;
}, {
    readonly name: "row";
    readonly syntax: {
        readonly kind: "container";
        readonly directive: "row";
    };
    readonly component: "TableRow";
    readonly attributes: {};
    readonly children: {
        readonly blocks: readonly ["cell"];
        readonly min: 1;
    };
    readonly parent: "table";
    readonly editor: {
        readonly view: "opaque";
    };
} & {
    readonly label: string;
}, {
    readonly name: "cell";
    readonly syntax: {
        readonly kind: "leaf";
        readonly directive: "cell";
    };
    readonly component: "TableCell";
    readonly attributes: {
        colspan: {
            readonly type: "string";
        } & {
            readonly label: string;
        };
        rowspan: {
            readonly type: "string";
        } & {
            readonly label: string;
        };
        header: {
            readonly type: "boolean";
            readonly defaultValue: false;
        } & {
            readonly label: string;
        };
    };
    readonly parent: "row";
    readonly editor: {
        readonly view: "opaque";
    };
} & {
    readonly label: string;
}];
