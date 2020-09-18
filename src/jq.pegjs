{
  const get_function_0 = name => {
    const f = function0_map[name]
    if (f === undefined) throw new Error(`function ${name}/0 is not defined`)
    return f
  }

  const get_function_1 = name => {
    const f = function1_map[name]
    if (f === undefined) throw new Error(`function ${name}/1 is not defined`)
    return f
  }

  const function0_map = {
    "length": input => input.length,
    "keys": input => Object.keys(input).sort(),
    "keys_unsorted": input => Object.keys(input),
    "to_entries": input => Object.entries(input).map(([key, value]) => ({ key, value })),
    "from_entries": input => input.reduce(
      (result, element) => Object.assign({}, result, {[element.key]: element.value}), {}),
    "reverse": input => ([].concat(input).reverse()),
    "tonumber": input => input * 1,
    "tostring": input => ((typeof input === "object") ? JSON.stringify(input) : String(input)),
    "ascii_downcase": input => {
      return input.replace(/[A-Z]/g, x => String.fromCharCode(x.charCodeAt(0) + 32))
    },
    "ascii_upcase": input => {
      return input.replace(/[a-z]/g, x => String.fromCharCode(x.charCodeAt(0) - 32))
    },
    "downcase": input => {
      return input.toLowerCase()
    },
    "sort": input => {
      return [...input].sort()
    },
    "upcase": input => {
      return input.toUpperCase()
    },
  }

  const function1_map = {
    "map": arg => input => input.map(i => arg(i)),
    "map_values": arg => input => {
      const pairs = Object.keys(input).map(key => ({[key]: arg(input[key])}))
      return Object.assign({}, ...pairs)
    },
    "with_entries": arg => input => {
      const from_entries = function0_map["from_entries"]
      const to_entries = function0_map["to_entries"]
      const mapped = to_entries(input).map(arg)
      return from_entries(mapped)
    },
    "join": arg => input => input.join(arg(input)),
    "sort_by": arg => input => [...input].sort((a, b) => {
      const va = arg(a)
      const vb = arg(b)
      if (va < vb) return -1
      if (va > vb) return 1
      return 0
    })
  }

  class Stream {
    constructor(items) {
      this.items = items
    }
  }

  const dotName = (value, name) => {
    if (value === null) {
      return null
    }
    if (!isObject(value)) {
      throw new Error(`Cannot index ${_mtype(value)} with string "${name}"`)
    }

    return value.hasOwnProperty(name) ? value[name] : null
  }

  const isNumber = (value) => {
    if (value === null) {
      return false
    }

    return typeof value === 'number'
  }

  const isObject = (value) => {
    if (value === null || Array.isArray(value)) {
      return false
    }

    return typeof value === 'object'
  }

  const iterate = (array) => {
    if (array.some(value => value === undefined || value instanceof Stream)) {
      array = array.flatMap(value => {
        if (value === undefined) {
          return []
        }
        if (Array.isArray(value)) {
          return [value] // escape flattening
        }
        if (value instanceof Stream) {
          return value.items
        }

        return value
      })
    }

    if (array.length <= 1) {
      return array[0]
    }

    return new Stream(array)
  }

  const map = (value, fn) => {
    if (value === undefined) {
      return undefined
    }
    if (!(value instanceof Stream)) {
      return fn(value)
    }

    return iterate(value.items.map(fn))
  }

  const product = (value1, value2, fn) => {
    if (value1 === undefined || value2 === undefined) {
      return undefined
    }
    if (!(value1 instanceof Stream)) {
      return map(value2, b => fn(value1, b))
    }
    if (!(value2 instanceof Stream)) {
      return map(value1, a => fn(a, value2))
    }

    return iterate(
      value2.items.flatMap(b =>
      value1.items.map(a => fn(a, b))))
  }

  const toArray = (value) => {
    if (value === undefined) {
      return []
    }
    if (!(value instanceof Stream)) {
      return [value]
    }

    return value.items
  }

  const parsePipe = (first, rest) => {
    if (!rest.length) {
      return first
    }

    rest = rest.map(([,,, expr]) => expr)
    return input => rest.reduce(map, first(input))
  }

  // Message formatting helpers. Don't use for other purposes.

  const _mtype = (value) => {
    if (value === null) {
      return 'null'
    }
    if (Array.isArray(value)) {
      return 'array'
    }

    return typeof value
  }

  const _mtype_v = (value) => {
    const type = _mtype(value)
    value = JSON.stringify(value)

    if (value.length > 14) {
      value = value.slice(0, 14 - 3) + '...'
    }

    return `${type} (${value})`
  }
}

output
  = _ expr: expr _ {
    return input => {
      if (input === undefined) {
        return []
      }

      return toArray(expr(input))
    }
  }

_
  = [ ]*

expr
  = first: stream rest: (_ "|" _ stream)* {
    return parsePipe(first, rest)
  }

expr_simple // for object construction
  = first: addsub rest: (_ "|" _ addsub)* {
    return parsePipe(first, rest)
  }

stream
  = first: addsub rest: (_ "," _ addsub)* {
    if (!rest.length) {
      return first
    }

    rest = rest.map(([,,, expr]) => expr)
    const all = [first, ...rest]
    return input => iterate(all.map(expr => expr(input)))
  }

addsub
  = first: muldiv rest: (_ addsub_op _ muldiv)* {
    if (!rest.length) {
      return first
    }

    rest = rest.map(([, op,, expr]) => ({ op, expr }))
    return input => rest.reduce((result, { op, expr }) =>
      product(result, expr(input), op),
      first(input))
  }

