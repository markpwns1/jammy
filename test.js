


const str = '=> (x, y) => 6';

const Scanner = require("./scanner").Scanner;

const tokens = new Scanner().scanFile("test.jam");

const Parser = require("./parser").Parser;

const ast = new Parser().parse(tokens);

console.log(JSON.stringify(ast, null, 2));
