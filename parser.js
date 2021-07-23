const { Token } = require("./token");
const SYMBOLS = require("./symbols").SYMBOLS;

const FRIENDLY_NAMES = {
    ...objectFlip(SYMBOLS),
    "identifier": "a word",
    "number": "a number",
    "string": "a string"
}

function ast(type, props) {
    return {
        type: type,
        ...props
    }
}

const BINARY_OPS = {
    "neq": "~=",
    "eq": "==",
    "geq": ">=",
    "leq": "<=",
    "str_concat": "..",
    "and": "&&",
    "or": "||",
    "floor_div": "//",
    "plus": "+",
    "minus": "-",
    "times": "*",
    "divide": "/",
    "lt": "<",
    "gt": ">",
    "percent": "%",
    "exponent": "^"
};

function friendlyName(type) {
    return FRIENDLY_NAMES[type] || type;
}

function objectFlip(obj) {
    const ret = {};
    Object.keys(obj).forEach(key => {
      ret[obj[key]] = "'" + key + "'";
    });
    return ret;
}

function leftify(x) {
    if(x.right.type == "binary_op" && x.right.right) {
        const r = x.right;
        x.right = r.left;
        r.left = x;
        return leftify(r);
    }
    else {
        return x;
    }
}

function leftifyArray(head, tail) {
    for(const i of tail) {
        i.left = head;
        head = i;
    }
    return head;
}

const KEYWORDS = [
    "else",
    "in"
];

function tts(token) {
    return token.friendlyName || token;
}

