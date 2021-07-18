# Jammy

Jammy is an original programming language written in NodeJS that transpiles to Lua, designed with speed of iteration as a priority. It's named Jammy because it's designed for writing Love2D games as fast as possible for game jams. Pull requests welcome!

Note: it is expected that a Jammy programmer has a reasonable level of experience with Lua, because much of its behaviour is derived from Lua, and because runtime errors might sometimes require you digging through the compiled code.

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

### Semantics
Order of operations is abolished. All binary operators will be evaluated left-to-right. For example, `5 + 6 * 2` is equivalent to the following Lua code `(5 + 6) * 2`. Besides that, there are no semantic differences to Lua, only syntax differences and additional features.

### Numbers, booleans, nil
These are pretty much exactly the same as in Lua, except numbers can only be in decimal format.

### Strings
Strings in Jammy are multiline by default. You can include `${ <expression> }` to automatically insert an expression into a string. The following is an example of a Jammy string:
```
"five plus
six equals
${5 + 6}"
```

### Comments
Single-line comments start with a `//` like in C-style languages. Multi-line comments similarly start with `/*` and end with `*/`. Nested multi-line comments are not supported (yet).

### Variables
Variables are declared using the `let` statement. Any variable declared this way will be local.
```
let a = 24;
let b, c, d = 1, 2, 3;
let e, f = returns_two_values!;
```
If a variable already exists, it can be assigned a value literally the exact same way as a declaration, except you omit "let".
```
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
Unary operators are the exact same as in Lua but `not` is now `!`. Also, **there cannot be a space between the operator and its value**. For example, `-5` is valid but `- 5` is not.

### Functions
Functions are a value, and like other values, they can be assigned to variables. They are declared like so:
```
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
Notice how you can have any number of parameters. When the function takes one parameter, it the parameter does not need to be parenthesized. A function can take variadic arguments if its last parameter ends with `...`. You can replace `=>` with `:=>` to prepend `self` to the list of parameters. For example,
```
array.insert = x :=> {
  table.insert(my.elements, x);
};
```

This is very important: **a function returns the expression directly after the arrow**. A function is not a subroutine (by default, at least). In the examples above, however, there are clearly classic-style functions, which perform multiple operations, like `array.insert` and `sum`. I will now explain this.

### Statements and expressions
An expression is code that evaluates to a value. For example, `"hello world"`, `5 + 6`, and `math.sin(5)` are all expressions. A statement is code that does not evaluate to a value. For example, `while i < 10, i = i + 1`, `let x = 5`, `y = 4` are all statements.

Some syntactic constructs in Jammy explicitly take in an expression, or explicitly take in a statement. Furthermore, some syntactic constructs in Jammy may be either statements, or expressions, or both.

### Return statements
Return statements are made like so:
```=> <expression>;```
A return statement *must* return *one* expression. If you do not want to return a value, simply return `nil`. If you want to return multiple values, like Lua does, then return a tuple, for example:
```=> (1, "A, 3);```
(This readme contains futher information on tuples).

