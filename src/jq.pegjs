{
  const KEYWORDS = Object.freeze([
    'and',
    'as',
    'catch',
    'elif',
    'else',
    'end',
    'if',
    'or',
    'then',
    'try',
  ])

  const parsePipe = (first, rest) => {
    if (!rest.length) {
      return first
    }

    rest = rest.map(rest => rest[3])
    return jq.compilePipe(first, rest)
  }

  const variables = []

  const resolveVariable = (name) => {
    const index = variables.indexOf(name)
    if (index >= 0) {
      return index
    }

    error(`Variable "$${name}" is not defined.`)
  }

  // Hook parsing of VariableExpr so that the variable defined by that expression
  // is not visible outside of it.

  {
    const parse = peg$parseVariableExpr
    peg$parseVariableExpr = () => {
      const count = variables.length
      const result = parse()

      // discard the inner variable after the end of the expression
      variables.length = count
      return result
    }
  }
}

Output
  = _ expr: Expr _ {
    return jq.compileOutput(expr)
  }

Expr
  = first: Stream rest: (_ "|" _ Stream)* {
    return parsePipe(first, rest)
  }

ExprSimple // for object construction
  = first: Alternative rest: (_ "|" _ Alternative)* {
    return parsePipe(first, rest)
  }

Stream
  = first: Alternative rest: (_ "," _ Alternative)* {
    if (!rest.length) {
      return first
    }

    rest = rest.map(rest => rest[3])
    return jq.compileStream(first, rest)
  }

Alternative
  = first: LogicalOr rest: (_ "//" _ LogicalOr)* {
    if (!rest.length) {
      return first
    }

    rest = rest.map(rest => rest[3])
    return jq.compileAlternative(first, rest)
  }

LogicalOr
  = first: LogicalAnd rest: (_ "or" B$ _ LogicalAnd)* {
    if (!rest.length) {
      return first
    }

    rest = rest.map(rest => rest[4])
    return jq.compileLogicalOr(first, rest)
  }

LogicalAnd
  = first: Compare rest: (_ "and" B$ _ Compare)* {
    if (!rest.length) {
      return first
    }

    rest = rest.map(rest => rest[4])
    return jq.compileLogicalAnd(first, rest)
  }

Compare
  = left: AddSub tail: (_ CompareOp _ AddSub)? {
    if (!tail) {
      return left
    }

    const [, op,, right] = tail
    return jq.compileCompare(left, right, op)
  }

CompareOp
  = "==" { return jq.areEqual }
  / "!=" { return (a, b) => !jq.areEqual(a, b) }
  / "<=" { return (a, b) => jq.compare(a, b) <= 0 }
  / "<"  { return (a, b) => jq.compare(a, b) < 0 }
  / ">=" { return (a, b) => jq.compare(a, b) >= 0 }
  / ">"  { return (a, b) => jq.compare(a, b) > 0 }

AddSub
  = first: MulDiv rest: (_ AddSubOp _ MulDiv)* {
    if (!rest.length) {
      return first
    }

    rest = rest.map(([, op,, expr]) => ({ op, expr }))
    return jq.compileAddMul(first, rest)
  }

AddSubOp
  = "+" { return jq.add }
  / "-" { return jq.subtract }

MulDiv
  = first: Negation rest: (_ MulDivOp _ Negation)* {
    if (!rest.length) {
      return first
    }

    rest = rest.map(([, op,, expr]) => ({ op, expr }))
    return jq.compileAddMul(first, rest)
  }

MulDivOp
  = "*" { return jq.multiply }
  / "/" { return jq.divide }
  / "%" { return jq.modulo }

Negation
  = minuses: ("-" _)* expr: (TryCatch / VariableExpr) {
    const count = minuses.length
    if (!count) {
      return expr
    }

    return jq.compileNegation(expr, count)
  }

TryCatch
  = "try" B$ _ left: Negation right: (_ "catch" B$ _ Negation)? {
    right &&= right[4]
    return jq.compileTryCatch(left, right)
  }

VariableExpr
  = left: Optional tail: (_ "as" _ VariableDecl _ "|" _ Expr)? {
    if (!tail) {
      return left
    }

    const [,,, index,,,, right] = tail
    return jq.compileVariableExpr(left, right, index)
  }

VariableDecl
  = name: VariableName {
    let index = variables.indexOf(name)
    if (index < 0) {
      index = variables.length
      variables.push(name)
    }

    return index
  }

Optional
  = expr: (IfThenElse / Filter) tags: (_ "?")* {
    if (!tags.length) {
      return expr
    }

    return jq.compileTryCatch(expr, null)
  }

