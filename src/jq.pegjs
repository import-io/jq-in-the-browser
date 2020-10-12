{
  const Functions0 = {
    // Bad
    "reverse": input => ([].concat(input).reverse()),
    "tonumber": input => input * 1,
    "tostring": input => ((typeof input === "object") ? JSON.stringify(input) : String(input)),

    // Good
    'ascii_downcase': input => {
      // as 'explode | map(if 65 <= . and . <= 90 then . + 32 else . end) | implode'
      if (!isString(input)) {
        throw new Error('ascii_downcase input must be a string.')
      }

      return input.replace(/[A-Z]/g, x => String.fromCharCode(x.charCodeAt(0) + 32))
    },
    'ascii_upcase': input => {
      // as 'explode | map(if 97 <= . and . <= 122 then . - 32 else . end) | implode'
      if (!isString(input)) {
        throw new Error('ascii_upcase input must be a string.')
      }

      return input.replace(/[a-z]/g, x => String.fromCharCode(x.charCodeAt(0) - 32))
    },
    'downcase': input => {
      if (!isString(input)) {
        throw new Error('downcase input must be a string.')
      }

      return input.toLowerCase()
    },
    'empty': input => {
      return undefined // an empty stream
    },
    'false': input => {
      return false
    },
    'from_entries': input => {
      // as 'map({(.key // .Key // .name // .Name): (if has("value") then .value else .Value end)}) | add | . //= {}'
      const stream = iterate(input)
      const result = {}

      forEach(stream, entry => {
        const key = checkKey(
          ifTrue(dotName(entry, 'key')) ??
          ifTrue(dotName(entry, 'Key')) ??
          ifTrue(dotName(entry, 'name')) ??
          dotName(entry, 'Name'))

        result[key] =
          has(entry, 'value') ? entry.value :
          has(entry, 'Value') ? entry.Value :
          null
      })

      return result
    },
    'keys': input => {
      if (Array.isArray(input)) {
        return input.map((value, index) => index)
      }
      if (!isObject(input)) {
        throw new Error(`${_mtype_v(input)} has no keys.`)
      }

      return Object.keys(input).sort()
    },
    'keys_unsorted': input => {
      if (!isObject(input)) {
        return Functions0.keys(input) // array
      }

      return Object.keys(input)
    },
    'length': input => {
      if (input === null) {
        return 0
      }
      if (Array.isArray(input) || isString(input)) {
        return input.length
      }
      if (isObject(input)) {
        return Object.keys(input).length
      }
      if (isNumber(input)) {
        return Math.abs(input)
      }

      throw new Error(`${_mtype_v(input)} has no length.`)
    },
    'not': input => {
      return !isTrue(input)
    },
    'null': input => {
      return null
    },
    'sort': input => {
      return sortBy(input, identity)
    },
    'to_entries': input => {
      // as '[keys_unsorted[] as $k | {key: $k, value: .[$k]}]'
      if (Array.isArray(input)) {
        return input.map((value, index) => ({ key: index, value }))
      }
      if (!isObject(input)) {
        throw new Error(`${_mtype_v(input)} has no keys.`)
      }

      const entries = Object.entries(input)
      convert(entries, ([key, value]) => ({ key, value }))
      return entries
    },
    'true': input => {
      return true
    },
    'upcase': input => {
      if (!isString(input)) {
        throw new Error('upcase input must be a string.')
      }

      return input.toUpperCase()
    },
  }

  const Functions1 = {
    // Bad
    "map_values": arg => input => {
      const pairs = Object.keys(input).map(key => ({[key]: arg(input[key])}))
      return Object.assign({}, ...pairs)
    },
    "with_entries": arg => input => {
      const from_entries = Functions0["from_entries"]
      const to_entries = Functions0["to_entries"]
      const mapped = to_entries(input).map(arg)
      return from_entries(mapped)
    },
    "join": arg => input => input.join(arg(input)),

    // Good
    'map': arg => input => {
      // as '[.[] | arg]'
      return toArray(map(iterate(input), arg))
    },
    'select': arg => input => {
      // as 'if arg then . else empty end'
      return map(arg(input), arg => isTrue(arg) ? input : undefined)
    },
    'sort_by': arg => input => {
      return sortBy(input, arg)
    },
  }

  const Keywords = [
    'and',
    'elif',
    'else',
    'end',
    'if',
    'or',
    'then',
  ]

  class Stream {
    constructor(items) {
      this.items = items
    }
  }

  const checkKey = (key) => {
    if (!isString(key)) {
      throw new Error(`Cannot use ${_mtype_v(key)} as object key.`)
    }

    return key
  }

  const compare = (a, b) => {
    if (a === b) {
      return 0
    }

    const typeOrder = (value) => {
      let i = 0; value === null
        || (++i, value === false)
        || (++i, value === true)
        || (++i, isNumber(value))
        || (++i, isString(value))
        || (++i, Array.isArray(value))
        || (++i)

      return i
    }

    const result = typeOrder(a) - typeOrder(b)
    if (result) {
      return result
    }

    // arrays

    if (Array.isArray(a)) {
      for (let i = 0, n = Math.min(a.length, b.length); i < n; ++i) {
        const result = compare(a[i], b[i])
        if (result) {
          return result
        }
      }

      return a.length - b.length
    }

    // objects

    if (!isObject(a)) {
      return a < b ? -1 : 1
    }

    a = Object.entries(a)
    b = Object.entries(b)

    const keyComparer = ([a], [b]) => a === b ? 0 : a < b ? -1 : 1
    a.sort(keyComparer)
    b.sort(keyComparer)

    for (let i = 0, n = Math.min(a.length, b.length); i < n; ++i) {
      const [ka, va] = a[i]
      const [kb, vb] = b[i]

      if (ka !== kb) {
        return ka < kb ? -1 : 1
      }

      const result = compare(va, vb)
      if (result) {
        return result
      }
    }

    return a.length - b.length
  }

  const compareForEquality = (a, b) => {
    if (a === b) {
      return true
    }

    // arrays

    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) {
        return false
      }

      for (let i = 0, n = a.length; i < n; ++i) {
        if (!compareForEquality(a[i], b[i])) {
          return false
        }
      }

      return true
    }

    // objects

    if (!isObject(a) || !isObject(b)) {
      return false
    }

    a = Object.entries(a)
    b = Object.entries(b)

    if (a.length !== b.length) {
      return false
    }

    const keyComparer = ([a], [b]) => a === b ? 0 : a < b ? -1 : 1
    a.sort(keyComparer)
    b.sort(keyComparer)

    for (let i = 0, n = a.length; i < n; ++i) {
      const [ka, va] = a[i]
      const [kb, vb] = b[i]

      if (ka !== kb || !compareForEquality(va, vb)) {
        return false
      }
    }

    return true
  }

  const concat = (streams) => {
    let length = 0
    let scalarCount = 0
    let streamCount = 0
    let last

    for (const value of streams) {
      if (value === undefined) {
        continue
      }

      if (!isStream(value)) {
        length += 1
        ++scalarCount
      }
      else {
        length += value.items.length
        ++streamCount
      }

      last = value
    }

    if (scalarCount + streamCount <= 1) {
      // a single scalar/stream or none at all
      return last
    }

    let array = streams
    if (array.length > scalarCount) {
      // there are some non-scalars
      array = new Array(length)

      let i = 0
      for (const value of streams) {
        if (value === undefined) {
          continue
        }
        if (!isStream(value)) {
          array[i++] = value
        }
        else for (const item of value.items) {
          array[i++] = item
        }
      }
    }

    return toStream(array)
  }

  const convert = (array, fn) => {
    for (let i = 0, n = array.length; i < n; ++i) {
      array[i] = fn(array[i])
    }
  }

  const dotName = (value, name, optional) => {
    if (value === null) {
      return null
    }
    if (!isObject(value)) {
      return optional
        ? undefined
        : throw new Error(`Cannot index ${_mtype(value)} with string "${name}".`)
    }

    return has(value, name) ? value[name] : null
  }

  const forEach = (stream, fn) => {
    if (stream === undefined) {
      return undefined
    }
    if (!isStream(stream)) {
      return fn(stream)
    }

    stream.items.forEach(fn)
  }

  const has = (value, key) => {
    return Object.prototype.hasOwnProperty.call(value, key)
  }

  const identity = (value) => {
    return value
  }

  const ifTrue = (value) => {
    return isTrue(value) ? value : undefined
  }

  const includes = (stream, value) => {
    if (stream === undefined) {
      return false
    }
    if (!isStream(stream)) {
      return stream === value
    }

    return stream.items.includes(value)
  }

  const isEmpty = (stream) => {
    if (stream === undefined) {
      return true
    }
    if (!isStream(stream)) {
      return false
    }

    return !stream.items.length
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

  const isStream = (value) => {
    if (value === null) {
      return false
    }

    return value.constructor === Stream
  }

  const isString = (value) => {
    if (value === null) {
      return false
    }

    return typeof value === 'string'
  }

  const isTrue = (value) => {
    return value !== null && value !== false
  }

  const iterate = (value, optional) => {
    if (Array.isArray(value)) {
      return toStream(value)
    }
    if (isObject(value)) {
      return toStream(Object.values(value))
    }

    return optional
      ? undefined
      : throw new Error(`Cannot iterate over ${_mtype_v(value)}.`)
  }

  const map = (stream, fn) => {
    if (stream === undefined) {
      return undefined
    }
    if (!isStream(stream)) {
      return fn(stream)
    }

    return concat(stream.items.map(fn))
  }

  const product = (stream1, stream2, fn) => {
    if (stream1 === undefined || stream2 === undefined) {
      return undefined
    }
    if (!isStream(stream1)) {
      return map(stream2, b => fn(stream1, b))
    }
    if (!isStream(stream2)) {
      return map(stream1, a => fn(a, stream2))
    }

    stream1 = stream1.items
    stream2 = stream2.items

    const streams = new Array(stream1.length * stream2.length)

    let i = 0
    for (const b of stream2)
    for (const a of stream1) {
      streams[i++] = fn(a, b)
    }

    return concat(streams)
  }

  const reduce = (left, rest, stop, fn) => {
    for (let i = 0, n = rest.length; i < n; ++i) {
      if (stop(left)) {
        break
      }

      left = fn(left, rest[i])
    }

    return left
  }

  const sortBy = (value, fn) => {
    if (!Array.isArray(value)) {
      throw new Error(`${_mtype_v(value)} cannot be sorted, as it is not an array.`)
    }
    if (value.length <= 1) {
      return value
    }
    if (fn === identity) {
      return [...value].sort(compare)
    }

    const indexes = new Array(value.length)
    const keys = new Array(value.length)
    let someKeysAreStreams = false

    for (let i = 0, n = value.length; i < n; ++i) {
      const key = fn(value[i])
      indexes[i] = i
      keys[i] = key
      someKeysAreStreams ||= key === undefined || isStream(key)
    }

    if (someKeysAreStreams) {
      convert(keys, toArray)
    }

    indexes.sort((a, b) => compare(keys[a], keys[b]))
    convert(indexes, i => value[i])
    return indexes
  }

  const toArray = (stream) => {
    if (stream === undefined) {
      return []
    }
    if (!isStream(stream)) {
      return [stream]
    }

    return stream.items
  }

  const toStream = (array) => {
    if (array.length == 0) {
      return undefined
    }
    if (array.length == 1) {
      return array[0]
    }

    return new Stream(array)
  }

  const parseIf = (cond, left, right) => {
    return input => map(cond(input), cond =>
      isTrue(cond) ? left(input) : right(input))
  }

  const parsePipe = (left, rest) => {
    if (!rest.length) {
      return left
    }

    rest = rest.map(rest => rest[3])
    return input => reduce(left(input), rest, isEmpty, map)
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

Output
  = _ expr: Expr _ {
    return input => {
      if (input === undefined) {
        return []
      }

      return toArray(expr(input))
    }
  }

_
  = $SpaceChar*

SpaceChar 'space'
  = [ \n\t]

Expr
  = left: Stream rest: (_ "|" _ Stream)* {
    return parsePipe(left, rest)
  }

ExprSimple // for object construction
  = left: Alternative rest: (_ "|" _ Alternative)* {
    return parsePipe(left, rest)
  }

Stream
  = left: Alternative rest: (_ "," _ Alternative)* {
    if (!rest.length) {
      return left
    }

    rest = rest.map(rest => rest[3])
    const all = [left, ...rest]
    return input => concat(all.map(expr => expr(input)))
  }

Alternative
  = left: Or rest: (_ "//" _ Or)* {
    if (!rest.length) {
      return left
    }

    rest = rest.map(rest => rest[3])
    const last = rest[rest.length - 1]
    --rest.length

    const prep = (input, expr) =>
      map(expr(input), ifTrue)

    const stop = left =>
      !isEmpty(left)

    const reducer = input => (left, next) =>
      prep(input, next)

    return input => {
      const result = reduce(
        prep(input, left), rest, stop, reducer(input))

      if (!isEmpty(result)) {
        return result
      }

      return last(input)
    }
  }

Or
  = left: And rest: (_ "or" B$ _ And)* {
    if (!rest.length) {
      return left
    }

    rest = rest.map(rest => rest[4])

    const prep = (input, expr) =>
      map(expr(input), isTrue)

    const stop = left =>
      !includes(left, false)

    const reducer = input => (left, next) => {
      next = prep(input, next)
      return map(left, left => left || next)
    }

    return input => reduce(
      prep(input, left), rest, stop, reducer(input))
  }

And
  = left: Comparison rest: (_ "and" B$ _ Comparison)* {
    if (!rest.length) {
      return left
    }

    rest = rest.map(rest => rest[4])

    const prep = (input, expr) =>
      map(expr(input), isTrue)

    const stop = left =>
      !includes(left, true)

    const reducer = input => (left, next) => {
      next = prep(input, next)
      return map(left, left => left && next)
    }

    return input => reduce(
      prep(input, left), rest, stop, reducer(input))
  }

Comparison
  = left: AddSub right: (_ CompareOp _ AddSub)? {
    if (!right) {
      return left
    }

    const [, op,, next] = right
    return input => {
      const first = left(input)
      if (isEmpty(first)) {
        return undefined
      }

      return product(first, next(input), op)
    }
  }

CompareOp
  = "==" {
    return compareForEquality
  }
  / "!=" {
    return (a, b) => !compareForEquality(a, b)
  }
  / "<=" {
    return (a, b) => compare(a, b) <= 0
  }
  / "<" {
    return (a, b) => compare(a, b) < 0
  }
  / ">=" {
    return (a, b) => compare(a, b) >= 0
  }
  / ">" {
    return (a, b) => compare(a, b) > 0
  }

AddSub
  = left: MulDiv rest: (_ AddSubOp _ MulDiv)* {
    if (!rest.length) {
      return left
    }

    rest = rest.map(([, op,, expr]) => ({ op, expr }))

    const reducer = input => (left, next) =>
      product(left, next.expr(input), next.op)

    return input => reduce(
      left(input), rest, isEmpty, reducer(input))
  }

AddSubOp
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

      throw new Error(`${_mtype_v(a)} and ${_mtype_v(b)} cannot be added.`)
    }
  }
  / "-" {
    return (a, b) => {
      if (isNumber(a) && isNumber(b)) {
        return a - b
      }

      throw new Error(`${_mtype_v(a)} and ${_mtype_v(b)} cannot be subtracted.`)
    }
  }

