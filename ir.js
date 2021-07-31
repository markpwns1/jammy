
const { Parser } = require("./parser");
const { Scanner } = require("./scanner");
const { scopes, FunctionScope } = require("./scope");
const { JType, JPrimitive, typeErrors, JFunction, JVar, JNullable, JGeneric } = require("./type");
const { Variable } = require("./variable");

const scanner = new Scanner();
const tokens = scanner.scanFile("test.jam");
const parser = new Parser();
const ast = parser.parse(tokens);

const evaluator = { };

// scopes.peek().variables.push(new Variable("any_or_nil", new JNullable(new JPrimitive("any"))));

evaluator.number = ast => ({
    ...ast,
    jtype: new JPrimitive("number")
});

evaluator.bool = ast => ({
    ...ast,
    jtype: new JPrimitive("boolean")
});

evaluator.var_dec = ast => {
    const s = scopes.peek();
    for (let i = 0; i < ast.variables.length; i++) {
        const name = ast.variables[i];
        let val = (ast.values && ast.values[i])? evaluate(ast.values[i]) : null;
        const v = new Variable(name, val? val.jtype : null);
        s.variables.push(v);
    }
};

evaluator.variable = ast => {
    const v = scopes.getVar(ast.name);
    if(!v) throw "Couldn't find variable " + ast.name;
    v.used = true;
    return v;
};

evaluator.var_assign = ast => {
    for (let i = 0; i < ast.leftHand.length; i++) {
        const left = evaluate(ast.leftHand[i]);
        const right = evaluate(ast.values[i]);
        [ left.jtype, right.jtype ] = right.jtype.twoWayCoerce(left.jtype);
    }
    return ast;
}

evaluator.function = ast => {
    const jtype = new JFunction(null, [ ]);

    const s = scopes.push(new FunctionScope());

    for (let i = 0; i < ast.args.length; i++) {
        const arg = ast.args[i];
        const argType = new JVar();
        s.variables.push(new Variable(arg.name, argType));
        jtype.argTypes.push(argType);
    }

    jtype.returnType = evaluate(ast.body).jtype;

    for (let i = 0; i < ast.args.length; i++) {
        if(!s.getVariable(ast.args[i].name).used) {
            jtype.argTypes[i] = new JNullable(new JPrimitive("any"));
        }
    }

    for (let i = 0; i < jtype.argTypes.length; i++) {
        [ jtype.returnType, jtype.argTypes[i] ] = jtype.returnType.matchGeneric(jtype.argTypes[i]);
    }

    scopes.pop();

    return {
        ...ast,
        jtype: jtype
    }
};

evaluator.method_call = ast => {
    const args = ast.args.map(x => evaluate(x));
    const left = evaluate(ast.left);
    const returnType = (left.jtype.is(JFunction) && !left.jtype.evaluate().returnType.evaluate().isUnknown())? left.jtype.evaluate().returnType.evaluate() : new JVar();
    const fType = new JFunction(returnType, args.map(x => x.jtype));

    if(left.jtype.is(JFunction)) {
        const argTypes = left.jtype.evaluate().argTypes;
        for (let i = 0; i < argTypes.length; i++) {
            const arg = argTypes[i].evaluate();
            if (arg.is(JGeneric)) {
                arg.bind(fType.argTypes[i]);
            }
        }
    }

    [ left.jtype ] = fType.twoWayCoerce(left.jtype);

    let r = fType.returnType;
    r = r.evalCopy();

    {
        const argTypes = left.jtype.evaluate().argTypes;
        for (let i = 0; i < argTypes.length; i++) {
            const arg = argTypes[i].generic();
            if(arg) {
                arg.unbind();
            }
        }
    }

    return {
        ...ast,
        jtype: r
    };
};

const pretty = ast => JSON.stringify(ast, null, 2);

const evaluate = (ast, ...settings) => {
    const found = evaluator[ast.type];
    if(found) return found(ast, ...settings);
    else throw "No evaluation function for " + pretty(ast);
}

for (let i = 0; i < ast.length; i++) {
    const stmt = ast[i];
    evaluate(stmt);
}

// console.log
scopes.peek().dumpVariables();
for (const e of typeErrors) {
    console.log(e);
}
