import parser from './jq.pegjs'
export const compile = (expr) => parser.parse(expr)
export const { SyntaxError } = parser
