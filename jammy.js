const peg = require("pegjs");
const fs = require("fs");
const path = require("path");
const luamin = require("luamin");

const file_extension = f => f.substring(f.lastIndexOf(".") + 1);
const without_file_extension = f => f.substring(0, f.lastIndexOf("."));
const file_name = f => f.substring(f.lastIndexOf("/") + 1);
const relative_path = (dir, path) => path.startsWith(dir)? path.substring(dir.length + 1) : path;
const get_dir = f => f.substring(0, f.lastIndexOf("/"));
const join_path = (a, b) => path.join(a, b).toString().replace(/\\/g, '/');

// const grammarContents = fs.readFileSync(join_path(__dirname, "grammar"), "utf8");
// const parser = peg.generate(grammarContents);

const Scanner = require("./scanner").Scanner;
const Parser = require("./parser").Parser;

const evaluators = { };
const pretty = ast => JSON.stringify(ast, null, 2);

const loops = [ ];

const get_loop_depth = () => loops.length;
const current_loop = () => loops[loops.length - 1];

const scopes = [ ];

const current_scope = () => scopes[scopes.length - 1];

let current_filename;

let output = "";

const prepend = txt => {
    output = txt + output;
}

const emit = txt => {
    output += txt;
}

evaluators.nil = ast => {
    return "nil";
};

evaluators.array = ast => {
    return "array.new(" + ast.elements.map(x => evaluate(x)).join(", ") + ")";
}

evaluators.number = ast => {
    return ast.value;
}

evaluators.string = ast => {
    return "\"" + ast.value + "\"";
}

evaluators.fstring = ast => {
    return "string.format(\"" + ast.value + "\", " + ast.format_values.map(x => "tostring(" + evaluate(x) + ")").join(", ") + ")";
}

evaluators.variable = ast => {
    return ast.name;
}

const eval_wrap = ast => ast.type == "number"? ("(" + evaluate(ast) + ")") : evaluate(ast);

evaluators.index_object = ast => {
    return eval_wrap(ast.left) + "." + ast.name;
}

evaluators.index_key = ast => {
    return eval_wrap(ast.left) + "[" + evaluate(ast.key) + "]";
}

evaluators.method_call = ast => {
    return eval_wrap(ast.left) + "(" + ast.args.map(x => evaluate(x)).join(", ") + ")";
}

evaluators.self_method_call = ast => {
    return eval_wrap(ast.left) + ":" + ast.member + "(" + ast.args.map(x => evaluate(x)).join(", ") + ")";
}

evaluators.try_stmt = ast => {
    let txt = "";

    scopes.push({
        virtual_return_value: true,
        uses_return: false
    });

    let body = evaluate(ast.body);

    let s = scopes.pop();

    if(s.uses_return) {
        txt += "local __return_value; "
    }

    if (ast.on_fail) {
        txt += "if not pcall(function() " + body + " end) then " + evaluate(ast.on_fail) + " end"
    } 
    else {
        txt += "pcall(function() " + body + " end)";
    }

    if(s.uses_return) {
        txt += "; if __return_value then return unpack(__return_value) end; "
    }

    return txt;
}

evaluators.block_stmt = ast => {
    return "do " + ast.statements.map(x => evaluate(x)).join("; ") + "; end";
}

evaluators.block_expr = (ast, simplify = false) => {
    scopes.push({
        virtual_return_value: false
    });

    let body = ast.statements.map(x => evaluate(x)).join("; ");

    scopes.pop();

    if(simplify) return body;
    else return "(function() " + body + "; end)()";
}

evaluators.return_stmt = ast => {
    if(current_scope()) current_scope().uses_return = true;

    if (current_scope() && current_scope().virtual_return_value) {
        return "__return_value = {" + ast.values.map(x => evaluate(x)).join(", ") + "}; do return end";
    }
    else {
        return "do return " + evaluate(ast.value) + " end";
    }
}

evaluators.tuple = ast => {
    return ast.values.map(x => evaluate(x)).join(", ")
}

evaluators.bool = ast => {
    return ast.value;
}

evaluators.table = ast => {
    return "{ " + ast.entries.map(x => "[\"" + x.key + "\"] = " + evaluate(x.value)).join(", ") + " }";
}

const BINOP_REPLACE_TABLE = {
    "&&": " and ",
    "||": " or "
};

evaluators.binary_op = ast => {
    return "(" + evaluate(ast.left) + (BINOP_REPLACE_TABLE[ast.op] || ast.op) + evaluate(ast.right) + ")";
} 

