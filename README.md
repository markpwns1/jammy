![Jammy](jammy-2x.png)

Jammy is an original programming language written in NodeJS that transpiles to Lua, designed with speed of iteration as a priority. It's named Jammy because it's designed for writing Love2D games as fast as possible for game jams. Pull requests welcome!

Note: it is expected that a Jammy programmer has a reasonable level of experience with Lua, because much of its behaviour is derived from Lua, and because runtime errors might sometimes require you digging through the compiled code.

## Features
- More concise and expressive syntax (this cannot be overstated)
- Easy prototypes and inheritance
- Expanded standard library including sets, maps, and zero-indexed arrays
- Simpler and more powerful module system
- Optional runtime function type checks and default arguments
- String interpolation and full standard library string suite
- All with minimal overhead, and compiling to straightforward Lua code

## Sample
The following is the `map` class added by Jammy's standard library. Almost all of Jammy's standard library is written in Jammy (made possible by the quality of the code generation).

```lua

use "std/iter.jam";
use "std/types.jam";
use "std/table.jam";

prototype map {

    constructor: (t: table = { }) :=> >> @_elements = t;

    set: (k: exists, v) :=> >> @_elements #k = v;
    get: k: exists :=> @_elements #k;
    has: k: exists :=> bool @_elements #k;
    remove: k: exists :=> >> @_elements #k = nil;
    clear: () :=> >> for k, v in ^@_elements, @_elements #k = nil;

    size: () :=> reduce(0, tbl ^@_elements, n => n + 1);
    keys: () :=> reduce({ }, tbl ^@_elements, table.push);
    values: () :=> reduce({ }, tbl ^@_elements, (t, k, v) => >> t #(len t + 1) = v);

    to_table: () :=> reduce({ }, tbl ^@_elements, table.set);
    shallow_copy: () :=> map @to_table!;
    pairs: () :=> ^@_elements;
    set_elements: t: table :=> {
        @clear!;
        for k, v in ^t, @_elements #k = v;
    };

    each: f: function :=> >> for k, v in ^@_elements, f k;
    merge: (a: map, b: map) => reduce(a:shallow_copy!, tbl ^b._elements, table.set);

};

export map;

```

## Installation
- `git clone https://github.com/markpwns1/jammy`
- `cd jammy`
- `npm install`

## Usage
On Windows, you can run `jammy.bat` (or just `jammy`). Regardless of your operating system, you should be able to run `node jammy.js`. There are three main "modes" in which the Jammy compiler operates.

### Program mode
Run `jammy program <src dir> <out dir> [-e <entry file>]` to compile an entire directory. You can then run this file by running the entry file in lua. For example:
```
> jammy program src out -e myprogram.jam
> lua out/myprogram.lua
Hello world!
```
The path to the entry file must be relative to the source directory. In the example above, the entry file is located at `src/program.jam`. By default, the entry file is `main.jam`.

