import { toFileUrl } from "https://deno.land/std@0.120.0/path/mod.ts";
import type { Denops } from "https://deno.land/x/denops_std@v2.4.0/mod.ts";
import { globals } from "https://deno.land/x/denops_std@v2.4.0/variable/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v2.4.0/helper/mod.ts";
import * as op from "https://deno.land/x/denops_std@v2.4.0/option/mod.ts";
import { ensureString } from "https://deno.land/x/unknownutil@v1.1.4/mod.ts";

type Pos = {
  line: number;
  col: number;
};

type Param = {
  name: string;
  type: "single_line";
  defaultValue?: string;
} | {
  name: string;
  type: "multi_line";
};

type Inputs = {
  [key: string]: { text: string; defaultValue?: string } | undefined;
};

type Snippet = {
  text?: string;
  params: Array<Param>;
  render: (inputs: Inputs) => string;
};

let namespace: number;
let pos: Pos;
let bufnr: number;
let snippet: Snippet;
let inputs: Inputs;
let paramIndex: number;
let lastExtMarkId: number;
let currentLine: string;

const path = `${Deno.env.get("HOME")}/.vim/tsnip`;

const renderPreview = async (
  denops: Denops,
  inputs: Inputs,
): Promise<void> => {
  let lines = snippet.render(inputs).split("\n");
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
        ...lines.map((line) => [[line, "Comment"]]),
      ],
    },
  ) as number;
};

const deletePreview = async (denops: Denops) => {
  await denops.call(
    "nvim_buf_del_extmark",
    bufnr,
    namespace,
    lastExtMarkId,
  );
};

export const main = async (denops: Denops): Promise<void> => {
  namespace = await denops.call(
    "nvim_create_namespace",
    "tsnip",
  ) as number;

  await helper.execute(
    denops,
    `
    command! -nargs=1 TSnip call denops#request("${denops.name}", "execute", [<f-args>])
    `,
  );

  denops.dispatcher = {
    execute: async (snippetName: unknown): Promise<void> => {
      ensureString(snippetName);

      const module = await import(
        toFileUrl(`${path}/${await op.filetype.get(denops)}.ts`).href
      );

      snippet = module[snippetName];
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
      currentLine = await denops.call("getline", ".") as string;

      await denops.cmd(
        `lua require('${denops.name}').input('${
          snippet.params[paramIndex].name
        }')`,
      );

      await renderPreview(denops, {});
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
          [name]: {
            text: input,
            defaultValue: param.defaultValue,
          },
        };

        await renderPreview(denops, inputs);
        paramIndex += 1;
      } else if (param.type === "multi_line") {
        inputs = {
          ...inputs,
          [name]: {
            text: inputs[name]?.text == null
              ? input
              : `${inputs[name]?.text}\n${input}`,
          },
        };

        await renderPreview(denops, inputs);
        if (input === "") {
          paramIndex += 1;
        }
      }

      if (snippet.params.length > paramIndex) {
        await denops.cmd(
          `lua require('${denops.name}').input('${
            snippet.params[paramIndex].name
          }')`,
        );
      } else {
        await deletePreview(denops);

        await denops.call(
          "appendbufline",
          bufnr,
          pos.line,
          [
            `${currentLine}${snippet.render(inputs).split("\n")[0]}`,
            ...snippet.render(inputs).split("\n").slice(1),
          ],
        );
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
          [name]: { text: input, defaultValue: param.defaultValue },
        });
      }
    },
    close: async (): Promise<void> => {
      if (lastExtMarkId != null) {
        await deletePreview(denops);
      }
    },
  };
};
