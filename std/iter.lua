
-- How to use this features:
--[[
    10:times x => print x;
    5:to_inc(10, x => print x);
]]

local m = debug.getmetatable(0) or { };

m.times_inc = function(self, f)
    for i = 1, self, 1 do
        f(i)
    end
end

m.to_inc = function (self, to, f)
    for i = self, to, 1 do
        f(i)
    end
end

m.times = function(self, f)
    for i = 0, self-1, 1 do
        f(i)
    end
end

m.to = function (self, to, f)
    for i = self, to-1, 1 do
        f(i)
    end
end

m.__index = m;

debug.setmetatable(0, m);

function iter(a)
    local n = 0;
    local elements = { };
    for k, _ in pairs(a) do
        elements[#elements + 1] = k;
        n = n + 1;
    end

    local i = 0;
    return function ()
        i = i + 1;
        if i <= n then return elements[i] end;
    end
end