### Love2D mode
Run `jammy love <src dir> <out dir>` to compile Love2D projects. This is equivalent to program mode, only the compiled project is compatible with Love2D and you have no choice what the entry file is. (The entry file is automatically `main.jam` and you can't change it.)

### Library mode
Run `jammy library src out` to compile an entire directory *as a library.* This allows any compiled file to be `require()`-ed by Lua files or `use`-d by Jammy files and work fine.

### Compiler flags
- `-V, --version` output the version number
- `-e, --entry <file>` Program mode only. Specifies the entry point of the program (default: "main.jam")
- `-s, --no-std` Doesn't compile and include the Jammy standard library
- `-m, --minify` Minifies compiled files (including Lua files)
- `-h, --help` display help for command

## Language
Jammy is a very wacky language, and quite unreadable, but at least it's fast to write.

<!-- ### Cheat sheet
```lua

-- Single line comment

--[
  Multiline comment
  --[
    (They support nesting)
  ]
]

let x;
let a, b, c = 1, 2, 3;

-- Function calls with one argument need no parentheses
print "Hello world!";
print("Hello world!");
print("Hello", "World!");

-- Function calls with no arguments use a !
print!;

if a == 1 && (b ~= 3 || c == 1), print "Hello world!";

``` -->

### Semantics
Order of operations is abolished. All binary operators will be evaluated left-to-right. For example, `5 + 6 * 2` is equivalent to the following Lua code `(5 + 6) * 2`. Besides that, there are no semantic differences to Lua, only syntax differences and additional features.

### Numbers, booleans, nil
These are pretty much exactly the same as in Lua, except numbers can only be in decimal format.

### Strings
Strings in Jammy are multiline by default. You can include `${ <expression> }` to automatically insert an expression into a string. The following is an example of a Jammy string:
```rust
"five plus
six equals
${5 + 6}"
```

### Comments
Single-line comments start with a `--` like in LuA. Multi-line comments similarly start with `--[` and end with `]`. Nested multi-line comments are supported.

### Variables
Variables are declared using the `let` statement. Any variable declared this way will be local.
```rust
let a = 24;
let b, c, d = 1, 2, 3;
let e, f = returns_two_values!;
```
If a variable already exists, it can be assigned a value literally the exact same way as a declaration, except you omit "let".
```rust
a = 24;
b, c, d = 1, 2, 3;
e, f = returns_two_values!;
```
Assigning to a variable that does not exist will declare a global variable, like in Lua.

### Operators
These are the exact same as Lua but with some minor differences:
- `and` is now `&&`
- `or` is now `||`

### Unary Operators
Unary operators are the exact same as in Lua but `not` is now `!`. Note that `+` is not a unary operator.

### Functions
Functions are a value, and like other values, they can be assigned to variables. They are declared like so:
```javascript
let return_five = () => 5;
let increment = x => x + 1;
let add = (a, b) => a + b;

let sum = numbers... => {
  let s = 0;
  for i, v in ipairs numbers, s = s + v;
  => s;
};

let sum_multiply = (a, numbers...) => a * sum ...numbers;
```
Notice how you can have any number of parameters. When the function takes one parameter, the parameter does not need to be parenthesized. You can replace `=>` with `:=>` to prepend `self` (alias `@`, more info further down) to the list of parameters. For example,
```javascript
array.insert = x :=> {
  table.insert(@elements, x);
};
```

This is very important: **a function takes an EXPRESSION directly after the arrow, NOT a statement**. 

A function can take variadic arguments if its last parameter ends with `...`. 
```rust
let print_all = items... => >> for x in ^items, print x;
```

You can also specify types for the arguments, and they will be checked at runtime, and throw errors like Lua standard library functions do if their arguments are incorrect. In order to use this feature, you have to `use "std/types.jam";`

```lua
use "std/types.jam";

let add = (a: number, b: number) => a + b;

print add(5, 6); -- prints 11
print add("hello", 6); 

-- lua: out/main.lua:6: bad argument #1 to add (number expected, got string)
-- stack traceback:
--         [C]: in function 'error'
--         .\out\std\checks.lua:157: in function '__typecheck'
--         out/main.lua:6: in function 'add'
--         out/main.lua:8: in main chunk
--         [C]: ?
```

Types can also have unions and be optional. Union types are denoted by multiple types separated by `|`. For example:

```ts
let add = (a: number | string, b: number | string) => tonumber a + tonumber b;
```

To denote that a parameter is optional, put `?` at the end of its type definition (or put no type definition. An argument is completely unchecked if it has no type annotations).

```ts
let add = (a: number | string ?, b: number | string ?) => tonumber (a || b) + tonumber (a || b);
```

A parameter may also have default values by putting `=` and then an expression at the end of a parameter

```ts
let add = (a: number | string = 5 + 6, b: number | string = 7 + 8) => tonumber (a || b) + tonumber (a || b);
```

If a parameter has a default value, it is considered optional, so it makes no difference whether or not you add `?` to the type definition in this case.

If the last parameter is variadic, it **cannot** have type annotations or default values.

To typecheck `self`, when using a `:=>` function, include an expression between `[ ]` before the `:=>` and Jammy will throw an error if the given `self`'s metatable chain does not contain that expression. For example:

```lua
let vec2 = { };
vec2.__index = vec2;

-- constructor for a vector 2
vec2.new = (x, y) => {
    let instance = { x: x, y: y };
    setmetatable(instance, vec2);
    return instance;
}

-- makes sure that the given `self`'s metatable (or it's metatable's metatable, and so on) is `vec2`
-- (@x is short for self.x, and likewise for @y)
vec2.magnitude = () [vec2] :=> math.sqrt(@x * @x + (@y * @y));
```

Note that all these special safety features are not idiomatic to Jammy (because they take more time to write). They were added to facilitate writing a standard library, and I expect that type annotations will not be necessary during a game jam (Jammy's intended use-case).

### Function Overloading
Functions can be overloaded to change their behaviour depending on the type or number of arguments they're given. In order to use function overloading, you must `use "std/function.jam";`. 

The syntax for function overloading is a `with` expression, followed by a list of function definitions separated by `;` surrounded by `{ }`. For example:

```lua
use "std/types.jam"; -- required for type annotations
use "std/function.jam"; -- required for function overloading

let f = with {
    (x: number, y: number) => >> print x + y;
    (x: string) => print "||${x}||";
    (x: string, args...) => print "${x}: ${table.concat(args, ", ")}";
    (x: number) => print x;
    () => print "Hello world";
};

f "abc123"; -- prints ||abc123||
f (1, 2); -- prints 3
f 1 + 4; -- prints 5
f!; -- prints "Hello world"
f ("foo", 420, "bar", "baz"); -- prints "foo: 420, bar, false"

f (1, 2, 3, 4, 5); 
-- lua: out/main.lua:14: No suitable overload found for the following arguments: number, number, number, number, number
```

### Statements and expressions
An expression is code that evaluates to a value. For example, `"hello world"`, `5 + 6`, and `math.sin(5)` are all expressions. A statement is code that does not evaluate to a value. For example, `while i < 10, i = i + 1`, `let x = 5`, `y = 4` are all statements.

Some syntactic constructs in Jammy explicitly take in an expression, or explicitly take in a statement. Furthermore, some syntactic constructs in Jammy may be either statements, or expressions, or both. *This is an important distinction because some features of Jammy behave differently depending on whether or not they're being used as a statement or as an expression.*

### Return statements
Return statements are made like so:
```=> <expression>;```
A return statement *must* return *one* expression. If you do not want to return a value, simply return `nil`. If you want to return multiple values, like Lua does, then return a tuple, for example:
```=> (1, "A", 3);```
(This readme contains futher information on tuples).

### Turning statements into expressions
Some syntactic constructs in Jammy explicitly require an expression. A function is an example of such a construct. A **block** may be used to execute statements and then return a value. A block can be used as a statement or an expression, meaning it can be used anywhere. A block is defined like so:
```lua
{
  let a = 5;
  let b = 6;
  -- more statements ...
  => a + b;
}
```
Semicolons are obligatory after every statement in a block. A block must have at least one statement inside it, or else it will be interpreted as an empty table (`{}`).

`>>` is shorthand for a block containing one statement. These two statements are equivalent:
```rust
let print_table = a => {
  for i, v in ipairs v, print x;
};
```
```rust
let print_array = a => >> for i, v in ipairs a, print x;
```
A `>>` block must **not** have a semicolon.

A return statement can be used to return an expression from within a block. If nothing is returned, then the block will return `nil`.

Naturally, blocks allow for some cool constructs such as:
```rust
let x = {
  let a = 1;
  let b = 2;
  => a + b;
};

print x;
```

### Calling functions

Function calling can be used both as a statement, or as an expression. If a function is used as an expression but does not return anything, then it returns `nil`. Functions can be called like so:
```rust
emit_newline!
print "Hello world!"
print("Hello world!")
add(a, b)
```
A notable deviation from other languages: if no arguments are to be supplied to a function, it must be called with `!`. If one argument is supplied to a function, it need not be wrapped in parentheses. If multiple arguments are supplied, then they are wrapped in parentheses and separated by a comma.

If indexing an object, you can replace `.` with `:` to supply the object as the first parameter to the function you are calling. For example, the following expressions are equivalent:
```lua
a.b:c(1, 2, 3)
a.b.c(a.b, 1, 2, 3)
```
This is exactly the same as in Lua.

When not using parentheses, functions are evaluated from right-to-left. For example,
```lua
print inspect table.length a:to_table!;
```
is equivalent to
```lua
print(inspect(table.length(a:to_table!)));
```

Beware! When not using parentheses, function calls have different precedence when used as an expression versus when used as a statement. See the two examples:
```lua
-- Statement: these are equivalent
print 1 + 2 + 3;
print(1 + 2 + 3);

-- Expression: these are equivalent
let x = sqrt 1 + 2 + 3;
let x = sqrt(1) + 2 + 3;
```

### If statements

If statements are used like so:
```rust
if a == b, x = 1;

if a == b, x = 1 else x = 2;

let x = if a == b, 1;

let y = if a == b, 1 else 2;
```
When used as an expression, if there is no `else` branch, it will return `nil` in that case. There is also a subtle difference between `if` used as a statement as opposed to an expression: as a statement, the body of each branch must be a statement, whereas as an expression, the body of each branch must be an expression. 

A comma is required after the condition.

### Match statements

Match statements are pretty much shortcuts for if-statements with lots of else-ifs (and in fact compile exactly to that in Lua). Any expression may be used as a condition for a match case. See the following examples on how to use `match` statements.
```rust
match {
    x == "hello" => print "goodbye";
    y < 2 => print "y is less than 2";
    else print "neither of the cases matched";
};

print match {
    x == "hello" => "goodbye",
    y < 2 => "y is less than 2",
    else "neither of the cases matched"
};
```
The `else` case is optional. Notice the subtle differences between `match` used as a statement as opposed to an expression. As a statement, the body of each case must be a statement, and they must end in a semicolon, whereas as an expression, the body of each case must be an expression and each case is separated by a comma.

For long chains and variable names, `match` provides a shortcut to easily alias them.
```rust
match (let x, y = a.very_long:chain_of!, long:long!:expressions!) {
  x == "hello" => print "goodbye";
  y < 2 => print "y is less than 2";
  else print "neither of the cases matched";
};
```
This will save you from having to type the name of the expression each time, and also it will only evaluate the expressions once.

### While loops
Surely while loops need no introduction. In Jammy they can only be statements. They execute the statement directly after the condition.
```rust
let i = 0;
let n = 10;
while i < n, {
  print i;
  i = i + 1;
};
```
There may be a comma between the condition and the body to help avoid grammatical ambiguity. It would be wise to use the comma, since without the comma, the above code would not compile, as `{ print i; i = i + 1; }` would be interpreted as the first argument to the function `n`. 

### For-in loops
For-in loops are pretty much identical to Lua's.
```lua
for i, v in ipairs a, print v;
```
The comma between the iterator and the body is required.

Jammy provides shorthand for common Lua iterators.
- `^x` -- `pairs(x)`
- `%x` -- `ipairs(x)`
- `*x` -- `iter(x)` (a Jammy-specific iterator that is equivalent to `ipairs` but doesn't return the index)
They are unary operators and can be used like so:
```lua
let a = tbl ("A", "B", "C");
for x in *a, print x; -- prints A and B and C
```

Jammy lacks a numeric for-loop, but it does have some generators that can be used in their place. For example:
```lua
for in range 10, print "!"; -- prints 10 exclamation marks
for i in range 10, print i; -- prints 0 to 9 inclusive
for i in range(5, 10), print i; -- prints 5 to 9 inclusive
for i in range(20, 15, -2), print i; -- prints 20 to 16 inclusive, going down by 2
```
While `range` appears to be an iterator function, fear not. Jammy compiles this to a simple `for i=start, end, step do` loop, so there is no performance overhead. There also exists `range_inc` which is `range` but the "end" value is inclusive. `range_inc` also starts at 1 unless directed otherwise. 

For loops can also be used as an expression. Take the following example:
```lua
-- tbl(a, b, c, etc...) creates a Lua table with its arguments.
-- for-in as an expression returns whatever the loop body returns, as a tuple
-- so this expression is equivalent to tbl(1, 2, 3, 4, 5, 6, 7, 8, 9, 10)
let t = tbl for i in range_inc 10, i;

-- and this one equivalent to a, b, c = 2.5, 3.0, 3.5
let a, b, c = for i in range 3, (i + 5) / 2; 
```

There is also a namespace called `std.iter` which you can use for some useful iterating tools (these however, do not compile to anything special and incur a very slight performance cost compared to `range`). Take the following example:
```lua
use "std/iter.jam";

-- n:times(fn) is a function which executes the given function n times
-- supplying i to the function. The two below statements print the numbers from 0 to 9.
10:times i => print i;
10:times print;

-- prints 5 to 9.
5:to(10, i => print i);

-- Each of these functions have _inc versions with inclusive boundaries
```

### `break` and `continue`
Within a loop, `break` can be used to stop the loop immediately, and `continue` can be used to stop the current iteration of the loop immediately. Basically, it works like in C-like languages.

### Try-else statements
Try-else statements attempt to perform an expression or statement, and gracefully exit or return a value upon error.
```lua
-- does nothing, exits as soon as the error occurs
try {
  this_function_does_not_exist!;
  print "Hello world!";
};

-- prints that other message
try {
  this_function_does_not_exist!;
  print "Hello world!";
};
else print "Oh no, something went wrong!";

let x = try this_function_does_not_exist!; -- x becomes nil
let y = try this_function_does_not_exist! else 5; -- x becomes 5
```

### Tuples
Any expression can return multiple values by using a tuple. Tuples are declared like so `(1, "hello", b, etc...)`. Take the following example:
```lua
let a, b = if true, (1, 2) else (3, 4);
print(a, b); -- prints 5 6
```
Note that tuples are NOT a data structure, they are simply a mechanism for returning multiple values. The following does not do what one would expect:
```rust
let x = if true, (5, 6);
```
In the above example, `x` becomes 5, and 6 is discarded.

### Arrays
The standard library contains a handy `array` class. You can declare arrays using `array.new(elements...)` or the following shorthand syntax:
```rust
let my_array = [ "A", "B", "C" ];
```
You can do cool stuff with the array such as:
```lua
print my_array #0 -- prints A -- yes, arrays are zero-indexed
print my_array -- prints [ A, B, C ]
print my_array:contains 2 -- prints false
my_array:pop! -- removes and returns the last element
```
Feel free to inspect the source code of `std/array.jam` to see its full functionality. 

The important part about this, however, is that **arrays are not tables**, they are a class. If you just want a normal Lua array-like table, you can use the function `tbl(elements...)`.

Trying to create an array, however, will throw an error unless you've imported `std/array.jam` using a `use` statement. 

### Unpack operator
Any standard Lua array-like table can be unpacked, equivalent to calling the Lua's `unpack` (or `table.unpack` depending on the version) function, using `...my_table`. For example:
```lua
let x = tbl(1, 2, 3);
let add_three = (a, b, c) => a + b + c;
print add_three ...x; -- prints 6
```

### Modules
As far as modules go, Jammy has 2 mechanisms to split code across files: `use` and `import`. Import is the simplest one, it is simply equivalent to Lua's `require`, only it takes a file path, relative to the current file (do not include the file extension!).
```rust
let vec2 = import "../../libraries/vec2";
```

`use` is slightly more complicated. `use` is a statement, not an expression. It is used to include code from other files, but unlike simply using Lua's `require` as a statement, `use` **does not** monkey patch. Anything included is only added to the current file. For example,

```lua
-- main.jam
use "std/array.jam"; -- import the array class

print array.new(1, 2, 3); -- prints [ 1, 2, 3 ]

import "test"; -- execute test.jam
```
```lua
-- test.jam
print array.new(1, 2, 3); -- error, because std/array.jam has not been imported in this file.
```

To write modules compatible with `use`, simply create a file with some Lua code, and export whatever you like using the `export` keyword. For example,

```lua
-- hello.jam
let hello = () => print "Hello world!";

export hello;
```
```lua
-- main.jam
use "hello.jam";
hello!; -- prints Hello world!
```

To export something so that it has a different name in the importing file, do `export something as something_else;`. With the example above, you can do this:

```lua
-- hello.jam
let hello = () => print "Hello world!";

export hello as hello_world;
```
```lua
-- main.jam
use "hello.jam";
hello_world!; -- prints Hello world!
hello!; -- error
```

For those who would like to use Jammy to write Lua libraries, you can do so like this:

```js
-- numbers.jam

let get_five = () => 5;
let get_six = () => 6;
let get_seven = () => 7;

export get_five;
export get_six;
export get_seven;
```

```lua
-- main.lua
local unpack = unpack or table.unpack
local get_five, get_six, get_seven = unpack(require("numbers.lua")) -- numbers.lua is the compiled numbers.jam
```

There are also some import parameters that your module can set (via the `import_parameters` section) to change the way that your module is imported. The import parameters are in JSON format. In order to work properly, the import parameters section **must** be the first thing in your file, excluding whitespace.
```
--[ import_parameters {
  parameters go here...
} ]
```
There is only one import parameter at the moment:

`append: string` -- Injects the specified Lua code directly after the module is loaded. For example:
```

--[ import_parameters {
  "append": "print('Hello world')"
} ]

let add = (a, b) => a + b;
-- module stuff, etc...
```
```lua

use "my_cool_module.jam";
-- prints Hello world
```

These will automatically get resolved when you import the module via Jammy, however, they *do not*, when you're importing the module via Lua. You'll have to read the import parameters and apply the changes it requests by hand.

### Prototypes
Jammy provides an easy way to create prototypes. Just follow this example:
```lua
-- vec2.jam
use "std/types.jam";

prototype vec2 {
    constructor: (x: number, y: number) :=> >> @x, @y = x, y;
    square_magnitude: () :=> (@x * @x) + (@y * @y);
    magnitude: () :=> math.sqrt @square_magnitude!;
    __tostring: () :=> "(${@x}, ${@y})";
};

export vec2;
```
`vec2` can then be used in another file like so:
```lua
use "vec2.jam";
let v = vec2(3, 4);
print v; -- prints (3, 4)
print v:magnitude!; -- prints 5
```

Prototype inheritance can be done by supplying an argument to the `prototype` function. This argument is its super-prototype. An `extend` function exists which is an alias for `prototype` and can be used for inheritance. See the following example:

```lua
-- vec3.jam
use "std/types.jam";
use "vec2.jam";

prototype vec3 from vec2 {
    constructor: (x: number, y: number, z: number) :=> {
        super(x, y);
        @z = z;
    };
    square_magnitude: () :=> super! + (@z * @z);
    __tostring: () :=> "(${@x}, ${@y}, ${@z})";
};

export vec3;
```

### @
When a function is declared with `:=>`, then you can use `@` in it. `@` is equivalent to Lua's `self`. 

In addition to simply being a variable, you can use it as a prefix for variables, and it will be an instance variable. For example, `@x` is equivalent to `self.x`. 

Similarly, calling an `@` function will call a function on the instance, and ensure that the first argument passed is `self`. For example, `@square_magnitude!` is equivalent to `self:square_magnitude()` in Lua.

### Super
When a prototype inherits from another prototype, the method `super` can be used within its methods, and it will call the equivalent method in its parent prototype. For example,

```lua
prototype A { 
    name: () => "A";
};

prototype B from A {
    name: () => super! .. "B";
};

print B!:name!; -- prints AB
```

When not used as a function, it simply refers to the parent class' object.

### Tables
Jammy's syntax for tables is identical to Javascript's, only field names cannot be wrapped in quotation marks.
```js
let x = {
  a: 5,
  b: "bee",
  c: () => 7
};
```
Items in a table may be separated by either `,` or `;` and a separator is not needed for the last element. 

### Table length
Jammy has two ways to determine a table's length. One is to use `len my_table`. This is equivalent to Lua's `#my_table`. The other, more reliable (but slower) way is to use a function that Jammy has added to Lua's standard library: `table.length`. This counts the number of keys in a table.

### Indexing objects 
To index an object where the key is just a string, you can use `.` and then the name of the key, without quotes.
```lua
let a = {
  x: 5
};

print a.x; -- prints 5
```

To index an object where the key is anything but an variable-style string, you can use `#`.
```lua
let a = luatable(
  {
    y: 5
  },
  7,
  8
);

print a #1 #"y"; -- prints 5
```

### Resolving truthy/falsy values
To turn a truthy/falsy value to an explicit boolean, use `!! my_truthy_value`. It is equivalent to `not not my_truthy_value` in Lua.

### Groups
A group is a kind of data structure for which any operation performed on it is performed on each of its elements. For example:

```lua
let f = () => print "Hello world!";
let a, b, c = { f: f }, { f: f }, { f: f };

let g = << a, b, c >>;

g.f!; -- prints Hello world! three times
```

Groups have some comparative functions that will return true only if it's true for all elements of the group.
```lua
let a, b, c = 1, 2, 2;
print << a, b, c >> :eq 2; -- prints false
print << a, b, c >> :gt 0; -- prints true
```

Jammy provides syntactic sugar for these comparative functions, but **only if the left side is directly a group**. This is due to a Lua quirk that prevents me from overloading comparative operators under certain circumstances. For example:
```lua
let a, b, c = 1, 2, 2;
print << a, b, c >> > 0; -- prints true
let g = << a, b, c >>;
print g > 0; -- error
```

You can also set a field on a group and it will set that field for each element.
```lua
let f = () :=> print @my_value;
let a, b, c = { f: f }, { f: f }, { f: f };

let g = << a, b, c >>;
g.my_value = 5;
g:f!; -- prints 5 three times
```

You can also perform group operations using another group, which will match each element on the left side with its counterpart on the right side. For example:
```lua
let a, b, c = 1, 2, 3;
print << a, b, c >> == << 1, 2, 3 >> -- prints true;

let d, e, f = { }, { }, { };
let g = << d, e, f >>;

g.my_value = << 1, 2, 3 >>; -- sets my_value on each of them to 1, 2, and 3
g.print_value = () :=> print @my_value;

g:print_value!; -- prints 1, 2, and 3
```

When used as an expression, a function call will return true if the return value of that function call on each element is a truthy value. For example:
```lua
let f = () :=> print @my_value;
let a, b, c = { f: f }, { f: f }, { f: f };
let g = << a, b, c >>;

g.my_value = << 1, 2, 3 >>;
print g:f!; -- prints true

b.my_value = false;
print g:f!; -- prints false
```

## Example
The following is the (outdated but nonetheless valid) source code for Jammy's array class in the standard library.
```lua

use "std/types.jam";

prototype array {
    
    constructor: elements... :=> >> @_elements = elements;

    new: elements... => array ...elements;

    is_array: a => ((type a) == "table") && a.__type && (a.__type == "array");

    from_table: t: table => array ...t;

    __index: key: exists :=> 
        if type key == "number", @_elements #(key + 1) 
        else if key == "length", len @_elements
        else array #key;

    __newindex: (key: exists, value) :=> >> 
        if type key == "number", 
            if (key < 0) || (key > @length), 
                error "Attempt to set out-of-bounds index in array: ${key} -- Valid bounds are [0, ${@length})"
            else @_elements #(key + 1) = value
        else rawset(@, key, value);

    __tostring: () :=> {
        let str = "[ ";
        let n = len @_elements;
        for i in range_inc n, {
            str = str .. tostring @_elements #i;
            if i < n, str = str .. ", ";
        };
        => str .. " ]";
    };

    count: () :=> len @_elements;

    iter: () :=> {
        let i, n = 0, len @_elements;
        => () => {
            i = i + 1;
            if i <= n, => @_elements #i;
        };
    };

    ipairs: () :=> {
        let i, n = 0, len @_elements;
        => () => {
            i = i + 1;
            if i <= n, => (i, @_elements #i);
        };
    };

    first_index_of: item :=> >> 
        for i in range_inc len @_elements,
            if @_elements #i == item, => i - 1;

    last_index_of: item :=> >> 
        for i in range_inc(len @_elements, 1, -1),
            if @_elements #i == item, => i - 1;

    insert: (i: number, item: exists) :=> >> table.insert(@_elements, i, item);

    push_bottom: (i: number, item: exists) :=> >> table.insert(@_elements, 1, item);

    pop_bottom: (i: number, item: exists) :=> >> table.remove(@_elements, 1);

    push: item: exists :=> {
        @_elements #(len @_elements + 1) = item;
        => item;
    };

    pop: () :=> {
        let n = len @_elements;
        let item = @_elements #n;
        @_elements #n = nil;
        => item;
    };

    remove_at: i: number :=> table.remove(@_elements, i + 1);

    remove: item: exists :=> >> for i, v in ipairs @_elements, if v == item, table.remove(@_elements, i);

    contains: item: exists :=> bool >> for _, v in ipairs @_elements, if item == v, => true;
    has: array.contains;

    get_elements: () :=> @_elements;

    shallow_copy: () :=> array.from_table @_elements;

    equal_to: (a: array, b: array) => {
        if len a._elements ~= len b._elements, => false;
        for i in range_inc len a._elements,
            if (a._elements #i) ~= (b.elements #i), => false;
        => true;
    };

    slice: (start_index: number, end_index: number?) :=> {
        let sliced_table = tbl!;
        start_index = start_index + 1;

        if end_index == nil, end_index = len @_elements;

        let j = 1;
        for i in range_inc(start_index, end_index), {
            sliced_table #j = @_elements #i;
            j = j + 1;
        };

        => array.from_table sliced_table;
    };

    concat: (a: array, b: array) => {
        let c = a:shallow_copy!;
        let a_n = len a._elements;
        for i, v in b:ipairs!, c._elements #(a_n + i) = v;
        => c;
    };

    clear: () :=> >> for i in range_inc len @_elements, @_elements #i = nil;

    first: () :=> @_elements #1;

    last: () :=> @_elements #(len @_elements);

    head: array.first;

    tail: () :=> @slice 1;

    get: i: number :=> @_elements #(i + 1);

    set_elements: t: table :=> {
        let t_n, my_n = len t._elements, len @_elements;
        let i = 1;

        while i <= t_n, {
            @_elements #i = t._elements #i;
            i = i + 1;
        };

        while i <= my_n, {
            @_elements #i = nil;
            i = i + 1;
        };
    };

    each_i: f: function :=> >> for i, v in ipairs @_elements, f(i, v); 
    each: f: function :=> >> for i, v in ipairs @_elements, f v; 

    set: (i: number, item) :=> {
        if (i < 0) || (i >= @length), 
            error "Attempt to set out-of-bounds index in array: ${i} -- Valid bounds are [0, ${@length})"
        else {
            @_elements #(i + 1) = item;
            => item;
        };
    };

    unpack: () :=> ...@_elements;

};

export array;

```