addsub_op
  = "+" {
    return (a, b) => {
      if (a === null) {
        return b
      }
      if (b === null) {
        return a
      }
      if (isNumber(a) && isNumber(b)) {
        return a + b
      }

      throw new Error(`${_mtype_v(a)} and ${_mtype_v(b)} cannot be added`)
    }
  }
  / "-" {
    return (a, b) => {
      if (isNumber(a) && isNumber(b)) {
        return a - b
      }

      throw new Error(`${_mtype_v(a)} and ${_mtype_v(b)} cannot be subtracted`)
    }
  }

muldiv
  = first: negation rest: (_ muldiv_op _ negation)* {
    if (!rest.length) {
      return first
    }

    rest = rest.map(([, op,, expr]) => ({ op, expr }))
    return input => rest.reduce((result, { op, expr }) =>
      product(result, expr(input), op),
      first(input))
  }

muldiv_op
  = "*" {
    return (a, b) => {
      if (isNumber(a) && isNumber(b)) {
        return a * b
      }

      throw new Error(`${_mtype_v(a)} and ${_mtype_v(b)} cannot be multiplied`)
    }
  }
  / "/" {
    return (a, b) => {
      if (isNumber(a) && isNumber(b)) {
        return a / b
      }

      throw new Error(`${_mtype_v(a)} and ${_mtype_v(b)} cannot be divided`)
    }
  }
  / "%" {
    return (a, b) => {
      if (isNumber(a) && isNumber(b)) {
        return a % b + 0 // must return 0 instead of -0
      }

      throw new Error(`${_mtype_v(a)} and ${_mtype_v(b)} cannot be divided (remainder)`)
    }
  }

negation
  = minuses: ("-" _)* expr: parens {
    const count = minuses.length
    if (!count) {
      return expr
    }

    return input => map(expr(input), value => {
      if (!isNumber(value)) {
        throw new Error(`${_mtype_v(value)} cannot be negated`)
      }
      if (!(count % 2)) {
        return value
      }

      return -value
    })
  }

parens
  = "(" _ expr: expr _ ")" { return expr }
  / filter

filter
  = first: head_filter rest: transform* {
    if (!rest.length) {
      return first
    }

    return input => rest.reduce(map, first(input))
  }

head_filter
  = literal
  / dot_name
  / identity
  / array_construction
  / object_construction
  / function1
  / function0

function1
  = name: name _ "(" _ arg: expr _ ")" {return get_function_1(name)(arg)}

function0
  = name: name {return get_function_0(name)}

array_construction
  = "[" _ "]" {
    return input => []
  }
  / "[" _ items: expr _ "]" {
    return input => toArray(items(input))
  }

object_construction
  = "{" _ "}" {
    return input => ({})
  }
  / "{" _ first: object_prop rest: (_ "," _ object_prop)* (_ ",")? _ "}" {
    if (!rest.length) {
      return first
    }

    rest = rest.map(([,,, expr]) => expr)
    return input => rest.reduce((result, expr) =>
      product(expr(input), result, (prop, object) => Object.assign({}, object, prop)),
      first(input))
  }

object_prop
  = key: object_key _ ":" _ value: expr_simple {
    return input => product(value(input), key(input), (value, key) => {
      // TODO: check key validity (strings only)
      return { [key]: value }
    })
  }

object_key
  = name: (name / string) {
    return input => name
  }
  / parens

transform
  = bracket_transforms
  / dot_name

bracket_transforms
  = "[" _ "]" {
    return input => {
      if (isObject(input)) {
        input = Object.values(input)
      }
      else if (!Array.isArray(input)) {
        throw new Error(`Cannot iterate over ${_mtype_v(input)}`)
      }

      return iterate(input)
    }
  }
  / "[" _ index_expr: (numeric_index / string) _ "]" {
    return input => {
      let index = index_expr // TODO: expression indices
      if (typeof index === 'string') {
        return dotName(input, index)
      }
      if (input !== null && !Array.isArray(input) || !isNumber(index)) {
        throw new Error(`Cannot index ${_mtype(input)} with ${_mtype(index)}`)
      }
      if (input === null || !Number.isInteger(index)) {
        return null
      }
      if (index < 0 && (index += input.length) < 0) {
        return null
      }
      if (index >= input.length) {
        return null
      }

      return input[index]
    }
  }
  / "[" _ start: numeric_index? _ ":" _ end: numeric_index? _ "]" & {
    return start || end // for JQ compliance
  } {
    return input => {
      if (input === null) {
        return null
      }
      if (!Array.isArray(input) && typeof input !== 'string') {
        throw new Error(`Cannot index ${_mtype(input)} with object`)
      }
      if (start !== null && !isNumber(start) || end !== null && !isNumber(end)) {
        throw new Error(`Start and end indices of an ${_mtype(input)} slice must be numbers`)
      }

      const startIndex = start ? Math.floor(start) : 0 // TODO: expression indices
      const endIndex = end ? Math.ceil(end) : undefined // TODO: expression indices
      return input.slice(startIndex, endIndex)
    }
  }

numeric_index // TODO: remove when we support expression indices
  = "-" _ number: number { return -number }
  / number

identity
  = "." {
    return input => input
  }

dot_name
  = "." name: name {
    return input => dotName(input, name)
  }

literal
  = value:
    ( string
    / number
    / "false" { return false }
    / "true"  { return true }
    / "null"  { return null }
    ) {
    return input => value
  }

string
  = '"' core: $[^"]* '"' { return core }
  / "'" core: $[^']* "'" { return core }

name
  = $([a-zA-Z_$][0-9a-zA-Z_$]*)

number
  = [.]*[0-9][.0-9]* {
    const chars = text()
    const value = +chars

    if (Number.isNaN(value)) {
      error(`Invalid numeric literal '${chars}'`)
    }

    return value
  }
