import { exists } from "https://deno.land/std@0.165.0/fs/mod.ts";
import { toFileUrl } from "https://deno.land/std@0.165.0/path/mod.ts";
import type { Denops } from "https://deno.land/x/denops_std@v3.9.3/mod.ts";
import * as autocmd from "https://deno.land/x/denops_std@v3.9.3/autocmd/mod.ts";
import * as variable from "https://deno.land/x/denops_std@v3.9.3/variable/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v3.9.3/helper/mod.ts";
import * as op from "https://deno.land/x/denops_std@v3.9.3/option/mod.ts";
import {
  assertString,
  isBoolean,
} from "https://deno.land/x/unknownutil@v2.1.0/mod.ts";

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
let fileType: string;
let cwd: string;
let currentLine: string;
let beforeCursorText: string;
let afterCursorText: string;
let useNui: boolean;
let modules: {
  [fileType: string]: {
    default: {
      [name: string]: Snippet;
    };
  };
} = {};

const CURSOR_MARKER = "__tsnip_cursor_marker__";

// Note(@kuuote): this function must be call without `await`
//                because adjust control flow to nui.nvim
const prompt = async (denops: Denops, label: string) => {
  await autocmd.group(denops, "tsnip-internal", (helper) => {
    helper.define(
      "CmdlineChanged",
      "*",
      `call denops#request("${denops.name}", "changed", ["${label}", getcmdline()])`,
    );
    helper.define(
      "CmdlineChanged",
      "*",
      `redraw!`,
    );
  });
  try {
    const result = await helper.input(denops, { prompt: label + ": " });
    if (result != null) {
      // ditto
      denops.dispatch(denops.name, "submit", label, result);
    } else {
      await denops.dispatch(denops.name, "close");
    }
  } finally {
    await autocmd.remove(denops, "CmdlineChanged", "*", {
      group: "tsnip-internal",
    });
  }
};

const renderSnippet = (snippet: Snippet, inputs: Inputs) => {
  return snippet.render(inputs, {
    fileName: {
      text: fileName,
    },
    fileType: {
      text: fileType,
    },
    cwd: {
      text: cwd,
    },
    postCursor: CURSOR_MARKER,
  }).replace(/^\n/, "");
};

const renderPreview = async (
  denops: Denops,
  inputs: Inputs,
): Promise<void> => {
  const indent = beforeCursorText.replace(/\S.*$/, "");
  const preview = beforeCursorText.trimStart() +
    renderSnippet(snippet, inputs) + afterCursorText;
  const lines = preview.replace(CURSOR_MARKER, "|")
    .split("\n")
    .map((line) => indent + line);

  lastExtMarkId = await denops.call(
    "nvim_buf_set_extmark",
    bufnr,
    namespace,
    pos.line - 1,
    pos.col - 1,
    {
      virt_lines: [
        ...useNui ? [[[" ", "Comment"]], [[" ", "Comment"]]] : [],
        ...lines.map((line) => [[line !== "" ? line : " ", "Comment"]]),
      ],
    },
  ) as number;
};

const loadSnippetModule = async (denops: Denops, path: string) => {
  let ft = await op.filetype.get(denops);
  ft = ft === "" ? "_" : ft;

  if (modules[ft] != null) {
    return modules[ft]["default"];
  }

  const url = toFileUrl(`${path}/${ft}.ts`);
  modules = {
    ...modules,
    [ft]: await exists(url.pathname)
      ? { default: {}, ...await import(url.href) }
      : { default: {} },
  };

  return modules[ft]["default"];
};

const deletePreview = async (denops: Denops) => {
  await denops.call("nvim_buf_del_extmark", bufnr, namespace, lastExtMarkId);
};

