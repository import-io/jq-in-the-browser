{
  const Keywords = [
    'and',
    'elif',
    'else',
    'end',
    'if',
    'or',
    'then',
  ]

  const parsePipe = (first, rest) => {
    if (!rest.length) {
      return first
    }

    rest = rest.map(rest => rest[3])
    return jq.compilePipe(first, rest)
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
  = left: AddSub right: (_ CompareOp _ AddSub)? {
    if (!right) {
      return left
    }

    const op = right[1]; right = right[3]
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
  = minuses: ("-" _)* right: (IfThenElse / Filter) {
    const count = minuses.length
    if (!count) {
      return right
    }

    return jq.compileNegation(count, right)
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
  / FunctionCall

Parens
  = "(" _ expr: Expr _ ")" { return expr }

FunctionCall
  = name: FunctionName _ "(" _ arg: Expr _ ")" {
    return jq.compileFunctionCall1(error, name, arg)
  }
  / name: FunctionName {
    return jq.compileFunctionCall0(error, name)
  }

FunctionName 'function name'
  = name: Name & {
    return !Keywords.includes(name)
  } {
    return name
  }

ArrayConstruction
  = "[" _ "]" {
    return jq.compileLiteral([])
  }
  / "[" _ items: Expr _ "]" {
    return jq.compileArrayConstruction(items)
  }

ObjectConstruction
  = "{" _ "}" {
    return jq.compileLiteral({})
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
  / key: (Name / String) {
    return jq.compileObjectEntryShort(key)
  }

ObjectKey
  = name: (Name / String) {
    return jq.compileLiteral(name)
  }
  / Parens

Transform
  = BracketTransform
  / DotName

BracketTransform
  = "[" _ "]" optional: Opt {
    return jq.compileIterator(optional)
  }
  / "[" _ index: Expr _ "]" optional: Opt {
    return jq.compileIndex(index, optional)
  }
  / "[" _ start: Expr? _ ":" _ end: Expr? _ "]" optional: Opt & {
    return start || end // for JQ conformance
  } {
    return jq.compileSlice(start, end, optional)
  }

Dot
  = "." {
    return jq.compileDot()
  }

DotName
  = "." name: (Name / String) optional: Opt {
    return jq.compileDotName(name, optional)
  }

Opt
  = tag: (_ "?")? {
    return !!tag
  }

Literal
  = value: (String / Number) {
    return jq.compileLiteral(value)
  }

String 'string'
  = '"' core: $[^"]* '"' { return core }
  / "'" core: $[^']* "'" { return core }

Name
  = $([a-zA-Z_$] NameChar*)

NameChar
  = [0-9a-zA-Z_$]

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
