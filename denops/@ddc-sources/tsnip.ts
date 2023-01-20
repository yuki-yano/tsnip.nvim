import {
  BaseSource,
  GatherArguments,
  OnCompleteDoneArguments,
} from "https://deno.land/x/ddc_vim@v3.2.0/base/source.ts";
import { Item } from "https://deno.land/x/ddc_vim@v3.2.0/types.ts";

export type CompletionMetadata = {
  word: string;
};

export class Source extends BaseSource<Record<string, never>> {
  async gather(
    args: GatherArguments<Record<string, never>>,
  ): Promise<Array<Item<CompletionMetadata>>> {
    const items = (await args.denops.dispatch("tsnip", "items")) as Array<
      { word: string; info: string }
    >;
    return Promise.resolve(items.map(({ word, info }) => ({
      word,
      info,
      menu: "[tsnip]",
      dup: true,
      user_data: {
        word,
      },
    })));
  }

  params() {
    return {};
  }

  async onCompleteDone(
    args: OnCompleteDoneArguments<Record<string, never>, CompletionMetadata>,
  ) {
    await args.denops.call("feedkeys", "", "nit");
    if (await args.denops.call("mode") !== "i") {
      return;
    }

    await args.denops.call("tsnip#remove_suffix_word", args.userData.word);
    await args.denops.cmd("redraw");
    await args.denops.cmd(`TSnip ${args.userData.word}`);
  }
}
