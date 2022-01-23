local M = {}

local plugin_name = "tsnip"
local Input = require("nui.input")
local event = require("nui.utils.autocmd").event


function M.input(label)
  local input = Input({
    relative = "cursor",
    position = {
      row = 0,
      col = 0,
    },
    size = 40,
    border = {
      style = "rounded",
      text = {
        top = label,
        top_align = "left",
      },
    },
    win_options = {
      winhighlight = "Normal:Normal",
    },
  }, {
    on_change = function(value)
      vim.cmd("call denops#request('tsnip', 'changed', ['" .. label .. "', '" .. value ..  "'])")
    end,
    on_submit = function(value)
      vim.cmd("call denops#request('tsnip', 'submit', ['" .. label .. "', '" .. value ..  "'])")
    end,
    on_close = function()
      vim.cmd("call denops#request('tsnip', 'close', [])")
    end,
  })
  input:mount()

  input:on(event.BufLeave, function()
    vim.cmd("call denops#request('tsnip', 'close', [])")
    input:unmount()
  end)
end

return M