exports.Parser = class Parser {

    current = 0;
    tokens = [ ];

    generateError(message, token) {
        if(!token) token = this.tokens[this.current];
        const e = Error("SYNTAX ERROR @ Ln " + token.pos.ln + ", col " + token.pos.col + " -- " + message);
        e.token = token;
        return e;
    }

    /**
     * 
     * @param {number} type 
     * @returns {Token}
     */
    peek(n = 0) {
        return ((this.current + n) < this.tokens.length)? this.tokens[this.current + n] : this.tokens[this.tokens.length - 1];
    }

    /**
     * 
     * @param {string} type 
     * @returns {Token}
     */
    eat(expected) {
        const t = this.peek();
        if(expected && t.type != expected) 
            throw this.generateError("Expected " + friendlyName(expected) + " but got " + tts(t));
        this.current++;
        return t;
    }

    /**
     * 
     * @param {string[]} type 
     * @returns {Token}
     */
    expect(unexpected, unexpectedText) {
        const t = this.peek();
        if(!unexpected.includes(t.type))
            throw this.generateError("Expected " + unexpectedText + " but got " + tts(t));
        return t;
    }

    match(...expected) {
        const t = this.peek();
        if(expected.includes(t.type)) return t;
        return false;
    }

    back(n = 1) {
        this.current -= n;
    }

    identifierIs(keyword) {
        const t = this.peek();
        return t.type == "identifier" && t.value == keyword;
    }

    eatIdentifier(expectedValue) {
        const val = this.eat("identifier").value;
        if(val != expectedValue) 
            throw this.generateError("Expected '" + expectedValue + "' but got '" + val + "'");
    }

    matchIdentifier(...expected) {
        const t = this.peek();
        if(t.type == "identifier" && expected.includes(t.value)) {
            this.eat();
            return t.value;
        }
        return false;
    }

    tryMatch(testFunc, ast) {
        const before = this.current;
        let failed = false;
        try {
            testFunc.bind(this)();
        } catch { 
            failed = true; 
        }

        this.current = before;

        if(!failed) return ast.bind(this)();
    }

    tryNotMatch(testFunc, ast) {
        const before = this.current;
        let failed = false;
        try {
            testFunc.bind(this)();
        } catch { 
            failed = true; 
        }

        this.current = before;

        if(failed) return ast.bind(this)();
    }

    parse(t) {
        this.tokens = t;
        return this.doBlockStatements();
    }

    parseExpression(t) {
        this.tokens = t;
        return this.expression();
    }

    doBlockStatements(...terminators) {
        const errors = [ ];
        const statements = [ ];
        
        while(!this.match("EOF", ...terminators)) {
            try {
                statements.push(this.statement());
                this.eat("semicolon");
            }
            catch (e) {

                if (Array.isArray(e)) {
                    for (const err of e) {
                        errors.push(err);
                    }
                }
                else {
                    errors.push(e);
                }

                while(!this.match("EOF", "semicolon", ...terminators)) this.eat();
                if(this.match(...terminators)) {
                    break;
                } else {
                    this.eat();
                };
            }
        }

        if(errors.length > 0) throw errors;

        return statements;
    }

    identifierStatement() {
        const head = this.index(false);
        if(head.type == "method_call" || head.type == "self_method_call") {
            return head;
        }

        const lchain = [ head ];
        while(this.match("comma")) {
            this.eat();
            lchain.push(this.lhand());
        }

        this.eat("equals");

        const rchain = this.expressionList();

        return ast("var_assign", {
            leftHand: lchain,
            values: rchain
        });
    }

    statement() {
        const t = this.peek();
        switch(t.type) {
            case "open_curly": return this.block(false);

            case "arrow": {
                this.eat();
                return ast("return_stmt", {
                    value: this.expression()
                });
            }

            case "at": {
                const funccall = this.tryMatch(() => {
                    this.eat();
                    this.eat("identifier");
                    const f = this.fullFuncCall(false);
                    if(!f) throw "nope";
                }, () => {
                    this.eat();
                    const name = this.eat("identifier").value;
                    const args = this.fullFuncCall(false);
                    return ast("self_method_call", {
                        left: {
                            type: "variable",
                            name: "self"
                        },
                        member: name,
                        args: args
                    });
                });
                if(funccall) return funccall;
                else return this.identifierStatement();
            }

            case "identifier": {
                switch(t.value) {
                    case "export": {
                        this.eat();
                        const name = this.eat("identifier").value;
                        let as = name;
                        if(this.matchIdentifier("as")) {
                            as = this.eat("identifier").value;
                        }
                        return ast("export", {
                            value: name,
                            as: as
                        });
                    }

                    case "prototype": return this.prototype();

                    case "super": {
                        this.eat();
                        return this.super(false);
                    }

                    case "let": return this.letStmt();

                    case "if": {
                        this.eat();
                        return this.ifExpr(false);
                    }

                    case "try": {
                        this.eat();
                        return this.tryExpr(false);
                    }

                    case "for": return this.forLoop();

                    case "while": return this.whileLoop();

                    case "use": {
                        this.eat();
                        const str = this.eat("string");
                        if(str.interpolations.length > 0)
                            throw this.generateError("File paths within use statements cannot contain string interpolations", str);
                        return ast("use", {
                            path: str.value
                        });
                    }

                    case "break": {
                        this.eat();
                        return ast("break_stmt");
                    }

                    case "continue": {
                        this.eat();
                        return ast("continue_stmt");
                    }

                    case "match": {
                        this.eat();
                        return this.matchExpr(false);
                    }

                    default: return this.identifierStatement();
                }
            }

            default: {
                return this.funcCallStatement();
                // throw this.generateError("Expected a statement but got " + tts(t));
            }
        }
    }

    not(unexpected) {
        const t = this.eat();
        if(t.type == unexpected) throw this.generateError("Expected any token except for " + tts(t));
        return t;
    }

    identifierList() {
        const lchain = [ this.eat("identifier").value ];
        while(this.match("comma")) {
            this.eat();
            lchain.push(this.eat("identifier").value);
        }
        return lchain;
    }

    prototype() {
        this.eat();
        const name = this.eat("identifier").value;
        let extending;
        if(this.matchIdentifier("from")) {
            extending = this.eat("identifier").value;
        }
        const table = this.table(["semicolon"]);
        return ast("class", {
            name: name,
            extending: extending,
            table: table
        });
    }

    letStmt(valueRequired = false) {
        this.eat();
        
        const lchain = this.identifierList();

        let rchain;
        if(valueRequired || this.match("equals")) {
            this.eat("equals");
            rchain = this.expressionList();
        }
        
        return ast("var_dec", {
            variables: lchain,
            values: rchain
        });
    }

    whileLoop() {
        this.eat();
        const cond = this.expression();
        this.eat("comma");
        const body = this.statement();
        return ast("while_stmt", {
            condition: cond,
            body: body
        });
    }

    forLoop(isExpr = false) {
        this.eat();

        let vars;
        if(this.match("identifier") && this.peek().value != "in") {
            vars = this.identifierList();
        }
        else {
            vars = [ "_" ];
        }

        this.eatIdentifier("in");

        const iterator = this.expression();
        this.eat("comma");
        const body = isExpr? this.expression() : this.statement();

        return ast(isExpr? "for_in_expr" : "for_in_stmt", {
            variables: vars,
            iterator: iterator,
            body: body
        });
    }

    lhand() {
        const chain = this.index(false);
        if(chain.type != "index_key" && chain.type != "index_object" && chain.type != "variable") {
            throw this.generateError("The left-hand of an assignment must end in a field, variable, or index");
        }
        return chain;
    }

    funcCallStatement() {
        const chain = this.index(false);
        if(chain.type != "method_call" && chain.type != "self_method_call") {
            throw this.generateError("Expected a function call but got " + tts(this.peek()));
        }
        return chain;
    }

    expression() {
        const t = this.peek();
        switch(t.type) {
            case "ellipses": {
                this.eat();
                return ast("method_call", {
                    left: ast("variable", {
                        name: "unpack"
                    }),
                    args: [ this.index(true) ]
                });
            }

            case "open_paren": {

                const tpl = this.tryMatch(this.tuple,
                () => {
                    return this.tryNotMatch(() => {
                        this.eat();
                        this.expressionList();
                        this.eat("close_paren");
                        
                        this.expect(["arrow", "penis", "open_square"])
    
                        if(this.eat().type == "open_square") {
                            this.expression();
                            this.eat("close_square");
                            this.eat("penis");
                        }
                    }, this.tuple);
                });

                if(tpl) return tpl;
                else return this.binary();
            }

            case "open_curly": {
                if(this.peek(1).type == "close_curly") {
                    return this.binary();
                }
                else if(this.peek(1).type == "identifier") {

                    let blockExpr = this.tryNotMatch(() => {
                        this.eat();
                        this.eat("identifier");
                        this.eat("colon");
                    }, () => this.block(true));

                    blockExpr = blockExpr || this.tryMatch(() => {
                        this.eat();
                        this.statement();
                        this.eat("semicolon");
                    }, () => this.block(true));
    
                    if(blockExpr) return blockExpr;
                    else return this.binary();
                }
                else return this.block(true);
            }

            default: {
                return this.binary();
            }
        }
    }

    block(isExpr = false) {
        this.eat("open_curly");

        const head = this.statement();

        this.eat("semicolon");

        const statements = [ head, ...this.doBlockStatements("close_curly") ];

        this.eat();

        return ast(isExpr? "block_expr" : "block_stmt", {
            statements: statements
        });
    }

    tuple() {
        this.eat("open_paren");
        const head = this.expression();
        this.eat("comma");
        const tail = this.expressionList();
        this.eat("close_paren");
        return ast("tuple", {
            values: [head, ...tail]
        });
    }

    matchExpr(isExpr = true) {
        let var_decs;
        if(this.match("open_paren")) {
            this.eat();
            var_decs = this.letStmt(true);
            this.eat("close_paren");
        }

        this.eat("open_curly");

        const cases = [ ];
        const body = isExpr? this.expression.bind(this) : this.statement.bind(this);
        const sep = isExpr? "comma" : "semicolon";

        while (!this.match("close_curly")) {

            let condition = this.tryMatch(() => {
                this.eat("identifier");
                this.eat("arrow");
                body();
                this.expect([ sep, "close_curly" ]);
            }, this.variable);

            condition = condition || this.tryMatch(() => {
                this.eat("open_paren");
                this.eat("identifier");
                this.eat("close_paren");
                this.eat("arrow");
                body();
                this.expect([ sep, "close_curly" ]);
            }, () => {
                this.eat("open_paren");
                const v = this.variable();
                this.eat("close_paren");
                return v;
            });

            if(!condition){
                condition = this.expression();
            }

            this.eat("arrow");
            const value = body();

            cases.push({
                condition: condition,
                value: value
            });

            if(this.match(sep)) {
                this.eat();   
                if(this.matchIdentifier("else")) {
                    this.back();
                    break;
                }
            }
            else {
                break;
            }
        }

        let def;
        if(this.matchIdentifier("else")) {
            def = body();
        }

        if(this.match(sep)) this.eat();
        this.eat("close_curly");

        return ast(isExpr? "match_expr" : "match_stmt", {
            cases: cases,
            default: def,
            var_decs: var_decs
        });
    }

    // matchExpr(isExpr = true) {
    //     const val = this.expression();
    //     this.eat("comma");
    //     this.eat("open_curly");

    //     const cases = [ ];
    //     const body = isExpr? this.expression.bind(this) : this.statement.bind(this);
    //     const sep = isExpr? "comma" : "semicolon";

    //     while (true) {
    //         let c;
    //         let varCase = this.tryMatch(() => {
    //             this.eat("identifier");
    //             this.eat("arrow");
    //             body();
    //             this.expect([ sep, "close_curly" ]);
    //         }, this.variable);

    //         varCase = varCase || this.tryMatch(() => {
    //             this.eat("open_paren");
    //             this.eat("identifier");
    //             this.eat("close_paren");
    //             this.eat("arrow");
    //             body();
    //             this.expect([ sep, "close_curly" ]);
    //         }, () => {
    //             this.eat("open_paren");
    //             const v = this.variable();
    //             this.eat("close_paren");
    //             return v;
    //         });

    //         if(varCase) {
    //             c = varCase;
    //         }
    //         else {
    //             c = this.expression();
    //         }

    //         this.eat("arrow");

    //         cases.push({
    //             case: c,
    //             value: body()
    //         });

    //         if(this.match(sep)) {
    //             this.eat();   
    //             if(this.matchIdentifier("else")) {
    //                 this.back();
    //                 break;
    //             }
    //         }
    //         else {
    //             break;
    //         }
    //     } 

    //     let def;
    //     if(this.matchIdentifier("else")) {
    //         def = this.expression();
    //     }

    //     if(this.match(sep)) this.eat();
    //     this.eat("close_curly");

    //     return ast(isExpr? "match_expr" : "match_stmt", {
    //         value: val,
    //         cases: cases,
    //         default: def
    //     });
    // }

    ifExpr(isExpr = true) {
        const condition = this.expression();
        this.eat("comma");
        const ifTrue = isExpr? this.expression() : this.statement();

        let ifFalse;
        if(this.matchIdentifier("else")) {
            ifFalse = isExpr? this.expression() : this.statement();
        }

        return ast(isExpr? "if_expr" : "if_stmt", {
            condition: condition,
            true_branch: ifTrue,
            false_branch: ifFalse
        });
    }

    tryExpr(isExpr = true) {
        const body = isExpr? this.expression() : this.statement();

        let onFail;
        if(this.matchIdentifier("else")) {
            onFail = isExpr? this.expression() : this.statement();
        }

        return ast(isExpr? "try_expr" : "try_stmt", {
            body: body,
            on_fail: onFail
        });
    }

    binary() {
        const left = this.unary();

        if (Object.keys(BINARY_OPS).includes(this.peek().type)) {
            const t = this.eat();
            return leftify(ast("binary_op", {
                left: left,
                op: BINARY_OPS[t.type],
                right: this.binary()
            }));
        }

        return left;
    }

    unary() {
        if(this.match("identifier", "excl", "minus")) {
            const t = this.eat();

            switch(t.type) {
                case "excl": return ast("unary_op", {
                    op: "!",
                    right: this.unary()
                });

                case "minus": return ast("unary_op", {
                    op: "-",
                    right: this.unary()
                });

                case "identifier": switch (t.value) {
                    case "super": return this.super();
                    case "len": return ast("len", {
                        value: this.unary()
                    });

                    case "if": {
                        return this.ifExpr(true);
                    }
                    case "try": {
                        return this.tryExpr(true);
                    }
                    case "match": {
                        return this.matchExpr(true);
                    }
                    case "for": {
                        this.back();
                        return this.forLoop(true);
                    }
                }
            }

            this.back();
        }

        return this.index();
    }

    index(isExpr = true) {
        const left = this.primary();

        const chain = [ ];

        let shouldBreak = false;
        while (!shouldBreak && this.match("dot", "colon", "pound", "open_paren", "excl")) {
            const t = this.eat();
            switch(t.type) {
                case "dot": {
                    chain.push(ast("index_object", {
                        left: left,
                        name: this.eat("identifier").value
                    }));
                    break;
                }

                case "pound": {
                    chain.push(ast("index_key", {
                        left: left,
                        key: this.primary()
                    }));
                    break;
                }

                case "colon": {
                    const name = this.eat("identifier").value;
                    const args = this.fullFuncCall(isExpr);

                    chain.push(ast("self_method_call", {
                        member: name,
                        args: args
                    }));
                    break;
                }

                case "open_paren": {
                    const args = this.expressionList();
                    this.eat("close_paren");

                    chain.push(ast("method_call", {
                        args: args
                    }));
                    break;
                }

                case "excl": {
                    if(!this.tryNotMatch(this.unary, () => {
                        chain.push(ast("method_call", {
                            args: [ ]
                        }));
                        return true;
                    })) {
                        this.back();
                        shouldBreak = true;
                    }
                    break;
                }

                default: {
                    this.back();
                    break;
                }
            }
        }

        if(this.matchIdentifier(...KEYWORDS)) {
            this.back();
        }
        else {
            const call = this.funcCall(isExpr);
            if(call) chain.push(call);
        }
        
        if(chain.length > 0) {
            return leftifyArray(left, chain);
        }
        else return left;
    }

    funcCall(isExpr = true) {
        if(this.match("identifier") && KEYWORDS.includes(this.peek().value)) return;
        
        if(isExpr) {
            const binary = this.tryMatch(this.binary, () => {
                if(!this.match("minus")) {
                    return ast("method_call", {
                        args: [ this.unary() ]
                    });
                }
            });

            if(!binary) {
                if(!this.match("minus")) {
                    const expr = this.tryMatch(this.expression, this.expression);
                    if(expr) return ast("method_call", {
                        args: [ expr ]
                    });
                }
            }
            else {
                return binary;
            }
        }
        else {
            const expr = this.tryMatch(this.expression, this.expression);
            if(expr) return ast("method_call", {
                args: [ expr ]
            });
        }
    }

    primary() {
        const errorMessage = "a value or expression"

        const t = this.expect(
            ["at", "number", "string", "identifier", "open_paren", "open_square", "open_curly", "zoom", "lshift" ],
            errorMessage
        );

        switch (t.type) {

            case "zoom": {
                this.eat();
                return ast("block_expr", {
                    statements: [ this.statement() ]
                });
            }

            case "at": {
                this.eat();
                if(this.match("identifier")) {
                    const name = this.eat("identifier").value;
                    const args = this.tryMatch(() => this.fullFuncCall(true), () => this.fullFuncCall(true));
                    if(args) {
                        return ast("self_method_call", {
                            left: {
                                type: "variable",
                                name: "self"
                            },
                            member: name,
                            args: args
                        });
                    }
                    else return ast("variable", {
                        name: "self." + name
                    });
                }
                else return ast("variable", {
                    name: "self"
                });
            }

            case "open_curly": return this.table();

            case "open_square": return this.array();

            case "lshift": return this.group();

            case "open_paren": {

                this.eat();

                if(this.peek().type == "close_paren") {
                    this.back();
                    return this.func();
                }

                if(this.peek().type == "identifier" && this.peek(1).type == "comma") {
                    this.back();
                    return this.func();
                }

                let fn = this.tryMatch(() => {
                    this.eat("identifier");
                    this.eat("colon");
                    this.type();
                    this.expect("comma", "equals");
                }, () => {
                    this.back();
                    return this.func()
                });

                fn = fn || this.tryMatch(() => {
                    this.parameter();
                    while(this.match("comma")) {
                        this.eat();
                        this.parameter();
                    }

                    this.eat("close_paren");
                    
                    this.expect(["arrow", "penis", "open_square"])

                    if(this.eat().type == "open_square") {
                        this.expression();
                        this.eat("close_square");
                        this.eat("penis");
                    }

                }, () => {
                    this.back();
                    return this.func();
                });

                if(fn) return fn;

                const inner = this.expression();
                this.eat("close_paren");

                return ast("brackets", {
                    content: inner
                });
            }

            case "number": return ast("number", {
                value: this.eat().value
            });

            case "string": return ast(
                t.interpolations.length == 0? "string" : "fstring", 
                {
                    value: this.eat().value,
                    format_values: t.interpolations.map(x => {
                        const p = new Parser();
                        return p.parseExpression(x);
                    })
                }
            )

            case "identifier": {
                const t = this.eat();

                switch(t.value) {
                    case "true": case "false": return ast("bool", {
                        value: t.value == "true"
                    });

                    case "nil": return ast("nil");

                    // case "my": return ast("variable", {
                    //     name: "self"
                    // });

                    default: {
                        this.back();

                        const fn = this.tryMatch(() => {
                            this.parameter();
                            
                            this.expect(["arrow", "penis", "open_square"])

                            if(this.eat().type == "open_square") {
                                this.expression();
                                this.eat("close_square");
                                this.eat("penis");
                            }

                        }, this.func);

                        if(fn) return fn;

                        return this.variable();
                    }
                }
            }
        }

        throw this.generateError("Expected " + errorMessage + " but got " + tts(t));
    }

    variable() {
        return ast("variable", {
            name: this.eat().value
        });
    }

    expressionList() {
        let elements = [ ];

        elements.push(this.expression());
        
        while(this.peek().type == "comma") {
            this.eat();
            elements.push(this.expression());
        } 

        return elements;
    }

    array() {
        this.eat("open_square");

        if(this.peek().type == "close_square") {
            this.eat();
            return ast("array", {
                elements: [ ]
            });
        }

        const elements = this.expressionList();

        this.eat("close_square");

        return ast("array", {
            elements: elements
        });
    }

    group() {
        this.eat("lshift");

        if(this.peek().type == "zoom") {
            this.eat();
            return ast("group", {
                elements: [ ]
            });
        }

        const elements = this.expressionList();

        this.eat("zoom");

        return ast("group", {
            elements: elements
        });
    }

    tableKey() {
        const key = this.eat("identifier").value;
        this.eat("colon");
        return {
            key: key,
            value: this.expression()
        };
    }

    table(separators = [ "comma", "semicolon" ]) {
        this.eat("open_curly");

        if(this.match("close_curly")) {
            this.eat();
            return ast("table", {
                entries: [ ]
            });
        }

        const entries = [ ];
        if(this.match("identifier")) {
            entries.push(this.tableKey());
            while(this.match(...separators)) {
                this.eat();

                if(this.match("close_curly")) break;
                
                entries.push(this.tableKey());
            }
        }

        this.eat("close_curly");

        return ast("table", {
            entries: entries
        });
    }

    type() {
        const t = {
            allowed: [ this.eat("identifier").value ],
            optional: false
        };
        
        while(this.peek().type == "union") {
            this.eat();
            t.allowed.push(this.eat("identifier").value);
        }

        if(this.peek().type == "question_mark") {
            this.eat();
            t.optional = true;
        }

        return t;
    }

    parameter() {
        const name = this.eat("identifier").value;
        let type;
        let defaultValue;

        if(this.match("ellipses")) {
            const t = this.eat();
            return {
                name: name,
                variadic: true,
                token: t
            };
        }

        if(this.match("colon")) {
            this.eat();
            type = this.type();
        }

        if(this.match("equals")) {
            this.eat();
            defaultValue = this.expression();
        }

        return {
            name: name,
            type: type,
            value: defaultValue
        };
    }

    func() {
        const parameters = [ ];

        if(this.peek().type == "open_paren") {
            this.eat();
            if(this.peek().type != "close_paren") {
                parameters.push(this.parameter());
                while(this.match("comma")) {
                    this.eat();
                    parameters.push(this.parameter());
                }
            }
            this.eat("close_paren");
        }
        else {
            parameters.push(this.parameter());
        }

        const variadic = parameters.length > 0 && parameters[parameters.length - 1].variadic;
        for (let i = 0; i < parameters.length - 1; i++) {
            if(parameters[i].variadic)
                throw this.generateError("Only the last parameter in a function may be variadic", t);
        }

        let takesSelf = false;
        let selfType;

        const arrow = this.expect(
            ["arrow", "penis", "open_square"], 
            "'=>', ':=>', or '[T] :=>'"
        );

        this.eat();

        if(arrow.type == "arrow") {
            takesSelf = false;
        }
        else if(arrow.type == "penis") {
            takesSelf = true;
        }
        else if(arrow.type == "open_square") {
            takesSelf = true;
            selfType = this.expression();
            this.eat("close_square");
            this.eat("penis");
        }

        const body = this.expression();

        return ast("function", {
            args: parameters,
            variadic: variadic,
            takesSelf: takesSelf,
            selfType: selfType,
            body: body
        });
    }

    fullFuncCall(isExpr = true) {
        if(this.match("open_paren")) {
            this.eat();
            const args = this.expressionList();
            this.eat("close_paren");
            return args;
        }
        else if(this.match("excl")) {
            this.eat();
            return [ ];
        }
        else {
            const f = this.funcCall(isExpr);
            if(f) {
                return f.args;
            }
            else {
                throw this.generateError("Expected a function call but got " + tts(this.peek()));
            }
        }
    }

    super(isExpr = true) {
        // const name = this.eat("identifier").value;

        if(!isExpr) {
            const val = this.tryNotMatch(this.fullFuncCall, () => ast("super_value"));
            if(val) return val;
        }

        const args = this.fullFuncCall(isExpr);

        return ast("super_call", {
            args: args
        });
    }
}
