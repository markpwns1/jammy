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

const grammarContents = fs.readFileSync(join_path(__dirname, "grammar"), "utf8");
const parser = peg.generate(grammarContents);

const evaluators = { };
const pretty = ast => JSON.stringify(ast, null, 2);

const loops = [ ];

const get_loop_depth = () => loops.length;
const current_loop = () => loops[loops.length - 1];

const scopes = [ ];

const current_scope = () => scopes[scopes.length - 1];



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

evaluators.variable = ast => {
    return ast.name;
}

evaluators.index_object = ast => {
    return evaluate(ast.left) + "." + ast.name;
}

evaluators.index_key = ast => {
    return evaluate(ast.left) + "[" + evaluate(ast.key) + "]";
}

evaluators.method_call = ast => {
    return evaluate(ast.left) + "(" + ast.args.map(x => evaluate(x)).join(", ") + ")";
}

evaluators.self_method_call = ast => {
    return evaluate(ast.left) + ":" + ast.member + "(" + ast.args.map(x => evaluate(x)).join(", ") + ")";
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
    return "do " + ast.statements.map(x => evaluate(x)).join("; ") + " end";
}

evaluators.block_expr = (ast, simplify = false) => {
    scopes.push({
        virtual_return_value: false
    });

    let body = ast.statements.map(x => evaluate(x)).join("; ");

    scopes.pop();

    if(simplify) return body;
    else return "(function() " + body + " end)()";
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
    return "{ " + ast.entries.map(x => x.key + " = " + evaluate(x.value)).join(", ") + " }";
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

evaluators.match_expr = ast => {
    let txt = "(function() local __match_val = " + evaluate(ast.value) + "; " + ast.cases.map(x => "if (__match_val) == (" + evaluate(x.case) + ") then return " + evaluate(x.value) + " else").join("")
    if(ast.default) {
        txt += " return " + evaluate(ast.default);
    }
    return txt + " end end)()";
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
    return "for " + ast.variables.join(", ") + " in " + evaluate(ast.iterator) + " do " + do_loop_body(ast.body) + " end";

    // return local __broken = false; repeat " + evaluate(ast.body) + " until true; if __broken then break end; end"; 
};

// const USE_FEATURES = {
//     "arrays": "local array = require('std."
// }

evaluators.use = ast => {
    return "__use(" + evaluate(ast.path) + ")"
}

evaluators.resume = ast => {
    return "coroutine.resume(" + [ evaluate(ast.coroutine), ...ast.arguments.map(x => evaluate(x)) ].join(", ") + ")";
};

const evaluate_functiony = ast => {
    return (ast.type == "block_expr")? evaluate(ast, true) : ("return " + evaluate(ast));
};

evaluators.function = ast => {
    if(ast.takesSelf)
        ast.args.unshift("self");
    
    let txt;
    if(ast.variadic) {
        let variadicArg = ast.args.pop();
        ast.args.push("...");
        txt = "function(" + ast.args.join(", ") + ") ";
        txt += variadicArg + " = {...} ";
    }
    else {
        txt = "function(" + ast.args.join(", ") + ") ";
    }

    txt += evaluate_functiony(ast.body) + " end";
    
    if(ast.isCoroutine)
        txt = "coroutine.create(" + txt + ")";

    return txt;
}

evaluators.try_expr = ast => {
    let txt = "(function() local __return_value; ";
    let body = evaluate(ast.body);
    if(ast.on_fail) {
        txt += "if not pcall(function() __return_value = { " + body + " } end) then return " + evaluate(ast.on_fail) + " end; ";
    }
    else {
        txt += "pcall(function() __return_value = {" + body + "} end); "
    }
    return txt + "return unpack(__return_value); end)()";
}

evaluators.if_stmt = ast => {
    let txt = "if " + evaluate(ast.condition) + " then " + evaluate(ast.true_branch);
    if (ast.false_branch) {
        txt += " else " + evaluate(ast.false_branch);
    }
    return txt + " end";
}

evaluators.if_expr = ast => {
    return "(function() if " + evaluate(ast.condition) 
        + " then return " + evaluate(ast.true_branch) 
        + " else return " + evaluate(ast.false_branch) + " end end)()";
}

evaluators.while_stmt = ast => {
    return "while " + evaluate(ast.condition) + " do local __broken = false; repeat " + evaluate(ast.body) + " until true; if __broken then break end; end";
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

// gets rid of comments
const preprocess = txt => {
    let out = "";
    let i = 0;
    while (i < txt.length) {
        if(txt[i] == "/") {
            if(i < (txt.length - 1) && txt[i + 1] == "/") {
                i += 2;
                while(txt[i] != "\n")
                    i++;
                i++;
                continue;
            }
            else if(i < (txt.length - 1) && txt[i + 1] == "*") {
                i += 2;
                while(txt[i] != "*" || txt[i + 1] != "/")
                    i++;
                i += 2;
                continue;
            }
            else {
                out += txt[i];
            }
        }
        else {
            out += txt[i];
        }
        i++;
    }
    return out;
}

const expected_to_string = expected => {
    if(expected.type == "end") {
        return "end of file";
    }
    else if(expected.type == "other") {
        return expected.description;
    }
    else if (expected.type == "literal") {
        return "'" + expected.text + "'";
    }
    else return JSON.stringify(expected);
}

const translate = filename => {
    
    const source = preprocess(fs.readFileSync(filename, "utf8"));
    let ast;

    try {
        ast = parser.parse(source);
    }
    catch  (err) {
        if (!err.hasOwnProperty('location')) throw(err);
    
        let lines = source.split("\n");
    
        let expected = err.expected.map(x => expected_to_string(x));
        expected = expected.filter((item, pos) => expected.indexOf(item) == pos);

        let text = "";
        text += "\nSYNTAX ERROR @ Ln " + err.location.start.line + ", col " + err.location.start.column + "\n";
        text += "     | \n";
        text += err.location.start.line.toString().padStart(4) + " | " + lines[err.location.start.line - 1] + "\n";
        
        text += "     | ";
        for (let i = 0; i < err.location.start.column - 1; i++) {
            text += " ";
        }
        text += "^";

        text += "\nUnexpected \"" + err.found + "\" -- expected one of:\n" + expected.map(x => " - " + x + "\n").join("");
        // console.log(err);
        
        
        console.log(text);
    
        process.exit(1);
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
    txt += "-- JAMMY BOILERPLATE\n";

    // IMPLEMENTS "use"
    if(mode == "love_entry_point") {
        txt += `local __use = require;`;
    }
    else {
        if (mode == "entry_point") {
            txt += `local __parent_dir;arg[0] = arg[0]:gsub("\\\\", "/");if arg[0]:find("/") then __parent_dir = arg[0]:match("(.*/)") else __parent_dir = "" end;`;
        }
        else {
            txt += `local __require_params = (...);if not __require_params then error("Cannot run this module because it was not compiled as an entry point.") end;local __parent_dir = __require_params:match("(.-)[^%.]+$"):gsub("%.", "/");`;
        }
    
        txt += `local function a(b,c)b,c=b:gsub("\\\\","/"),c:gsub("\\\\","/")local d,e={},{}for f in b:gmatch("[^/]+")do table.insert(d,f)end;for f in c:gmatch("[^/]+")do table.insert(e,f)end;for g,h in ipairs(e)do if h==".."then d[#d]=nil else d[#d+1]=h end end;return table.concat(d,"/")end local function __use(path) return require(a(__parent_dir, path):gsub("/", ".")) end;`;    
    }
    
    // ----------------

    if(mode == "library" || mode == "entry_point") 
        txt += preface + "; ";
        
    txt += "\n-- END JAMMY BOILERPLATE\n";

    return minify? luamin.minify(txt + translate(filename)) : (txt + translate(filename).replace(/;/g, "\n"));
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

                fs.writeFileSync(join_path(out, without_file_extension(item) + ".lua"), text);
                process.stdout.write(" OK.\n");
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

if(compile_mode == "program" && options.std) {
    console.log("Compiling standard library...");
    compile_dir(join_path(__dirname, "std").replace(/\\/g, "/"), join_path(out_dir, "std"), {
        compile_mode: "library"
    });
}

if(compile_mode == "program" && !compiled_entry_point)
    console.log(" * NOTE: The entry file '" + entry_file + "' was not found, and was not compiled.");
