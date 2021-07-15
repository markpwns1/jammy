

table.length = function (t)
    local n = 0
    for _, _ in pairs(t) do n = n + 1 end
    return n
end

math.sign = function (x)
    if x < 0 then return -1 else return 1 end
end

unpack = unpack or table.unpack
getfenv = getfenv or debug.getfenv

function lt(a, b) return a < b end
function gt(a, b) return a > b end 

function range_inc(a, b, c)
    if b == nil and c == nil then return range(1, a+1)
    else 
        c = c or 1
        return range(a, b + math.sign(c), c) 
    end
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

function nop() end

function prototype(super)
    local proto = { super = super }
    local proto_mt = {
        __call = function(self, ...)
            local instance = { }
            do setmetatable(instance, proto) end
            (instance.constructor or nop)(instance, ...);
            return instance
        end,
        __index = super
    }
    setmetatable(proto_mt, super)
    proto.__index = proto
    setmetatable(proto, proto_mt)
    return proto
end

function is_subclass(A, B)
    local mt = getmetatable(A)
    while mt do
        if mt == B then
            return true
        end
        mt = getmetatable(mt)
    end
    return false
end

extend = prototype

function tbl(...) return {...} end

function ternary(c, t, f) if c then return t else return f end end

array = { }
array.new = function (...)
    error("Attempted to use an array without importing array.jam. Either import arrays with `use \"std/array.jam\";` or use luatable(...) in place of your array.", 2)
end

function checks()
    error("Attempted to use type checks without importing types.jam. Import type checks with `use \"std/types.jam\";`", 2)
end

function len(x) return #x end
function bool(x) return not not x end

function table.merge(a, b)
    if type(b) == "table" then
        local x = { }
        if a then for k, v in pairs(a) do x[k] = v end end
        for k, v in pairs(b) do x[k] = v end
        setmetatable(x, table.merge(getmetatable(a or { }), getmetatable(b)))
        return x
    else
        return b
    end
end

function __import(n, l, r)
    local b = { }
    for i = 1, n do
        b[i] = table.merge(l[i], r[i])
    end
    return unpack(b)
end

STRING_INSTANCE = ""
NUMBER_INSTANCE = 0
BOOL_INSTANCE = true

function path_join(b,c)
    b, c = b:gsub("\\\\","/"), c:gsub("\\\\","/")
    local d, e = {}, {}
    for f in b:gmatch("[^/]+") do 
        table.insert(d,f)
    end
    for f in c:gmatch("[^/]+") do 
        table.insert(e,f)
    end
    for g,h in ipairs(e) do 
        if h == ".." then d[#d]=nil else d[#d+1]=h end 
    end
    return table.concat(d,"/")
end 