MulDiv
  = left: Negation rest: (_ MulDivOp _ Negation)* {
    if (!rest.length) {
      return left
    }

    rest = rest.map(([, op,, expr]) => ({ op, expr }))

    const reducer = input => (left, next) =>
      product(left, next.expr(input), next.op)

    return input => reduce(
      left(input), rest, isEmpty, reducer(input))
  }

MulDivOp
  = "*" {
    return (a, b) => {
      if (isNumber(a) && isNumber(b)) {
        return a * b
      }

      throw new Error(`${_mtype_v(a)} and ${_mtype_v(b)} cannot be multiplied.`)
    }
  }
  / "/" {
    return (a, b) => {
      if (isNumber(a) && isNumber(b)) {
        return a / b
      }

      throw new Error(`${_mtype_v(a)} and ${_mtype_v(b)} cannot be divided.`)
    }
  }
  / "%" {
    return (a, b) => {
      if (isNumber(a) && isNumber(b)) {
        return a % b + 0 // must return 0 instead of -0
      }

      throw new Error(`${_mtype_v(a)} and ${_mtype_v(b)} cannot be divided (remainder).`)
    }
  }

Negation
  = minuses: ("-" _)* right: (If / Filter) {
    let count = minuses.length
    if (!count) {
      return right
    }

    count %= 2
    return input => map(right(input), right => {
      if (!isNumber(right)) {
        throw new Error(`${_mtype_v(right)} cannot be negated.`)
      }
      if (!count) {
        return right
      }

      return -right
    })
  }

