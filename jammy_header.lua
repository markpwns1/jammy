

table.length = function (t)
    local n = 0
    for _, _ in pairs(t) do n = n + 1 end
    return n
end

math.sign = function (x)
    if x < 0 then return -1 else return 1 end
end

unpack = unpack or table.unpack

function lt(a, b) return a < b end
function lte(a, b) return a <= b end
function gt(a, b) return a > b end 
function gte(a, b) return a >= b end 

function ternary(a, b, c) if a then return b else return c end end

function incrange(a, b, c)
    if b == nil and c == nil then return range(1, a+1)
    else return range(a, b + math.sign(c), c) end
end

function range(a, b, c)
    if b == nil and c == nil then
        local t = a; a = 0; b = t; c = 1
    elseif c == nil then
        c = 1
    end
    local i = a - c
    local f = ternary(c < 0, gt, lt)
    return function()
        i = i + c
        if f(i, b) then return i end
    end
end

function prototype(super)
    local proto = { super = super }
    for k, v in pairs(super or { }) do
        proto[k] = v
    end
    local proto_mt = {
        __call = function(self, ...)
            local instance = { }
            proto.constructor(instance, ...)
            return setmetatable(instance, proto)
        end
    }
    setmetatable(proto, proto_mt)
    proto.__index = proto
    return proto
end


function relative_path(a, b)
    a, b = a:gsub("\\", "/"), b:gsub("\\", "/")
    local a_parts, b_parts = { }, { }
    for x in a:gmatch("[^/]+") do table.insert(a_parts, x) end
    for x in b:gmatch("[^/]+") do table.insert(b_parts, x) end
    for i, v in ipairs(b_parts) do 
        if v == ".." then a_parts[#a_parts] = nil
        else a_parts[#a_parts+1] = v end
    end
    return table.concat(a_parts, "/")
end

function luatable(...) return {...} end

array = { }
array.new = function (...)
    error("Attempted to use an array without importing std.array. Either import std.array with `use \"std.array\";` or use luatable(...) in place of your array.")
end

try = pcall

function len(x) return #x end

function bool(x) return not not x end

function nop() end
