function! tsnip#items() abort
  return denops#request('tsnip', 'items', [])
endfunction

function! tsnip#remove_suffix_word(word) abort
  let len = len(a:word)
  let [lnum, col] = getcurpos()[:1]
  let lnum = getcurpos()[1]
  let col = getcurpos()[2]
  let line = getline('.')

  if col == len(a:word) + 1
    " Note: Result of `col` come to -1 when only `a:word` in left of cursor.
    let before = ''
  else
    let before = line[0:col - len(a:word) - 2]
  endif
  let after = line[col - 1:]
  call setline(lnum, before .. after)
  call cursor(lnum, col - len)
endfunction
