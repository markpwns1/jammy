const { JVar } = require("./type");

exports.Variable = class Variable {
    constructor(name, type) {
        this.name = name;
        this.jtype = type || new JVar();
        this.used = false;
    }

    toString() {
        return this.name + ": " + this.jtype;
    }
}
