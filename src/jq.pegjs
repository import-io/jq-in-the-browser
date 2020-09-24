{
  const get_function_0 = name => {
    const f = function0_map[name]
    if (f === undefined) throw new Error(`function ${name}/0 is not defined.`)
    return f
  }

  const get_function_1 = name => {
    const f = function1_map[name]
    if (f === undefined) throw new Error(`function ${name}/1 is not defined.`)
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
    'null': input => {
      return null
    },
    'sort': input => {
      return sortBy(input, identity)
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

  const function1_map = {
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

  class Stream {
    constructor(items) {
      this.items = items
    }
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
      for (let i = 0; i < a.length && i < b.length; ++i) {
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

    for (let i = 0; i < a.length && i < b.length; ++i) {
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

      for (let i = 0; i < a.length; ++i) {
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

    for (let i = 0; i < a.length; ++i) {
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
    for (let i = 0; i < array.length; ++i) {
      array[i] = fn(array[i])
    }
  }

  const dotName = (value, name) => {
    if (value === null) {
      return null
    }
    if (!isObject(value)) {
      throw new Error(`Cannot index ${_mtype(value)} with string "${name}".`)
    }

    return value.hasOwnProperty(name) ? value[name] : null
  }

  const identity = (value) => {
    return value
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

  const iterate = (value) => {
    if (isObject(value)) {
      value = Object.values(value)
    }
    else if (!Array.isArray(value)) {
      throw new Error(`Cannot iterate over ${_mtype_v(value)}.`)
    }

    return toStream(value)
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

    for (let i = 0; i < value.length; ++i) {
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
  = first: comparison rest: (_ "," _ comparison)* {
    if (!rest.length) {
      return first
    }

    rest = rest.map(([,,, expr]) => expr)
    const all = [first, ...rest]
    return input => concat(all.map(expr => expr(input)))
  }

comparison
  = left: addsub tail: (_ compare_op _ addsub)? {
    if (!tail) {
      return left
    }

    const [, op,, right] = tail
    return input => product(left(input), right(input), op)
  }

compare_op
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

addsub
  = first: muldiv rest: (_ addsub_op _ muldiv)* {
    if (!rest.length) {
      return first
    }

    rest = rest.map(([, op,, expr]) => ({ op, expr }))
    return input => rest.reduce((result, next) =>
      product(result, next.expr(input), next.op),
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

muldiv
  = first: negation rest: (_ muldiv_op _ negation)* {
    if (!rest.length) {
      return first
    }

    rest = rest.map(([, op,, expr]) => ({ op, expr }))
    return input => rest.reduce((result, next) =>
      product(result, next.expr(input), next.op),
      first(input))
  }

muldiv_op
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

negation
  = minuses: ("-" _)* expr: parens {
    const count = minuses.length
    if (!count) {
      return expr
    }

    return input => map(expr(input), value => {
      if (!isNumber(value)) {
        throw new Error(`${_mtype_v(value)} cannot be negated.`)
      }
      if (!(count % 2)) {
        return value
      }

      return -value
    })
  }

parens // TODO: "({}).name" shouldn't fail
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
      product(expr(input), result, (prop, object) => ({ ...object, ...prop })),
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
    return input => iterate(input)
  }
  / "[" _ index_expr: (numeric_index / string) _ "]" {
    return input => {
      let index = index_expr // TODO: expression indices
      if (isString(index)) {
        return dotName(input, index)
      }
      if (input !== null && !Array.isArray(input) || !isNumber(index)) {
        throw new Error(`Cannot index ${_mtype(input)} with ${_mtype(index)}.`)
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
      if (!Array.isArray(input) && !isString(input)) {
        throw new Error(`Cannot index ${_mtype(input)} with object.`)
      }
      if (start !== null && !isNumber(start) || end !== null && !isNumber(end)) {
        throw new Error(`Start and end indices of an ${_mtype(input)} slice must be numbers.`)
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
    return identity
  }

dot_name
  = "." name: name {
    return input => dotName(input, name)
  }

literal
  = value: (string / number) {
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
      error(`Invalid numeric literal '${chars}'.`)
    }

    return value
  }