const UNOP_REPLACE_TABLE = {
    "!": "not "
};

evaluators.unary_op = ast => {
    return (UNOP_REPLACE_TABLE[ast.op] || ast.op) + "(" + evaluate(ast.right) + ")";
};

evaluators.var_dec = ast => {
    let txt = "local " + ast.variables.join(", ");
    if (ast.values)
        txt += " = " + ast.values.map(x => evaluate(x)).join(", ");
    return txt;
}

evaluators.var_assign = ast => {
    return ast.leftHand.map(x => evaluate(x)).join(", ") + " = " + ast.values.map(x => evaluate(x)).join(", ");
};

evaluators.brackets = ast => {
    return "(" + evaluate(ast.content) + ")";
};

evaluators.match_stmt = ast => {
    let txt = "local __match_val = " + evaluate(ast.value) + "; " + ast.cases.map(x => "if (__match_val) == (" + evaluate(x.case) + ") then " + evaluate(x.value) + " else").join("")
    if(ast.default) {
        txt += " " + evaluate(ast.default);
    }
    return txt + " end";
}

evaluators.match_expr = (ast, simplify = false) => {
    let txt = "local __match_val = " + evaluate(ast.value) + "; ";
    txt += ast.cases.map(x => "if __match_val == (" + evaluate(x.case) + ") then " + evaluate_functiony(x.value) + " else").join("")
    if(ast.default) {
        txt += " " + evaluate_functiony(ast.default);
    }
    return to_expr(txt + " end", simplify);
}

const replace_all = (str, from, to) => {
    while(str.includes(from))
        str = str.replace(from, to);
    return str;
}

const do_loop_body = (ast) => {
    loops.push({ 
        uses_break: false,
        uses_continue: false
    });

    let depth = get_loop_depth();
    let body = evaluate(ast);

    let loop = loops.pop();

    if(loop.uses_break) {
        if(loop.uses_continue) {
            body = replace_all(body, "<[" + depth + " CONTINUE]>", "break");
            body = replace_all(body, "<[" + depth + " BREAK]>", "__broken = true; break");
            return "local __broken = false; repeat " + body + " until true; if __broken then break end; "
        }
        else {
            body = replace_all(body, "<[" + depth + " BREAK]>", "break");
            return body;
        }
    }
    else if (loop.uses_continue) {
        body = replace_all(body, "<[" + depth + " CONTINUE]>", "break");
        return "repeat " + body + " until true; "
    }
    else {
        return body;
    }
}

evaluators.for_in_stmt = ast => {
    // console.log(ast);
    if(ast.iterator.type == "method_call" 
    && ast.iterator.left.type == "variable"
    && ast.iterator.args.length > 0
    && ast.iterator.args.length < 4
    && (ast.iterator.left.name == "range_inc"
    || ast.iterator.left.name == "range")) {
        
        if(ast.iterator.args.length == 1) {
            if(ast.iterator.left.name == "range") {
                return "for " + ast.variables[0] + " = 0, ((" + evaluate(ast.iterator.args[0]) + ")-1) do " + do_loop_body(ast.body) + " end";
            }
            else {
                return "for " + ast.variables[0] + " = 1, " + evaluate(ast.iterator.args[0]) + " do " + do_loop_body(ast.body) + " end";
            }
        }
        else if(ast.iterator.args.length == 2) {
            if(ast.iterator.left.name == "range") {
                return "for " + ast.variables[0] + " = " + evaluate(ast.iterator.args[0]) + ", ((" + evaluate(ast.iterator.args[1]) + ")-1) do " + do_loop_body(ast.body) + " end";
            }
            else {
                return "for " + ast.variables[0] + " = " + evaluate(ast.iterator.args[0]) + ", " + evaluate(ast.iterator.args[1]) + " do " + do_loop_body(ast.body) + " end";
            }
        }
        else if(ast.iterator.args.length == 3) {
            if(ast.iterator.left.name == "range") {
                let incr = evaluate(ast.iterator.args[2]);
                if(incr == "1") {
                    return "for " + ast.variables[0] + " = " + evaluate(ast.iterator.args[0]) + ", ((" + evaluate(ast.iterator.args[1]) + ")-1) do " + do_loop_body(ast.body) + " end";
            
                }
                else if(incr == "-(1)") {
                    return "for " + ast.variables[0] + " = " + evaluate(ast.iterator.args[0]) + ", ((" + evaluate(ast.iterator.args[1]) + ")+1), -1 do " + do_loop_body(ast.body) + " end";
                }
                else {
                    return "local __incr = " + incr + "; for " + ast.variables[0] + " = " + evaluate(ast.iterator.args[0]) + ", ((" + evaluate(ast.iterator.args[1]) + ")-math.sign(__incr)), __incr do " + do_loop_body(ast.body) + " end";
                }
            }
            else {
                return "for " + ast.variables[0] + " = " + evaluate(ast.iterator.args[0]) + ", " + evaluate(ast.iterator.args[1]) + ", " + evaluate(ast.iterator.args[2]) + " do " + do_loop_body(ast.body) + " end";
            }
        }
    }
    else {
        return "for " + ast.variables.join(", ") + " in " + evaluate(ast.iterator) + " do " + do_loop_body(ast.body) + " end";
    }
};


