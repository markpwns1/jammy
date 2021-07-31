class TypeError extends Error { 

}

exports.TypeError = TypeError;

const typeErrors = [ ];
const typeError = msg => {
    const e = new TypeError(msg);
    typeErrors.push(e);
    return e;
}

class JType { 

    evalCopy() {
        throw "Not implemented";
    }

    is(t) {
        return this.evaluate() instanceof t;
    }

    ref() {
        return new JRef(this);
    }

    generic() {
        return false;
    }

    toString() {
        return "JType";
    }

    evaluate() {
        return this;
    }

    isUnknown() {
        return false;
    }

    // return [ self, other ]
    matchGeneric(other) {
        return [ this.ref(), other.ref() ];
    }

    coerce(weaker) {
        if(weaker.evaluate().isUnknown()) {
            weaker.evaluate().type = this;
            return [ weaker.ref(), this.ref() ];
        }
        // else if(weaker.generic()) {
        //     let right;
        //     [ weaker.generic().bound, right ] = this.coerce(weaker.evaluate());
        //     return [ weaker.ref(), right ];
        // }
        else if(weaker.is(JNullable)) {
            const [ left, right ] = this.coerce(weaker.evaluate().type);
            return [ new JNullable(left), right ];
        }
        else {
            return [ new JVar(this), this.ref() ];
        }
    }

    // returns [ weaker, stronger ] or [ left, right ]
    twoWayCoerce(weaker) { 
        if(weaker.canBeCoercedTo(this)) {
            return this.coerce(weaker);
        }
        else if(this.canBeCoercedTo(weaker)) {
            // console.log("WEAK REVERSE");
            return weaker.coerce(this);
        }
        else {
            const e = typeError("Cannot coerce a " + weaker.toString() + " to a " + this.toString());
            throw e;
        }
    }

    canBeCoercedTo(other) {
        return false;
    }
}

let jVarID = 0;
class JVar extends JType {
    constructor(dependent) {
        super();
        this.id = jVarID++;
        this.type = dependent;
    }

    generic() {
        return this.type? this.type.generic() : null;
    }

    toString() {
        return  (this.type? (this.type.toString()) : ("$" + this.id));
    }

    evaluate() {
        return this.type || this;
    }

    canBeCoercedTo(other) {
        return this.type? this.type.canBeCoercedTo(other) : true;
    }

    isUnknown() {
        return this.type? this.type.isUnknown() : true;
    }

    evalCopy() {
        return this.type? this.type.evalCopy() : this;
    }

    matchGeneric(other) {
        if(other.evaluate() == this) {
            const c = new JGeneric();
            return [ c, c, c ];
        }
        else return super.matchGeneric(other);
    }

    coerce(weaker) {
        if(weaker.isUnknown()) {
            return super.coerce(weaker);
        }
        // else if(weaker.generic()) {
        //     let right;
        //     [ weaker.bound, right ] = this.coerce(weaker.generic().bound);
        //     return [ weaker.ref(), right.ref() ];
        // }
        else if(this.isUnknown()) {
            // return weaker.coerce(this);
            return [ new JNullable(weaker), this.ref() ];
        }
        else {
            // console.log(this);
            // console.log(weaker);
            // throw "wtf";
            return super.coerce(weaker);
        }
    }
}

class JPrimitive extends JType { 

    constructor(name) {
        super();
        this.name = name;
    }

    evalCopy() {
        return new JPrimitive(this.name);
    }

    coerce(other) {
        if(other.generic()) {
            let right;
            [ other.bound, right ] = this.coerce(other.generic().bound);
            // console.log(other, right);
            return [ other.ref(false), right.ref() ];
        }
        else 
        if(other.is(JPrimitive) && other.evaluate().name == "any") {
            // console.log("V");
            return [ other.ref(), this.ref() ];
        }
        else return super.coerce(other);
    }

    canBeCoercedTo(other) {
        return other.isUnknown() || (other.is(JPrimitive) && (this.name == "any" || other.evaluate().name == "any" || other.evaluate().name == this.name));
    }

    toString() {
        return this.name;
    }
}

class JNullable extends JType {
    constructor(type) {
        super();
        const t = type.evaluate();
        if(t.is(JNullable)) {
            this.type = t.type;
        }
        else {
            this.type = type;
        }
    }

    matchGeneric(other) {
        [ this.type, other ] = this.type.matchGeneric(other);
        return super.matchGeneric(other);
    }

    canBeCoercedTo(other) {
        if(other.is(JNullable)) {
            return this.type.canBeCoercedTo(other.evaluate().type);
        }
        else return this.type.canBeCoercedTo(other);
    }

    toString() {
        return this.type.toString() + "?";
    }

    evalCopy() {
        return new JNullable(this.type.evalCopy());
    }
}

let genericID = 0;
class JGeneric extends JType {
    constructor() {
        super();
        this.id = genericID++;
        this.bound = null;
    }

    evalCopy() {
        if (this.bound) return this.bound.evalCopy();

        const c = new JGeneric();
        c.id = this.id;
        genericID--;
        return c;
    }

