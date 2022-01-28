if exists('g:loaded_tsnip') && g:loaded_tsnip
  finish
endif
let g:loaded_tsnip = v:true

if !exists('g:tsnip#snippet_dir')
  let g:tsnip#snippet_dir = $HOME .. '/.vim/tsnip'
endif