If
  = "if" B$ _ cond: Expr _ "then" B$ _ left: Expr _ right: Else {
    return parseIf(cond, left, right)
  }

Else
  = "else" B$ _ expr: Expr _ "end" B$ {
    return expr
  }
  / "elif" B$ _ cond: Expr _ "then" B$ _ left: Expr _ right: Else {
    return parseIf(cond, left, right)
  }

Filter
  = left: FilterHead rest: (_ Transform)* {
    if (!rest.length) {
      return left
    }

    rest = rest.map(([, expr]) => expr)
    return input => reduce(left(input), rest, isEmpty, map)
  }

FilterHead
  = Parens
  / ArrayConstruction
  / ObjectConstruction
  / Literal
  / DotName
  / Dot
  / Function1
  / Function0

Parens
  = "(" _ expr: Expr _ ")" { return expr }

Function1
  = name: FunctionName _ "(" _ arg: Expr _ ")" {
    if (has(Functions1, name)) {
      return Functions1[name](arg)
    }

    error(has(Functions0, name)
      ? `Function "${name}" accepts no parameters.`
      : `Function "${name}" is not defined.`)
  }

Function0
  = name: FunctionName {
    if (has(Functions0, name)) {
      return Functions0[name]
    }

    error(has(Functions1, name)
      ? `Function "${name}" requires a parameter.`
      : `Function "${name}" is not defined.`)
  }

