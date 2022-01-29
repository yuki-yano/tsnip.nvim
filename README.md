# tsnip.nvim

Plugin to expand snippets written in Pure TypeScript(Deno).

This plugin depends on [denops.vim](https://github.com/vim-denops/denops.vim).

## Demo

https://user-images.githubusercontent.com/5423775/150894287-0d17e966-7cab-4953-9b69-a8c54f511284.mp4

## Installation

### Required

- [denops.vim](https://github.com/vim-denops/denops.vim)
- [nui.nvim](https://github.com/MunifTanjim/nui.nvim)

## Usage

Can be used with [coc.nvim](https://github.com/neoclide/coc.nvim) or
[ddc.vim](https://github.com/Shougo/ddc.vim). Place the snippet file in
`~/.vim/tsnip/{filetype}.ts`.

### coc.nvim

```vim
:CocInstall coc-tsnip
```

### ddc.nvim

```vim
call ddc#custom#patch_global('sources', ['tsnip'])
```

## Example

`~/.vim/tsnip/typescriptreact.ts`

```typescript
import { Snippet } from "https://deno.land/x/tsnip_vim@v0.4/mod.ts";

const state: Snippet = {
  name: "useState",
  text: "const [${1:state}, set${State}] = useState(${2:default_value})",
  params: [
    {
      name: "state",
      type: "single_line",
    },
    {
      name: "default_value",
      type: "single_line",
    },
  ],
  render: ({ state, default_value }) =>
    `const [${state?.text ?? ""}, set${
      state != null
        ? `${state.text?.charAt(0).toUpperCase()}${state.text?.slice(1)}`
        : ""
    }] = useState(${default_value?.text ?? ""})`,
};

export default {
  state
}
```
