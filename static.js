
class Scope {
    variables = [ ]

    dumpVariables() {
        console.log(this.variables.map(x => x.toString()).join("\n"));
    }

    hasVariable(name) {
        return this.variables.some(x => x.name == name);
    }

    getVariable(name) {
        return this.variables.find(x => x.name == name);
    }
}

class Variable {
    constructor(name, type) {
        this.name = name;
        this.type = type;
    }

    toString() {
        return this.name + ": " + this.type.toString();
    }
}

/*

nil

*/

class FullType {
    constructor(optional = false, ...types) {
        this.types = types;
        this.optional = optional;
    }

    toString() {
        return this.collapse().types.map(x => x.toString()).join(" | ") + (this.optional? " ?" : "");
    }

    // weaker is the more flexible one
    unify(weaker) {
        if(this.isNil()) {
            weaker.optional = true;
        }
        else if(weaker.isSoleUnknown()) {
            weaker.first().following = this;
        }
        else if(this.isSoleUnknown()) {
            this.first().following = weaker;
        }
        else {
            let isInvalid = false;
            // console.log(this.types.map(x => x.toString()));
            for (const t of weaker.types) {
                if(!this.types.some(x => x.equivalent(t))) {
                    isInvalid = true;
                    break;
                }
            }

            if(weaker.optional && !this.optional && !this.isNil()) {
                // isInvalid = true;
                this.optional = true;
            }

            if(isInvalid) {
                throw "Cannot unify types " + this.toString() + " and " + weaker.toString();
            }
        }
    }

    first() {
        return this.types[0];
    }

    isNil() {
        return this.types.length == 1 && this.types[0] instanceof JPrimitive && this.types[0].name == "nil";
    }

    isAny() {
        return this.types.length == 1 && this.types[0] instanceof JPrimitive && this.types[0].name == "any";
    }

    isSingle() {
        return this.types.length == 1;
    }

    isSoleUnknown() {
        return this.types.length == 1 && this.types[0] instanceof JVar && !this.types[0].following;
    }

    collapse() {
        const types = [ ];
        let optional = false;
        for (const myType of this.types) {
            if(myType instanceof JVar && myType.following) {
                const c = myType.following.collapse();
                optional = optional || c.optional;
                for (const otherType of c.types) {
                    if(!types.some(x => x.equivalent(otherType))) {
                        types.push(otherType);
                    }
                }
            }
            else if(!types.some(x => x.equivalent(myType))) {
                types.push(myType);
            }
        }
        return new FullType(optional, ...types);
    }
}

class HalfType { }

class JPrimitive extends HalfType {
    constructor(name) {
        super();
        this.name = name;
    }

    toString() {
        return this.name;
    }

    // returns true if the types can be unified
    equivalent(other) {
        return (this.name == other.name) || other.equivalent(this);
    }
}

let jVarID = 0;
class JVar extends HalfType {
    constructor(follows) {
        super();
        this.following = follows;
        this.id = jVarID++;
    }

    toString() {
        return "$" + this.id + (this.following? (" -> " + this.following.toString()) : "");
    }

    equivalent(other) {
        return (this.following? (
            this.following.isSingle() && this.following.first().equivalent(other)
        ) : (this.id == other.id)) || other.equivalent(this);
    }
}

const scopes = [ new Scope() ];

const peekScope = () => scopes[scopes.length - 1];
const getVar = name => {
    for (let i = scopes.length - 1; i > -1; i--) {
        const v = scopes[i].getVariable(name);
        if(v) return v;
    }
}

const evaluators = { };

evaluators.number = ast => ({
    ...ast,
    jtypes: [ new FullType(false, new JPrimitive("number")) ]
});

evaluators.boolean = ast => ({
    ...ast,
    jtypes: [ new FullType(false, new JPrimitive("boolean")) ]
});

evaluators.nil = ast => ({
    ...ast,
    jtypes: [ new FullType(false, new JPrimitive("nil")) ]
});

evaluators.variable = ast => {
    let v = getVar(ast.name);
    if(!v) {
        v = new Variable(ast.name, new FullType(false, new JVar()));
        scopes[0].variables.push(v);
    }
    
    return {
        ...ast,
        jtypes: [ v.type ]
    }

};

evaluators.var_dec = ast => {

    const scope = peekScope();
    const name = ast.variables[0];
    const type = new FullType(false, ast.values? new JVar(evaluate(ast.values[0]).jtypes[0]) : new JVar());
    scope.variables.push(new Variable(name, type));

    return ast;
};

evaluators.var_assign = ast => {
    const left = evaluate(ast.leftHand[0]).jtypes[0];
    const right = evaluate(ast.values[0]).jtypes[0];

    right.unify(left);

    return ast;
};

const pretty = ast => JSON.stringify(ast, null, 2);
const evaluate = (ast, ...settings) => {
    const found = evaluators[ast.type];
    if(found) return found(ast, ...settings);
    else throw "No evaluation function for " + pretty(ast);
}

const fs = require("fs");
const Scanner = require("./scanner").Scanner;
const Parser = require("./parser").Parser;
const source = fs.readFileSync("test.jam", "utf8");
const scanner = new Scanner();
const tokens = scanner.scan(source);
const parser = new Parser();
const ast = parser.parse(tokens);

// console.log("UGA" + new JVar(new FullType(true, new JPrimitive("number"))).equivalent(new JPrimitive("number")));

for (const stmt of ast) {
    evaluate(stmt);
}
peekScope().dumpVariables();

