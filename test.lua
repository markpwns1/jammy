
local A = {
    __tostring = function() return "A" end
}

local B = setmetatable({__index = A}, A)
local C = setmetatable({}, B)

print(C)
