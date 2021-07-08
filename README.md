# Jammy

Jammy is an original programming language written in NodeJS that transpiles to Lua, designed with speed of iteration as a priority. It's named Jammy because it's designed for writing Love2D games as fast as possible for game jams.

## Installation
- `git clone https://github.com/markpwns1/jammy`
- `npm install`

## Usage
There are two main "modes" in which the Jammy compiler operates.

### Program mode
Run `node jammy.js program <src dir> <out dir> [-e <entry file>]` to compile an entire directory. You can then run this file by running the entry file in lua. For example:
```
> node jammy.js program src out -e myprogram.jam
> lua out/myprogram.lua
Hello world!
```
The path to the entry file must be relative to the source directory. In the example above, the entry file is located at `src/program.jam`. By default, the entry file is `main.jam`.

### Library mode
Run `node jammy.js library src out` to compile an entire directory *as a library.* This allows any compiled file to be `require()`-ed by Lua files or `use`-d by Jammy files and work fine.

### Compiler flags
- `-V, --version` output the version number
- `-e, --entry <file>` Program mode only. Specifies the entry point of the program (default: "main.jam")
- `-s, --no-std` Copies the jammy standard library
- `-m, --minify` Minifies compiled files (including Lua files)
- `-h, --help` display help for command
