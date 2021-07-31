
class Scope { 
    variables = [ ];

    dumpVariables() {
        for (const v of this.variables) {
            console.log(v.name + ": " + v.jtype.evaluate().toString());
        }
    }

    hasVariable(name) {
        return this.variables.some(x => x.name == name);
    }

    getVariable(name) {
        return this.variables.find(x => x.name == name);
    }
}

class ProgramScope extends Scope { }
class FunctionScope extends Scope { }

const scopes = { };

scopes.stack = [ new ProgramScope() ];

scopes.push = s => { scopes.stack.push(s); return s };
scopes.pop = () => scopes.stack.pop();
scopes.peek = () => scopes.stack[scopes.stack.length - 1];
scopes.existsVar = n => scopes.stack.some(x => x.hasVariable(n));
scopes.getVar = n => {
    for (let i = scopes.stack.length - 1; i > -1; i--) {
        const v = scopes.stack[i].getVariable(n);
        if(v) return v;
    }
};

exports.scopes = scopes;
exports.Scope = Scope;
exports.ProgramScope = ProgramScope;
exports.FunctionScope = FunctionScope;