const cached_modules = { };

const get_import_params = p => {

    if(!p.endsWith(".jam")) return { };
    if(cached_modules[p]) return cached_modules[p];
    
    const file_contents = fs.readFileSync(p, "utf-8").trim();
    if(!file_contents.startsWith("/** import_parameters")) {
        cached_modules[p] = { };
        return;
    }

    let i = 21;
    let content = "";
    while ((i < file_contents.length - 1) && (file_contents[i] != "*" || file_contents[i + 1] != "/")) {
        content += file_contents[i];
        i++;
    }

    let parsed = { };
    try { 
        parsed = JSON.parse(content); 
    } catch { };
    return parsed;
};

evaluators.use = ast => {
    const lua_path = without_file_extension(ast.path).toString().replace(/\\/g, '/');
    const real_path = join_path(__dirname, ast.path);
    const params = get_import_params(real_path);

    let txt = "";
    const the_import = ast.path.startsWith("std/")? 
        `require(path_join(__root_dir, "${lua_path}"):gsub(\"/\", \".\"))`
        : `import("${lua_path}")`;
    
    if(params.set && params.set.length > 0) {
        txt += "local " + params.set.join(", ") + " = __import(" + (params.set.length) + ", {" + params.set.join(", ") + "}, " + the_import + ");" + params.set.map(x => "__env." + x).join(", ") + " = " + params.set.join(", ");
    }
    else {
        txt += the_import;
    }

    if(params.append) {
        txt += ";" + params.append;
    }

    return txt;
}

evaluators.resume = ast => {
    return "coroutine.resume(" + [ evaluate(ast.coroutine), ...ast.arguments.map(x => evaluate(x)) ].join(", ") + ")";
};

const SIMPLIFY_IF_RETURNING = [
    "block_expr",
    "if_expr",
    "try_expr",
    "match_expr"
];

const evaluate_functiony = ast => {
    return SIMPLIFY_IF_RETURNING.includes(ast.type)? evaluate(ast, true) : ("return " + evaluate(ast));
};

const BAD_SELF_TEXT = `bad argument 'self' to `;
evaluators.function = ast => {
    if(ast.takesSelf) {
        ast.args.unshift({ name: "self" });
    }
    
    let txt;

    if(ast.variadic) {
        let variadicArg = ast.args.pop();
        ast.args.push({ name: "..." });
        txt = "function(" + ast.args.map(x => x.name).join(", ") + ") ";
        txt += "local " + variadicArg.name + " = {...} ";
    }
    else {
        txt = "function(" + ast.args.map(x => x.name).join(", ") + ") ";
    }

    if(ast.takesSelf && ast.selfType) {
        txt += `if not is_subclass(self, (${evaluate(ast.selfType)})) then error("bad argument 'self' to " .. debug.getinfo(1, 'nl').name .. " (got " .. type(self) .. ")", 2) end; `
    }

    if(ast.args.some(x => x.value)) {
        txt += ast.args.map(x => x.value? `${x.name} = ${x.name} == nil and (${evaluate(x.value)}) or ${x.name};` : "").join("");
    }

    if(ast.args.some(x => x.type)) {
        for (let i = 0; i < ast.args.length; i++) {
            const offset = ast.takesSelf? 0 : 1;
            const arg = ast.args[i];
            if(arg.type) {
                const optional = arg.type.optional? "_optional" : "";
                if(arg.type.allowed.length == 1) {
                    txt += `__typecheck_arg${optional}(${i + offset}, ${arg.name}, "${arg.type.allowed[0]}");`;
                }
                else {
                    
                    txt += `__typecheck_arg_union${optional}(${i + offset}, ${arg.name}, { ${arg.type.allowed.map(x => "\"" + x + "\"").join(",")} });`;
                }
            }
        }
        // txt += "__typecheck(" + ast.args.map(x => "\"" + (x.type || "?") + "\"") + ");";
    }

    txt += evaluate_functiony(ast.body) + " end";
    
    if(ast.isCoroutine)
        txt = "coroutine.create(" + txt + ")";

    return txt;
}