const insertSnippet = async (denops: Denops) => {
  // Note: use virtualedit to allow placing cursor for end of line at case of insert mode
  const saveVirtualedit = await op.virtualedit.getLocal(denops);
  const saveReg = await denops.call("getreginfo", "z");
  await op.virtualedit.setLocal(denops, "all");
  try {
    const resultString = renderSnippet(snippet, inputs);
    const hasCursor = resultString.indexOf(CURSOR_MARKER) !== -1;
    const result = resultString.split("\n");

    const indent = currentLine.replace(/\S.*$/, "");
    await denops.call(
      "setreg",
      "z",
      [result[0]].concat(result.slice(1).map((s) => indent + s)),
      "v",
    );
    await denops.call("cursor", [pos.line, pos.col]);
    await denops.cmd('normal! "zgP');

    // re-format tab for indent included snippets
    await denops.cmd(`${pos.line},${pos.line + result.length - 1}retab!`);
    if (hasCursor) {
      await denops.call("cursor", [pos.line, pos.col]);
      await denops.call("search", CURSOR_MARKER);
      await denops.cmd('normal! "_d' + CURSOR_MARKER.length + "l");
      await denops.cmd("startinsert");
    } else {
      await denops.call("cursor", [pos.line, 1]);
      await denops.cmd("stopinsert");
    }
  } finally {
    await op.virtualedit.setLocal(denops, saveVirtualedit);
    await denops.call("setreg", "z", saveReg);
  }
  await denops.cmd("redraw");
};

export const main = async (denops: Denops): Promise<void> => {
  namespace = await denops.call(
    "nvim_create_namespace",
    "tsnip",
  ) as number;

  const path = await variable.g.get<string>(
    denops,
    "tsnip_snippet_dir",
  ) as string;

  await helper.execute(
    denops,
    `
    command! -nargs=1 TSnip call denops#request("${denops.name}", "execute", [<f-args>])
    `,
  );

  const useNuiVar = await variable.g.get(denops, "tsnip_use_nui");

  if (isBoolean(useNuiVar)) {
    useNui = useNuiVar;
  } else {
    useNui = !!await denops.call("luaeval", "pcall(require, 'nui.input')");
  }

  denops.dispatcher = {
    execute: async (snippetName: unknown): Promise<void> => {
      assertString(snippetName);

      const module = await loadSnippetModule(denops, path);
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
      fileName = await denops.call("expand", "%:t") as string;
      fileType = await op.filetype.get(denops);
      cwd = await denops.call("getcwd") as string;
      currentLine = await denops.call("getline", ".") as string;

      beforeCursorText = currentLine.slice(
        0,
        new TextDecoder().decode(
          new TextEncoder().encode(currentLine).slice(0, pos.col - 1),
        ).length,
      );
      afterCursorText = currentLine.slice(beforeCursorText.length);

      if (snippet.params.length > 0) {
        if (useNui) {
          await denops.cmd(
            `lua require('${denops.name}').input([=[${
              snippet.params[paramIndex].name
            }]=])`,
          );
        } else {
          prompt(denops, snippet.params[paramIndex].name);
        }

        await renderPreview(denops, {});
      } else {
        await insertSnippet(denops);
      }
    },
    submit: async (name: unknown, input: unknown): Promise<void> => {
      assertString(name);
      assertString(input);

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
        if (useNui) {
          await denops.cmd(
            `lua require('${denops.name}').input([=[${
              snippet.params[paramIndex].name
            }]=])`,
          );
        } else {
          prompt(denops, snippet.params[paramIndex].name);
        }
      } else {
        await deletePreview(denops);
        await insertSnippet(denops);
      }
    },
    changed: async (name: unknown, input: unknown): Promise<void> => {
      assertString(name);
      assertString(input);

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
      const module = await loadSnippetModule(denops, path);
      fileName = await denops.call("expand", "%:t") as string;

      return Object.entries(module).map(([name, snippet]) => {
        const info = snippet.name != null
          ? `[${snippet.name}]\n\n${snippet.text ?? renderSnippet(snippet, {})}`
          : snippet.text ?? renderSnippet(snippet, {});

        return {
          word: name,
          info,
        };
      });
    },
  };
};
