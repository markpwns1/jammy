
const fs = require("fs");
const token = require("./token");
const SYMBOLS = require("./symbols").SYMBOLS;

const WHITESPACE_REGEX = /\s/;
const SYMBOL_REGEX = /[`!@#$%^&*()+\-=\[\]{};':\\|,.<>\/?~]/;
const DIGIT_REGEX = /[0-9]/;
const IDENTIFIER_PREFIX_REGEX = /[_a-zA-Z]/;
const IDENTIFIER_CHAR_REGEX = /[_a-zA-Z0-9]/;

const STRING_ESCAPES = [
    '"',
    "\\",
    "b",
    "f",
    "n",
    "r",
    "t",
    "v"
];

exports.Scanner = class Scanner {
    offset = 0;
    source;

    token(type, extra) {
        return new token.Token(type, extra);
    }

    scanFile(filename) {
        return this.scan(fs.readFileSync(filename, "utf-8"));
    }

    scan(str) {
        this.offset = 0;
        this.source = str.replace(/\r\n/g, "\n");
    
        let tokens = [ ];
    
        const errors = [ ];
        while(this.offset < this.source.length) {
            try {
                const o = this.offset;
                const t = this.nextToken();

                if(t) {
                    const pos = this.posFromOffset(o);
                    t.pos = {
                        length: this.offset - o,
                        offset: o,
                        ...pos
                    };

                    tokens.push(t);
                }
            }
            catch (e) {
                if(Array.isArray(e)) {
                    for (const er of e) {
                        errors.push(er);
                    }
                }
                else {
                    errors.push(e);
                }
                this.eat();

                while(this.offset < this.source.length) {
                    try { 
                        const o = this.offset;
                        const t = this.nextToken();

                        if(t) {
                            const pos = this.posFromOffset(o);
                            t.pos = {
                                length: this.offset - o,
                                offset: o,
                                ...pos
                            };
        
                            tokens.push(t);
                            break;
                        }
                    } catch { 
                        this.eat();
                    }      
                }
            }
        }

        const eof = this.token("EOF");
        const pos = this.posFromOffset();
        eof.pos = {
            offset: this.offset,
            ...pos
        };
    
        tokens.push(eof);

        if(errors.length > 0) {
            throw errors;
        }
    
        return tokens;
    }

    nextToken() {
        const c = this.peek();
    
        if(this.isWhitespace(c)) {
            this.eat();
            return;
        }

        if(c == "/") {
            if(this.peek(1) == "/") {
                this.skip(2);
                while(this.offset < this.source.length && this.peek() != "\n") this.eat();
                return;
            }
            else if(this.peek(1) == "*") {
                this.skip(2);
                let depth = 1;
                while(this.offset < this.source.length && depth > 0) {
                    if(this.peek() == "/" && this.peek(1) == "*") {
                        this.skip(2);
                        depth++;
                    }
                    else if(this.peek() == "*" && this.peek(1) == "/") {
                        this.skip(2);
                        depth--;
                    }
                    else {
                        this.eat();
                    }
                }
                return;
            }
        }
    
        if(this.isSymbol(c)) {
            return this.symbol();
        }
    
        if(this.isDigit(c)) {
            return this.number();
        }
    
        if(this.isIdentifierPrefix(c)) {
            return this.identifier();
        }
    
        if(c == "\"") {
            return this.string();
        }
    
        throw this.generateError("Unexpected character: '" + c + "'");
    }

    isIdentifierPrefix(c) {
        return IDENTIFIER_PREFIX_REGEX.test(c);
    }
    
    isIdentifierCharacter(c) {
        return IDENTIFIER_CHAR_REGEX.test(c);
    }
    
    isWhitespace(c) {
        return WHITESPACE_REGEX.test(c);
    }
    
    isSymbol(c) {
        return SYMBOL_REGEX.test(c);
    }
    
    isDigit(c) {
        return DIGIT_REGEX.test(c);
    }

    getSymbol() {
        let s = "";
        let i = 0;
        while(this.isSymbol(this.peek(i))) {
            s += this.peek(i);
            i++;
        }
        return s;
    }

    posFromOffset(offset) {
        let ln = 1, col = 1;
        for (let i = 0; i < (offset || this.offset); i++) {
            if(this.source[i] == "\n") {
                ln++;
                col = 1;
            }
            else {
                col++;
            }
        }
    
        return {
            ln: ln,
            col: col
        };
    }

    generateError(text, overrideOffset) {
        const pos = this.posFromOffset(overrideOffset);
        const error = Error("SYNTAX ERROR @ Ln " + pos.ln + ", col " + pos.col + " -- " + text);
        error.rawMessage = text;
        error.offset = overrideOffset || this.offset;
        error.pos = pos;
        return error;
    }

    symbol() {
        const symbols = Object.keys(SYMBOLS).sort((a, b) => b.length - a.length);

        for (let j = 0; j < symbols.length; j++) {
            const s = symbols[j];
    
            let match = true;
            for (let i = 0; i < s.length; i++) {
                if(this.peek(i) != s[i]) {
                    match = false;
                    break;
                }
            }
    
            if(match) {
                this.skip(s.length);
                return this.token(SYMBOLS[s], { friendlyName: "'" + s + "'" });
            }
        }
    
        throw this.generateError("Unknown symbol: '" + this.getSymbol() + "'");
    }

    number() {
        let txt = "";
        while(this.isDigit(this.peek())) {
            txt += this.eat();
        }
    
        if(this.peek() == "." && this.isDigit(this.peek(1))) {
            txt += this.eat();
            while(this.isDigit(this.peek())) {
                txt += this.eat();
            }
        }  

        const val = parseFloat(txt);
        return this.token("number", { 
            value: val,
            friendlyName: "a number ('" + val + "')"
        });
    }

    identifier() {
        let val = this.eat();
        while(this.isIdentifierCharacter(this.peek())) {
            val += this.eat();
        }
    
        return this.token("identifier", {
            value: val,
            friendlyName: "a word ('" + val + "')"
        });
    }

    string() {
        this.eat();
    
        let val = "";
        let raw = "";
        let formattings = [ ];
    
        while(this.peek() != "\"" && this.peek() != "\0") {
            const c = this.peek();
            if(c == "$" && this.peek(1) == "{") {
                raw += this.eat();
                raw += this.eat();

                let depth = 1;
                let innerText = "";
                let offsetBefore = this.offset;

                while(depth > 0) {
                    const c = this.eat();
                    if(c == "{") depth++;
                    else if(c == "}") depth--;
                    innerText += c;
                    raw += c;
                }

                innerText = innerText.slice(0, innerText.length - 1);
                const innerScanner = new Scanner();

                let innerTokens;
                try {
                    innerTokens = innerScanner.scan(innerText);
                } catch (err) {
                    const errors = [ ];
                    for (const e of err) {
                        errors.push(this.generateError(e.rawMessage, offsetBefore + e.offset));
                    }
                    throw errors;
                }

                for (const t of innerTokens) {
                    t.pos.offset += offsetBefore;
                    const pos = this.posFromOffset(t.pos.offset);
                    t.pos.ln = pos.ln;
                    t.pos.col = pos.col;
                }

                formattings.push(innerTokens);

                val += "%s";
            }
            else if(c == "\\") {
                const e = this.eat();
                raw += e;
                val += e;
                if(STRING_ESCAPES.includes(this.peek())) {
                    const e = this.eat();
                    raw += e;
                    val += e;
                }
                else {
                    throw this.generateError("Invalid string escape: '\\" + this.peek() + "'");
                }
            }
            else {
                const e = this.eat();
                raw += e;
                val += e;
            }
        }

        this.eat('"');
    
        return this.token("string", {
            value: val.replace(/\n/g, "\\n").replace(/\r/g, ""),
            interpolations: formattings,
            friendlyName: "a string (\"" + raw + "\")"
        });
    }

    skip(n) {
        this.offset += n;
    }

    eat(type) {
        const c = this.source[this.offset];

        if(type && c != type) 
            throw this.generateError("Expected '" + type + "' but got " + (c? ("'" + c + "'") : "end of file"));

        this.offset++;
        return c;
    }

    /**
     * 
     * @param {number} o 
     * @return {string}
     */
    peek(o = 0) {
        return ((this.offset + o) < this.source.length) ? this.source[this.offset + o] : "\0";
    }
}