FunctionName 'function name'
  = name: Name & {
    return !Keywords.includes(name)
  } {
    return name
  }

ArrayConstruction
  = "[" _ "]" {
    return input => []
  }
  / "[" _ items: Expr _ "]" {
    return input => toArray(items(input))
  }

ObjectConstruction
  = "{" _ "}" {
    return input => ({})
  }
  / "{" _ left: ObjectProp rest: (_ "," _ ObjectProp)* (_ ",")? _ "}" {
    if (!rest.length) {
      return left
    }

    rest = rest.map(rest => rest[3])

    const reducer = input => (left, next) =>
      product(next(input), left, (next, left) => ({ ...left, ...next }))

    return input => reduce(
      left(input), rest, isEmpty, reducer(input))
  }

ObjectProp
  = key: ObjectKey _ ":" _ value: ExprSimple {
    return input => {
      const keys = key(input)
      if (isEmpty(keys)) {
        return undefined
      }

      return product(value(input), keys, (value, key) =>
        ({ [checkKey(key)]: value }))
    }
  }

ObjectKey
  = name: (Name / String) {
    return input => name
  }
  / Parens

Transform
  = BracketTransform
  / DotName

BracketTransform
  = "[" _ "]" optional: (_ "?")? {
    optional = optional !== null
    return input => iterate(input, optional)
  }
  / "[" _ index_expr: (NumericIndex / String) _ "]" optional: (_ "?")? {
    optional = optional !== null
    return input => {
      let index = index_expr // TODO: expression indices
      if (isString(index)) {
        return dotName(input, index, optional)
      }
      if (input !== null && !Array.isArray(input) || !isNumber(index)) {
        return optional
          ? undefined
          : throw new Error(`Cannot index ${_mtype(input)} with ${_mtype(index)}.`)
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
  / "[" _ start: NumericIndex? _ ":" _ end: NumericIndex? _ "]" optional: (_ "?")? & {
    return start || end // for JQ compliance
  } {
    optional = optional !== null
    return input => {
      if (input === null) {
        return null
      }
      if (!Array.isArray(input) && !isString(input)) {
        return optional
          ? undefined
          : throw new Error(`Cannot index ${_mtype(input)} with object.`)
      }
      if (start !== null && !isNumber(start) || end !== null && !isNumber(end)) {
        return optional
          ? undefined
          : throw new Error(`Start and end indices of an ${_mtype(input)} slice must be numbers.`)
      }

      const startIndex = start ? Math.floor(start) : 0 // TODO: expression indices
      const endIndex = end ? Math.ceil(end) : undefined // TODO: expression indices
      return input.slice(startIndex, endIndex)
    }
  }

NumericIndex // TODO: remove when we support expression indices
  = "-" _ number: Number { return -number }
  / Number

Dot
  = "." {
    return identity
  }

DotName
  = "." name: Name optional: (_ "?")? {
    optional = optional !== null
    return input => dotName(input, name, optional)
  }

Literal
  = value: (String / Number) {
    return input => value
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