    generic() {
        return this;
    }

    ref(bound = true) {
        return (this.bound && bound)? this.bound.ref() : super.ref();
    }

    evaluate() {
        return this.bound? this.bound.evaluate() : super.evaluate();
    }

    isUnknown() {
        return this.bound? this.bound.isUnknown() : super.isUnknown();
    }

    // return [ self, other ]
    matchGeneric(other) {
        return this.bound? this.bound.matchGeneric(other) : super.matchGeneric(other);
    }

    coerce(weaker) {
        if(weaker.generic()) {
            const g = weaker.generic();
            if(g.id == this.id) { 
                // console.log("WAA");
                const c = [ this.ref(false), this.ref(false), this.ref(false) ];
                // console.log(c);
                return c;
            }
        }
        return this.bound? this.bound.coerce(weaker) : super.coerce(weaker);
    }

    // returns [ weaker, stronger ] or [ left, right ]
    twoWayCoerce(weaker) { 
        return this.bound? this.bound.twoWayCoerce(weaker) : super.twoWayCoerce(weaker);
    }

    canBeCoercedTo(other) {
        return this.bound? this.bound.canBeCoercedTo(other) : super.canBeCoercedTo(other);
    }

    bind(type) {
        this.bound = type;
    }

    unbind() {
        this.bound = null;
    }

    toString() {
        return this.bound? this.bound.toString() : ("<" + this.id + ">");
    }
}

class JFunction extends JType {
    constructor(returnType, argTypes) {
        super();
        this.returnType = returnType;
        this.argTypes = argTypes;
    }

    matchGeneric(other) {
        if(!(other instanceof JVar)) throw "Tried to apply generic to non-generic";

        let worked = false;
        let generic;
        for (let i = 0; i < this.argTypes.length; i++) {
            const matched = this.argTypes[i].matchGeneric(other);
            if(matched[2]) {
                if(worked) {
                    [ this.argTypes[i] ] = generic;
                }
                else {
                    worked = true;
                    generic = matched[2];
                    [ this.argTypes[i] ] = generic;
                }
            }
        }

        const matched = this.returnType.matchGeneric(other);
        if(matched[2]) {
            if(worked) {
                this.returnType = generic;
            }
            else {
                worked = true;
                generic = matched[2];
                this.returnType = generic;
            }
        }

        return [ this.ref(), generic || other.ref(), generic ];
    }

    evalCopy() {
        const c = new JFunction(this.returnType.evalCopy(), this.argTypes.map(x => x.evalCopy()));
        console.log(c);
        return c;
    }

    coerce(weaker) {
        weaker = weaker.evaluate();
        for (let i = 0; i < weaker.argTypes.length; i++) {
            // console.log(this.argTypes[i]);
            if(this.argTypes[i]) {
                [ weaker.argTypes[i], this.argTypes[i] ] = this.argTypes[i].coerce(weaker.argTypes[i]);
            }
            else {
                weaker.argTypes[i] = new JNullable(weaker.argTypes[i]);
            }
            // console.log(weaker.argTypes[i]);
        }
        // console.log("----[");
        // console.log(this.returnType, weaker.returnType);
        [ weaker.returnType, this.returnType ] = this.returnType.coerce(weaker.returnType);
        // console.log(this.returnType, weaker.returnType);
        // console.log("]----");

        return [ weaker.ref(), this.ref() ];
    }

    canBeCoercedTo(other) {
        if (!(other.is(JFunction))) return false;
        const other_eval = other.evaluate();
        for (let i = 0; i < other_eval.argTypes.length; i++) {
            const arg = other_eval.argTypes[i];
            // console.log(this.argTypes[i], arg);
            if(this.argTypes[i] && !this.argTypes[i].canBeCoercedTo(arg)) return false;
            // console.log(true);
        }
        // console.log(this.returnType, other_eval.returnType);
        const c = this.returnType.canBeCoercedTo(other_eval.returnType);
        // console.log(c);
        return c
    }

    toString() {
        return "(" + this.argTypes.map(x => x.toString()).join(", ") + ") -> " + this.returnType.toString();
    }
}

class JRef extends JType {
    constructor(type) {
        super();
        this.type = type;
    }

    evalCopy() {
        return this.type.evalCopy().ref();
    }

    ref() {
        return this;
    }

    generic() {
        return this.type.generic();
    }

    toString() {
        return this.type.toString();
    }

    evaluate() {
        return this.type.evaluate();
    }

    isUnknown() {
        return this.type.isUnknown();
    }

    matchGeneric(other) {
        return this.type.matchGeneric(other);
    }

    coerce(weaker) {
        return this.type.coerce(weaker);
    }

    twoWayCoerce(weaker) { 
        return this.type.twoWayCoerce(weaker);
    }

    canBeCoercedTo(other) {
        return this.type.canBeCoercedTo(other);
    }
}


exports.typeErrors = typeErrors;
exports.JType = JType;
exports.JPrimitive = JPrimitive;
exports.JVar = JVar;
exports.JNullable = JNullable;
exports.JFunction = JFunction;
exports.JGeneric = JGeneric;