evaluators.super_call = ast => {
    return "self.super." + ast.name + "(" + ast.args.map(x => evaluate(x)).join(", ") + ")";
};

evaluators.try_expr = (ast, simplify = false) => {
    let txt = "";
    if(ast.on_fail) {
        txt += "local __return_values = { pcall(function() " + evaluate_functiony(ast.body) + " end) }; "
        txt += "if not __return_values[1] then " + evaluate_functiony(ast.on_fail) + " end; "
        txt += "return select(2, unpack(__return_values))"
        return to_expr(txt, simplify);
    }
    else {
        return "select(2, pcall(function() " + evaluate_functiony(ast.body) + " end))";
    }
}

evaluators.if_stmt = ast => {
    let txt = "if " + evaluate(ast.condition) + " then " + evaluate(ast.true_branch);
    if (ast.false_branch) {
        txt += " else " + evaluate(ast.false_branch);
    }
    return txt + " end";
}

const to_expr = (contents, simplify = false) => {
    return simplify? contents : ("(function() " + contents + " end)()");
}

evaluators.if_expr = (ast, simplify = false) => {
    return to_expr("if " + evaluate(ast.condition) 
        + " then " + evaluate_functiony(ast.true_branch) 
        + (ast.false_branch? (" else " + evaluate_functiony(ast.false_branch)) : "") + " end", simplify);
}

evaluators.while_stmt = ast => {
    return "while " + evaluate(ast.condition) + " do " + do_loop_body(ast.body) + " end";
}

evaluators.continue_stmt = ast => {
    current_loop().uses_continue = true;
    return "<[" + get_loop_depth() + " CONTINUE]>";
}

evaluators.break_stmt = ast => {
    current_loop().uses_break = true;
    return "<[" + get_loop_depth() + " BREAK]>";
}

evaluators.len = ast => {
    return "#(" + evaluate(ast.value) + ")";
}

const evaluate = (ast, ...settings) => {
    const found = evaluators[ast.type];
    if(found) return found(ast, ...settings);
    else throw "No evaluation function for " + pretty(ast);
}

const translate = filename => {
    
    const source = fs.readFileSync(filename, "utf8");
    let ast;

    try {
        const scanner = new Scanner();
        const tokens = scanner.scan(source);
        const parser = new Parser();
        ast = parser.parse(tokens);
        // console.log(JSON.stringify(ast, null, 2));
    }
    catch  (errors) {
        const lines = source.split("\n");
        console.log("\n");

        for (const err of errors) {
            try {
                const pos = err.token? err.token.pos : err.pos;
                const length = err.token? err.token.pos.length : 1;
    
                let text = "";
                text += err.message;
                text += "\n     | \n";
                text += pos.ln.toString().padStart(4) + " | " + lines[pos.ln - 1] + "\n";
                
                text += "     | ";
                for (let i = 0; i < pos.col - 1; i++) {
                    text += " ";
                }
                for (let i = 0; i < length; i++) {
                    text += "^"
                }
                text += "\n";
    
                console.log(text);
                // console.log(err);
            }
            catch {
                console.log("There was an error displaying this error. Here is an uglier version of the error:");
                console.log(err);
            }
        }

        return;
    }

    for (const stmt of ast) {
        emit(evaluate(stmt) + "; ");    
    }

    const emitted = output;
    output = "";
    return emitted;
}

const preface = luamin.minify(fs.readFileSync(join_path(__dirname, "jammy_header.lua"), "utf-8"));

