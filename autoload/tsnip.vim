function! tsnip#items() abort
  return denops#request('tsnip', 'items', [])
endfunction

function! tsnip#remove_suffix_word(word) abort
  let len = len(a:word)
  let lnum = getcurpos()[1]
  let col = getcurpos()[2]
  let line = getline('.')

  let line = substitute(line, a:word . '$', '', '')
  call setline(lnum, line)
  call cursor(lnum, col - len)
endfunction
