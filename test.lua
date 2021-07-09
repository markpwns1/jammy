
local m = debug.getmetatable(0) or { };

m.times = function(self, f)
    for i = 1, self, 1 do
        f(i)
    end
end

m.__index = m;

debug.setmetatable(0, m);

(10):times(function (i)
    print(i)
end)
