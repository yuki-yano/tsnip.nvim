import {
  BaseSource,
  GatherCandidatesArguments,
  OnCompleteDoneArguments,
} from "https://deno.land/x/ddc_vim@v1.2.0/base/source.ts";
import { Candidate } from "https://deno.land/x/ddc_vim@v1.2.0/types.ts";

export type CompletionMetadata = {
  word: string;
};

export class Source extends BaseSource<Record<string, never>> {
  async gatherCandidates(
    args: GatherCandidatesArguments<Record<string, never>>,
  ): Promise<Array<Candidate<CompletionMetadata>>> {
    const candidates = (await args.denops.dispatch("tsnip", "items")) as Array<
      { word: string; info: string }
    >;
    return Promise.resolve(candidates.map(({ word, info }) => ({
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
    await args.denops.call("tsnip#remove_suffix_word", args.userData.word);
    await args.denops.cmd(`TSnip ${args.userData.word}`);
  }
}