### Turning statements into expressions
Some syntactic constructs in Jammy explicitly require an expression. A function is an example of such a construct. A **block** may be used to execute statements and then return a value. A block can be used as a statement or an expression, meaning it can be used anywhere. A block is defined like so:
```
{
  let a = 5;
  let b = 6;
  // more statements ...
  => a + b;
}
```
Semicolons are optional but may help avoid grammatical ambiguity in rare cases (I can't think of any off the top of my head, to be honest). A block must have at least one statement inside it, or else it will be interpreted as an empty table.

`>>` is shorthand for a block containing one statement. These two statements are equivalent:
```
let print_table = a => {
  for i, v in ipairs v, print x;
};
```
```
let print_array = a => >> for i, v in ipairs a, print x;
```
A `>>` block must **not** have a semicolon.

A return statement can be used to return an expression from within a block. If nothing is returned, then the block will return `nil`.

Naturally, blocks allow for some cool constructs such as:
```
let x = {
  let a = 1;
  let b = 2;
  => a + b;
};

print x;
```

### Calling functions

Function calling can be used both as a statement, or as an expression. If a function is used as an expression but does not return anything, then it returns `nil`. As a statement, functions can be called like so:
```
emit_newline!
emit_newline()
print "Hello world!"
print("Hello world!")
add(a, b)
```
If no arguments are to be supplied to a function, it can be called with either `!` or `()`. If one argument is supplied to a function, it need not be wrapped in parentheses. If multiple arguments are supplied, then they are wrapped in parentheses and separated by a comma.

If indexing an object, you can replace `.` with `:` to supply the object as the first parameter to the function you are calling. For example, the following expressions are equivalent:
```
a.b:c(1, 2, 3)
a.b.c(a.b, 1, 2, 3)
```
This is exactly the same as in Lua.

### If statements

If statements are used like so:
```
if a == b, x = 1;

if a == b, x = 1 else x = 2;

let x = if a == b, 1;

let y = if a == b, 1 else 2;
```
When used as an expression, if there is no `else` branch, it will return `nil` in that case. There is also a subtle difference between `if` used as a statement as opposed to an expression: as a statement, the body of each branch must be a statement, whereas as an expression, the body of each branch must be an expression. 

The commas are obligatory.

### Match statements

Match statements are used like so:
```
let x = 5;
match x, {
  "hello" => print "goodbye";
  5 => print "x is five";
  else print "x is neither 'hello' nor 5";
};

print match x, {
  "hello" => "goodbye",
  5 => "x is five",
  else "x is neither 'hello' nor 5"
};
```
The `else` case is optional. Notice the subtle differences between `match` used as a statement as opposed to an expression. As a statement, the body of each case must be a statement, and they must end in a semucolon, whereas as an expression, the body of each case must be an expression and each case is separated by a comma.

Also, the match cases need not be constant values. You can do things like
```
match x, {
  5 + 6 => // ...
  a! => // ...
};
```

### While loops
Surely while loops need no introduction. In Jammy they can only be statements. They execute the statement directly after the condition.
```
let i = 0;
let n = 10;
while i < n, {
  print i;
  i = i + 1;
};
```
There may be a comma between the condition and the body to help avoid grammatical ambiguity. It would be wise to use the comma, since without the comma, the above code would not compile, as `{ print i; i = i + 1; }` would be interpreted as the first argument to the function `n`. 

### For-in loops
For-in loops are pretty much identical to Lua's. They are statements in Jammy, not expressions.
```
for i, v in ipairs a, print v;
```
The comma between the condition and the body are optional.

Jammy has some generators that can be used with for-in loops. For example:
```
for i in range 10, print i; // prints 0 to 9 inclusive
for i in range(5, 10), print i; // prints 5 to 9 inclusive
for i in range(20, 15, -2), print i; // prints 20 to 16 inclusive, going down by 2
```
While it `range` appears to be an iterator function, fear not. Jammy compiles this to a simple `for i=start, end, step do` loop, so there is no performance overhead. There also exists `range_inc` which is `range` but the "end" value is inclusive. `range_inc` also starts at 1 unless directed otherwise. There is also a namespace called `std.iter` which you can use for some useful iterating tools (these however, do not compile to anything special and incur a very slight performance cost compared to `range`). Take the following example:
```
use "std.iter";

// n:times(fn) is a function which executes the given function n times
// supplying i to the function. The two below statements print the numbers from 0 to 9.
10:times i => print i;
10:times print;

// prints 5 to 9.
5:to(10, i => print i);

// Each of these functions have _inc versions with inclusive boundaries
```

### `break` and `continue`
Within a loop, `break` can be used to stop the loop immediately, and `continue` can be used to stop the current iteration of the loop immediately. Basically, it works like in C-like languages.

### Try-else statements
Try-else statements attempt to perform an expression or statement, and gracefully exit or return a value upon error.
```
// does nothing, exits as soon as the error occurs
try {
  this_function_does_not_exist!
  print "Hello world!"
}

// prints that other message
try {
  this_function_does_not_exist!
  print "Hello world!"
}
else print "Oh no, something went wrong!"

let x = try this_function_does_not_exist!; // x becomes nil
let y = try this_function_does_not_exist! else 5; // x becomes 5
```

### Tuples
Any expression can return multiple values by using a tuple. Tuples are declared like so `(1, "hello", b, ...)`. Take the following example:
```
let a, b = if true, (1, 2) else (3, 4);
print(a, b); // prints 5 6
```
Note that tuples are NOT a data structure, they are simply a mechanism for returning multiple values. The following does not do what one would expect:
```
let x = if true, (5, 6);
```
In the above example, `x` becomes 5 and 6 is discarded.

### Arrays
The standard library contains a handy `array` class. You can declare arrays using the following syntax:
```
let my_array = [ "A", "B", "C" ];
```
You can do cool stuff with the array such as:
```
print my_array #0 // prints A -- yes, arrays are zero-indexed
print my_array // prints [ A, B, C ]
print my_array:contains 2 // prints false
my_array:pop! // removes the last element
```
Feel free to inspect the source code of `std/array.jam` to see its full functionality. 

The important part about this, however, is that **arrays are not tables**, they are a class. If you just want a normal Lua array-like table, you can use the function `tbl(elements...)`.

Trying to create an array, however, will throw an error unless you've imported `std.array` using a `use` (or `require`) statement.

### Unpack operator
Any standard Lua array-like table can be unpacked, equivalent to calling the Lua `table.unpack` function, using `...my_table`. For example:
```
let x = tbl(1, 2, 3);
let add_three = (a, b, c) => a + b + c;
print add_three ...x; // prints 6
```

### Modules
As far as modules go, Jammy has 2 mechanisms to split code across files: `use` and `import`. Import is the simplest one, it is simply equivalent to Lua's `require`, only it takes a file path, relative to the current file (do not include the file extension!).
```
let vec2 = import "../../libraries/vec2";
```

`use` is slightly more complicated. `use` is a statement, not an expression. It is used to include code from other files, but unlike simply using Lua's `require` as a statement, `use` **does not** monkey patch. Anything included is only added to the current file. For example,

```
// main.jam
use "std/array.jam"; // import the array class

print array.new(1, 2, 3); // prints [ 1, 2, 3 ]

import "test.jam"; // execute test.jam
```
```
// test.jam
print array.new(1, 2, 3); // error, because std/array.jam has not been imported in this file.
```

To write modules compatible with `use`, simply create a file with some Lua code, and prepend an `import_parameters` section.
```
/** import_parameters {
  parameters go here...
} */
```
There are several import parameters that your module can set. The import parameters are in JSON format.

`set: string[]` -- Upon importing the module, creates the following local variables, and assigns them to the elements of a table you return. Take the following example:
```
/** import_parameters {
  "set": [ "get_five", "get_six", "get_seven" ]
} */

let get_five = () => 5;
let get_six = () => 6;
let get_seven () => 7;

=> tbl(get_five, get_six, get_seven)
```

The `use` statement is equivalent to Lua's `require` except for one thing: **the use statement works relative to the current file**. The use statement also considers "/" and "." to be equivalent.

### Prototypes
Jammy provides an easy way to create prototypes. Just follow this example:
```
// vec2.jam

let vec2 = prototype!;

vec2.constructor = (x, y) :=> >> my.x, my.y = x, y;

vec2.square_magnitude () :=> (my.x * my.x) + (my.y * my.y);
vec2.magnitude = () :=> math.sqrt my:square_magnitude!;

vec2.__tostring = () :=> "(${my.x}, ${my.y})";

=> vec2;
```
`vec2` can then be used in another file like so:
```
let vec2 = use "vec2";
let v = vec2(4, 5);
print v;
print v:magnitude!;
```

Prototype inheritance can be done by supplying an argument to the `prototype` function. This argument is its super-prototype. An `extend` function exists which is an alias for `prototype` and can be used for inheritance. See the following example:

```
// vec3.jam

let vec3 = extend vec2;

vec3.constructor = (x, y, z) :=> {
  my.super.constructor(self, x, y);
  my.z = z;
};

vec3.square_magnitude () :=> my.super.square_magnitude self + (my.z * my.z);

vec3.__tostring = () :=> "(${my.x}, ${my.y}, ${my.z})";

=> vec3;
```
As you can see, to override a method, simply declare an identical method in the subclass. To call the superclass' method from within the overriden method, you can use `my.super.the_method(self, ...)`.

### Tables
Jammy's syntax for tables is identical to Javascript's, only field names cannot be wrapped in quotation marks.
```
let x = {
  a: 5,
  b: "bee",
  c: () => 7
};
```

### Table length
Jammy has two ways to determine a table's length. One is to use `len my_table`. This is equivalent to Lua's `#my_table`. The other, more reliable (but slower) way is to use a function that Jammy has added to Lua's standard library: `table.length`. This counts the number of keys in a table.

### Indexing objects 
To index an object where the key is just a string, you can use `.` and then the name of the key, without quotes.
```
let a = {
  x: 5
};

print a.x; // prints 5
```

To index an object where the key is anything but an variable-style string, you can use `#`.
```
let a = luatable(
  {
    y: 5
  },
  7,
  8
);

print a #1 #"y"; // prints 5
```

### `my` and `self`
Jammy has two keywords, `my` and `self`, and they are both equivalent to Lua's `self`. You can use either of them interchangeably.

### Resolving truthy/falsy values
To turn a truthy/falsy value to an explicit boolean, use `bool my_truthy_value`. It is equivalent to `not not my_truthy_value` in Lua.

## Example
The following is the source code for Jammy's array class in the standard library.
```
array = prototype!;

array.constructor = elements... :=> >> my._elements = elements;

array.new = elements... => array ...elements;

array.from_table = t => array ...t;

array.__index = key :=> 
    if type key == "number", my._elements #(key + 1) 
    else if key == "length", len my._elements
    else array #key;

array.__newindex = (key, value) :=> >> 
    if type key == "number", 
        if (key < 0) || (key > my.length), 
            error "Attempt to set out-of-bounds index in array: " .. key .. " -- Valid bounds are [0, " .. my.length .. ")"
        else my._elements #(key + 1) = value
    else rawset(self, key, value);

array.__tostring = () :=> {
    let str = "[ ";
    let n = len my._elements;
    for i in range_inc n, {
        str = str .. tostring my._elements #i;
        if i < n, str = str .. ", ";
    };
    => str .. " ]";
};

array.count = () :=> len my._elements;

array.iter = () :=> {
    let i, n = 0, len my._elements;
    => () => {
        i = i + 1;
        if i <= n, => my._elements #i;
    };
};

array.ipairs = () :=> {
    let i, n = 0, len my._elements;
    => () => {
        i = i + 1;
        if i <= n, => (i, my._elements #i);
    };
};

array.first_index_of = item :=> >> 
    for i in range_inc len my._elements,
        if my._elements #i == item, => i - 1;

array.last_index_of = item :=> >> 
    for i in range_inc(len my._elements, 1, -1),
        if my._elements #i == item, => i - 1;

array.insert = (i, item) :=> >> table.insert(my._elements, i, item);

array.push_bottom = (i, item) :=> >> table.insert(my._elements, 1, item);

array.pop_bottom = (i, item) :=> >> table.remove(my._elements, 1);

array.push = item :=> {
    my._elements #(len my._elements + 1) = item;
    => item;
};

array.pop = () :=> {
    let n = len my._elements;
    let item = my._elements #n;
    my._elements #n = nil;
    => item;
};

array.remove_at = i :=> table.remove(my._elements, i + 1);

array.remove = item :=> >> for i, v in ipairs my._elements, if v == item, table.remove(my._elements, i);

array.contains = item :=> bool >> for _, v in ipairs my._elements, if item == v, => true;
array.has = array.contains;

array.get_elements = () :=> my._elements;

array.shallow_copy = () :=> array.from_table my._elements;

array.equal_to = (a, b) => {
    if len a._elements ~= len b._elements, => false;
    for i in range_inc len a._elements,
        if (a._elements #i) ~= (b.elements #i), => false;
    => true;
};

array.slice = (start_index, end_index) :=> {
    let sliced_table = tbl!;
    start_index = start_index + 1;

    if end_index == nil, end_index = len self._elements;

    let j = 1;
    for i in range_inc(start_index, end_index), {
        sliced_table #j = my._elements #i;
        j = j + 1;
    };

    => array.from_table sliced_table;
};

array.concat = (a, b) => {
    let c = a:shallow_copy!;
    let a_n = len a._elements;
    for i, v in b:ipairs!, c._elements #(a_n + i) = v;
    => c;
};

array.clear = () :=> >> for i in range_inc len my._elements, my._elements #i = nil;

array.first = () :=> my._elements #1;

array.last = () :=> my._elements #(len my._elements);

array.head = array.first;

array.tail = () :=> self:slice 1;

array.get = i :=> my._elements #(i + 1);

array.set_elements = t :=> {
    let t_n, my_n = len t._elements, len my._elements;
    let i = 1;

    while i <= t_n, {
        my._elements #i = t._elements #i;
        i = i + 1;
    };

    while i <= my_n, {
        my._elements #i = nil;
        i = i + 1;
    };
};

array.each_i = f :=> >> for i, v in ipairs(my._elements), f(i, v); 
array.each = f :=> >> for i, v in ipairs(my._elements), f v; 

array.set = (i, item) :=> {
    if (i < 0) || (i >= my.length), 
        error "Attempt to set out-of-bounds index in array: " .. index .. " -- Valid bounds are [0, " .. my.length .. ")"
    else {
        my._elements #(i + 1) = item;
        => item;
    };
};
```