IfThenElse
  = "if" B$ _ cond: Expr _ "then" B$ _ left: Expr _ right: Else {
    return jq.compileIfThenElse(cond, left, right)
  }

Else
  = "else" B$ _ expr: Expr _ "end" B$ {
    return expr
  }
  / "elif" B$ _ cond: Expr _ "then" B$ _ left: Expr _ right: Else {
    return jq.compileIfThenElse(cond, left, right)
  }

Filter
  = first: FilterHead rest: (_ Transform)* {
    if (!rest.length) {
      return first
    }

    rest = rest.map(rest => rest[1])
    return jq.compileFilter(first, rest)
  }

FilterHead
  = Parens
  / ArrayConstruction
  / ObjectConstruction
  / Literal
  / DotName
  / Dot
  / VariableRef
  / FunctionCall

Parens
  = "(" _ expr: Expr _ ")" { return expr }

ArrayConstruction
  = "[" _ "]" {
    return () => []
  }
  / "[" _ items: Expr _ "]" {
    return jq.compileArrayConstruction(items)
  }

ObjectConstruction
  = "{" _ "}" {
    return () => ({})
  }
  / "{" _ first: ObjectEntry rest: (_ "," _ ObjectEntry)* (_ ",")? _ "}" {
    if (!rest.length) {
      return first
    }

    rest = rest.map(rest => rest[3])
    return jq.compileObjectConstruction(first, rest)
  }

ObjectEntry
  = key: ObjectKey _ ":" _ value: ExprSimple {
    return jq.compileObjectEntry(key, value)
  }
  / name: VariableName {
    const index = resolveVariable(name)
    return jq.compileObjectEntryFromVariable(name, index)
  }
  / name: (Name / String) {
    return jq.compileObjectEntryFromName(name)
  }

ObjectKey
  = name: (Name / String) {
    return () => name
  }
  / Parens

Literal
  = value: (String / Number) {
    return () => value
  }

DotName
  = "." name: (Name / String) optional: Opt {
    return jq.compileDotName(name, optional)
  }

Dot
  = "." {
    return jq.compileDot()
  }

VariableRef
  = name: VariableName {
    const index = resolveVariable(name)
    return jq.compileVariableRef(index)
  }

VariableName
  = VariableStart name: Name {
    return name
  }

VariableStart 'variable name'
  = "$"

FunctionCall
  = name: FunctionName args: FunctionArgs {
    return jq.compileFunctionCall(name, args, error)
  }

FunctionName 'function name'
  = name: Name & {
    return !KEYWORDS.includes(name)
  } {
    return name
  }

FunctionArgs
  = _ "(" _ first: Expr rest: (_ ";" _ Expr)* _ ")" {
    rest = rest.map(rest => rest[3])
    return [first, ...rest]
  }
  / !(_ "(") {
    return null
  }

Transform
  = BracketTransform
  / DotNameTransform

BracketTransform
  = "[" _ "]" optional: Opt {
    return jq.compileIterateTransform(optional)
  }
  / "[" _ index: Expr _ "]" optional: Opt {
    return jq.compileIndexTransform(index, optional)
  }
  / "[" _ start: Expr? _ ":" _ end: Expr? _ "]" optional: Opt & {
    return start || end // for JQ conformance
  } {
    return jq.compileSliceTransform(start, end, optional)
  }

DotNameTransform
  = "." name: (Name / String) optional: Opt {
    return jq.compileDotNameTransform(name, optional)
  }

Opt
  = tag: (_ "?")? {
    return !!tag
  }

String
  = StringStart chars: StringChar* "\"" {
    return chars.join('')
  }

StringStart 'string'
  = "\""

StringChar
  = char: . & {
    return char !== '"' && char !== '\\'
  } {
    return char
  }
  / "\\" char: EscapeChar {
    return char
  }

EscapeChar
  = "\""
  / "\\"
  / "/"
  / "b" { return '\b' }
  / "f" { return '\f' }
  / "n" { return '\n' }
  / "r" { return '\r' }
  / "t" { return '\t' }

Name 'name'
  = $([a-zA-Z_] NameChar*)

NameChar
  = [a-zA-Z_0-9]

B$ // name boundary
  = !NameChar / SpaceChar

Number 'number'
  = [.]*[0-9][.0-9]* tail: NameChar* {
    const chars = text()

    let value
    if (tail.length || Number.isNaN(value = +chars)) {
      error(`Invalid numeric literal "${chars}".`)
    }

    return value
  }

_
  = $SpaceChar*

SpaceChar 'space'
  = [ \n\t]