const compile = (filename, mode = "file") => {
    let txt = "-- " + filename + " - GENERATED " + new Date().toLocaleString() + "\n";
    current_filename = filename;
    txt += "-- JAMMY BOILERPLATE\n";

    // IMPLEMENTS "use"
    if(mode == "love_entry_point") {
        txt += `local import = require;__root_dir = "";`;
    }
    else {
        if (mode == "entry_point") {
            txt += `local __parent_dir;arg[0] = arg[0]:gsub("\\\\", "/");if arg[0]:find("/") then __parent_dir = arg[0]:match("(.*/)") else __parent_dir = "" end;__root_dir=__parent_dir;`;
        }
        else {
            txt += `local __require_params = (...);if not __require_params then error("Cannot run this module because it was not compiled as an entry point.") end;local __parent_dir = __require_params:match("(.-)[^%.]+$"):gsub("%.", "/");`;
        }
    
        txt += `local function import(path) return require(path_join(__parent_dir, path):gsub("/", ".")) end;`;    
    }
    
    // ----------------

    if(mode == "library" || mode == "entry_point" || mode == "love_entry_point") {
        txt += preface + "; ";
    }
    
    txt += "__env = { };setmetatable(__env, { __index = _G });";
        
    txt += "\n-- END JAMMY BOILERPLATE\n";

    const translated = translate(filename);

    if(translated)
        return minify? luamin.minify(txt + translated) : (txt + translated.replace(/; /g, ";\n"));
    else return;
}

let compiled_entry_point = false;

const compile_dir = (dir, out, settings) => {

    if(!fs.existsSync(out)) {
        process.stdout.write(out + " ... ");
        fs.mkdirSync(out);
        process.stdout.write(" CREATED.\n");
    }

    const items = fs.readdirSync(dir);
    for (const item of items) {
        const stat = fs.statSync(join_path(dir, item));
        if(stat.isDirectory()) {
            compile_dir(join_path(dir, item), join_path(out, item), settings);
        }
        else {
            if(file_extension(item) == "jam") {
                
                process.stdout.write(join_path(dir, item) + " -> " + join_path(out,  without_file_extension(item) + ".lua ..."));
                let text;
                if (settings && (settings.compile_mode == "program" || settings.compile_mode == "love")) {
                    const is_entry_point = (join_path(dir, item)) == join_path(dir, settings.entry_file);
                    text = compile(join_path(dir, item), is_entry_point? (settings.compile_mode == "love"? "love_entry_point" : "entry_point") : "file");
                    if(is_entry_point)
                        compiled_entry_point = true;
                }
                else if(settings && settings.compile_mode == "library") {
                    text = compile(join_path(dir, item), "library");
                }
                else {
                    text = compile(join_path(dir, item), "file");
                }

                if(text) {
                    fs.writeFileSync(join_path(out, without_file_extension(item) + ".lua"), text);
                    process.stdout.write(" OK.\n");
                }
            }
            else {

                process.stdout.write(join_path(dir, item) + " -> " + join_path(out, item) + " ...");
                if(minify && file_extension(item) == "lua") {
                    fs.writeFileSync(join_path(out, item), luamin.minify(fs.readFileSync(join_path(dir, item), "utf-8")));
                }
                else {
                    fs.copyFileSync(join_path(dir, item), join_path(out, item));
                }
                process.stdout.write(" OK.\n");
            }
        }
    }
}


const { Command } = require("commander");
const program = new Command();
program.version("0.1.0");

program.addHelpText("before", 
`
Compile modes are: program, library, file
program -- A program to be run using 'lua <file>.lua'
love -- Like program mode but compatible with Love2D. The entry point must be main.jam
library -- A library to be referenced by other Lua or jammy files
file -- Raw compilation without prepending the jammy header
`);

program.usage("<compile mode> <source directory> <output directory> [options...]");
program.option("-e, --entry <file>", "Program mode only. Specifies the entry point of the program", "main.jam");
program.option("-s, --no-std", "Copies the jammy standard library");
program.option("-m, --minify", "Minifies compiled files (including Lua files)");

program.parse(process.argv);

if(process.argv.length < 3) {
    console.log(program.help());
    process.exit(0);
}

const compile_mode = program.args[0].toLowerCase();
const src_dir = program.args[1].replace(/\\/g, "/");
const out_dir = program.args[2].replace(/\\/g, "/");;

const options = program.opts();
const entry_file = options.entry.replace(/\\/g, "/");
const minify = options.minify;

compiled_entry_point = false;

console.log("Compiling '" + src_dir + "' ...");
compile_dir(src_dir, out_dir, {
    compile_mode: compile_mode,
    entry_file: compile_mode == "love"? "main.jam" : entry_file
});

// console.log(options);
if((compile_mode == "program" || compile_mode == "love") && options.std) {
    console.log("Compiling standard library...");
    compile_dir(join_path(__dirname, "std").replace(/\\/g, "/"), join_path(out_dir, "std"), {
        compile_mode: "file"
    });
}

if((compile_mode == "program" || compile_mode == "library") && !compiled_entry_point)
    console.log(" * NOTE: The entry file '" + entry_file + "' was not found, and was not compiled.");
