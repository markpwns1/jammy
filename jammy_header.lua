
table.length = function (t)
    local n = 0
    for _ in pairs(t) do n = n + 1 end
    return n
end

function ternary(c, t, f) if c then return t else return f end end

math.sign = function (x)
    return ternary(x < 0, -1, 1)
end

unpack = unpack or table.unpack
getfenv = getfenv or debug.getfenv

function lt(a, b) return a < b end
function gt(a, b) return a > b end 

function nop() end

function has_metatable(A, B)
    local mt = getmetatable(A)
    while mt do
        if mt == B then
            return true
        end
        mt = getmetatable(mt)
    end
    return false
end

function tbl(...) return {...} end

array = { 
    new = function ()
        error("Attempted to use an array without importing array.jam. Either import arrays with `use \"std/array.jam\";` or use luatable(...) in place of your array.", 2)
    end
}

groups = {
    new = function()
        error("Attempted to use a group without importing group.jam. Import groups with `use \"std/group.jam\";`", 2)
    end
}

function __typecheck_arg()
    error("Attempted to use type checks without importing types.jam. Import type checks with `use \"std/types.jam\";`", 2)
end

typechecks, __typecheck_arg_optional, __typecheck_arg_union, __typecheck_arg_union_optional = {}, __typecheck_arg, __typecheck_arg, __typecheck_arg;

function len(x) return #x end
function bool(x) return not not x end

function table.merge(a, b)
    if a == b then return b end
    if b and (type(b) == "table") then 
        local bmt = getmetatable(b) or { }
        local i = bmt.__index or nop;
        if type(i) == "table" then 
            local tbl_index = bmt.__index
            i = function(self, name) return tbl_index[name] end
        end
        local a = a or { }
        bmt.__index = function (self, key) 
            return i(self, key) or a[key] 
        end
        -- if i == bmt.__index then bmt.__index = function (self, key) return a[key] end end
        setmetatable(b, bmt)
    end
    return b
end

function __import(n, l, r)
    local b = { }
    for i = 1, n do
        b[i] = table.merge(l[i], r[i])
    end
    return unpack(b)
end

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

-- let iter = a: table => {
--     let n, elements = 0, { };
--     for k, _ in pairs(a), {
--         elements #(len elements + 1) = k;
--         n = n + 1;
--     };

--     let i = 0;
--     => () => {
--         i = i + 1;
--         if i <= n, => elements #i;
--     };
-- };

function iter(a)
    local n, i, elements = #a, 0, {}
    for j, v in ipairs(a) do elements[j] = v end
    return function()
        i = i + 1
        if i <= n then return elements[i] end
    end
end
