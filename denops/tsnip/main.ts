import { toFileUrl } from "https://deno.land/std@0.120.0/path/mod.ts";
import type { Denops } from "https://deno.land/x/denops_std@v2.4.0/mod.ts";
import * as variable from "https://deno.land/x/denops_std@v2.4.0/variable/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v2.4.0/helper/mod.ts";
import * as op from "https://deno.land/x/denops_std@v2.4.0/option/mod.ts";
import { ensureString } from "https://deno.land/x/unknownutil@v1.1.4/mod.ts";

import { Inputs, Snippet } from "./types.ts";

type Pos = {
  line: number;
  col: number;
};

let namespace: number;
let pos: Pos;
let bufnr: number;
let snippet: Snippet;
let inputs: Inputs;
let paramIndex: number;
let lastExtMarkId: number;
let fileName: string;
let currentLine: string;
let modules: { [fileType: string]: { [name: string]: Snippet } } = {};

const snippetRender = (snippet: Snippet, inputs: Inputs) => {
  return snippet.render(inputs, {
    fileName: {
      text: fileName,
    },
  }).replace(/^\n/, "");
};

const renderPreview = async (
  denops: Denops,
  inputs: Inputs,
): Promise<void> => {
  let lines = snippetRender(snippet, inputs).split("\n");
  lines = [`${currentLine}${lines[0]}`, ...lines.slice(1)];

  lastExtMarkId = await denops.call(
    "nvim_buf_set_extmark",
    bufnr,
    namespace,
    pos.line - 1,
    pos.col - 1,
    {
      virt_lines: [
        [["", "Comment"]],
        [["", "Comment"]],
        ...lines.map((line) => [[line !== "" ? line : " ", "Comment"]]),
      ],
    },
  ) as number;
};

const deletePreview = async (denops: Denops) => {
  await denops.call("nvim_buf_del_extmark", bufnr, namespace, lastExtMarkId);
};

const insertSnippet = async (denops: Denops) => {
  await denops.cmd("redraw");
  await denops.call("appendbufline", bufnr, pos.line - 1, [
    `${currentLine}${snippetRender(snippet, inputs).split("\n")[0]}`,
    ...snippetRender(snippet, inputs).split("\n").slice(1),
  ]);
};

export const main = async (denops: Denops): Promise<void> => {
  namespace = await denops.call(
    "nvim_create_namespace",
    "tsnip",
  ) as number;

  const path = await variable.g.get<string>(denops, "tsnip_snippet_dir");

  await helper.execute(
    denops,
    `
    command! -nargs=1 TSnip call denops#request("${denops.name}", "execute", [<f-args>])
    `,
  );

  denops.dispatcher = {
    execute: async (snippetName: unknown): Promise<void> => {
      ensureString(snippetName);

      const ft = await op.filetype.get(denops);
      if (modules[ft] == null) {
        modules = {
          ...modules,
          [ft]: await import(toFileUrl(`${path}/${ft}.ts`).href),
        };
      }

      snippet = modules[ft][snippetName];
      bufnr = await denops.call("bufnr") as number;
      const p = await denops.call("getpos", ".") as [
        number,
        number,
        number,
        number,
      ];
      pos = { line: p[1], col: p[2] };
      inputs = {};
      paramIndex = 0;
      fileName = await denops.call("expand", "%:t") as string;
      currentLine = await denops.call("getline", ".") as string;

      if (snippet.params.length > 0) {
        await denops.cmd(
          `lua require('${denops.name}').input('${
            snippet.params[paramIndex].name
          }')`,
        );

        await renderPreview(denops, {});
      } else {
        await insertSnippet(denops);
      }
    },
    submit: async (name: unknown, input: unknown): Promise<void> => {
      ensureString(name);
      ensureString(input);

      if (lastExtMarkId != null) {
        await deletePreview(denops);
      }

      const param = snippet.params[paramIndex];
      if (param.type === "single_line") {
        inputs = {
          ...inputs,
          [name]: { text: input === "" ? undefined : input },
        };

        await renderPreview(denops, inputs);
        paramIndex += 1;
      } else if (param.type === "multi_line") {
        if (input === "") {
          paramIndex += 1;
        } else {
          inputs = {
            ...inputs,
            [name]: {
              text: inputs[name]?.text == null
                ? input
                : `${inputs[name]?.text}\n${input}`,
            },
          };
        }

        await renderPreview(denops, inputs);
      }

      if (snippet.params.length > paramIndex) {
        await denops.cmd(
          `lua require('${denops.name}').input('${
            snippet.params[paramIndex].name
          }')`,
        );
      } else {
        await deletePreview(denops);
        await insertSnippet(denops);
      }
    },
    changed: async (name: unknown, input: unknown): Promise<void> => {
      ensureString(name);
      ensureString(input);

      if (lastExtMarkId != null) {
        await deletePreview(denops);
      }

      const param = snippet.params[paramIndex];
      if (param.type === "single_line") {
        await renderPreview(denops, {
          ...inputs,
          [name]: { text: input },
        });
      } else if (param.type === "multi_line") {
        await renderPreview(denops, {
          ...inputs,
          [name]: {
            text: inputs[name]?.text == null
              ? input
              : `${inputs[name]?.text}\n${input}`,
          },
        });
      }
    },
    close: async (): Promise<void> => {
      if (lastExtMarkId != null) {
        await deletePreview(denops);
      }
    },
    items: async (): Promise<Array<{ word: string; info: string }>> => {
      try {
        const ft = await op.filetype.get(denops);
        if (modules[ft] == null) {
          modules = {
            ...modules,
            [ft]: await import(toFileUrl(`${path}/${ft}.ts`).href),
          };
        }

        fileName = await denops.call("expand", "%:t") as string;
        return Object.entries(modules[ft]).map(([name, snippet]) => {
          const info = snippet.name != null
            ? `[${snippet.name}]\n\n${
              snippet.text ?? snippetRender(snippet, {})
            }`
            : snippet.text ?? snippetRender(snippet, {});

          return {
            word: name,
            info,
          };
        });
      } catch (_) {
        return [];
      }
    },
  };
};
