class Stream {
  constructor(items) {
    this.items = items
  }
}

export const add = (a, b) => {
  if (a === null) {
    return b
  }
  if (b === null) {
    return a
  }

  if (isNumber(a)) {
    if (isNumber(b)) {
      return a + b
    }
  }
  else if (isString(a)) {
    if (isString(b)) {
      return a + b
    }
  }
  else if (isArray(a)) {
    if (isArray(b)) {
      return [...a, ...b]
    }
  }
  else if (isObject(a)) {
    if (isObject(b)) {
      return { ...a, ...b }
    }
  }

  throw new Error(`${_mtype_v(a)} and ${_mtype_v(b)} cannot be added.`)
}

export const areEqual = (a, b) => {
  if (a === b) {
    return true
  }

  // arrays

  if (isArray(a)) {
    if (!isArray(b) || a.length !== b.length) {
      return false
    }

    for (let i = 0, n = a.length; i < n; ++i) {
      if (!areEqual(a[i], b[i])) {
        return false
      }
    }

    return true
  }

  // primitives

  if (!isObject(a) || !isObject(b)) {
    return false
  }

  // objects

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

    if (ka !== kb || !areEqual(va, vb)) {
      return false
    }
  }

  return true
}

export const checkKey = (key) => {
  if (!isString(key)) {
    throw new Error(`Cannot use ${_mtype_v(key)} as object key.`)
  }

  return key
}

export const compare = (a, b) => {
  if (a === b) {
    return 0
  }

  const typeOrder = (value) => {
    let i = 0; value === null
      || (++i, value === false)
      || (++i, value === true)
      || (++i, Number.isNaN(value))
      || (++i, isNumber(value))
      || (++i, isString(value))
      || (++i, isArray(value))
      || (++i, isObject(value))
      || (i = Infinity)

    return i
  }

  const result = typeOrder(a) - typeOrder(b)
  if (result) {
    return result
  }
  if (Number.isNaN(result) || Number.isNaN(a)) {
    // both sides are either of unknown type (Infinity - Infinity -> NaN) or NaNs
    return 0
  }

  // arrays

  if (isArray(a)) {
    for (let i = 0, n = Math.min(a.length, b.length); i < n; ++i) {
      const result = compare(a[i], b[i])
      if (result) {
        return result
      }
    }

    return a.length - b.length
  }

  // primitives

  if (!isObject(a)) {
    return a < b ? -1 : 1
  }

  // objects

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

export const concat = (streams) => {
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

export const convert = (array, fn) => {
  for (let i = 0, n = array.length; i < n; ++i) {
    array[i] = fn(array[i])
  }
}

export const divide = (a, b) => {
  if (isNumber(a) && isNumber(b)) {
    return a / b
  }

  throw new Error(`${_mtype_v(a)} and ${_mtype_v(b)} cannot be divided.`)
}

export const dotName = (value, name, optional) => {
  if (value === null) {
    return null
  }
  if (!isObject(value)) {
    if (optional) return undefined
    const safeName = name.length < 30 ? `string "${name}"` : 'string'
    throw new Error(`Cannot index ${_mtype(value)} with ${safeName}.`)
  }

  return has(value, name) ? value[name] : null
}

export const first = (stream) => {
  if (stream === undefined) {
    return undefined
  }
  if (!isStream(stream)) {
    return stream
  }
  if (!stream.items.length) {
    return undefined
  }

  return stream.items[0]
}

export const forEach = (stream, fn) => {
  if (stream === undefined) {
    return undefined
  }
  if (!isStream(stream)) {
    return fn(stream)
  }

  stream.items.forEach(fn)
}

export const has = (value, key) => {
  return Object.prototype.hasOwnProperty.call(value, key)
}

export const identity = (value) => {
  return value
}

export const ifTrue = (value) => {
  return isTrue(value) ? value : undefined
}

export const includes = (stream, value) => {
  if (stream === undefined) {
    return false
  }
  if (!isStream(stream)) {
    return stream === value
  }

  return stream.items.includes(value)
}

export const isArray = (value) => {
  return Array.isArray(value)
}

export const isBoolean = (value) => {
  return value === false || value === true
}

export const isEmpty = (stream) => {
  if (stream === undefined) {
    return true
  }
  if (!isStream(stream)) {
    return false
  }

  return !stream.items.length
}

export const isNumber = (value) => {
  if (value === null) {
    return false
  }

  return typeof value === 'number'
}

export const isObject = (value) => {
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

export const isString = (value) => {
  if (value === null) {
    return false
  }

  return typeof value === 'string'
}

export const isTrue = (value) => {
  return value !== null && value !== false
}

export const iterate = (value, optional) => {
  if (isArray(value)) {
    return toStream(value)
  }
  if (isObject(value)) {
    return toStream(Object.values(value))
  }

  if (optional) return undefined
  throw new Error(`Cannot iterate over ${_mtype_v(value)}.`)
}

export const map = (stream, fn) => {
  if (stream === undefined) {
    return undefined
  }
  if (!isStream(stream)) {
    return fn(stream)
  }

  return concat(stream.items.map(fn))
}

export const modulo = (a, b) => {
  if (isNumber(a) && isNumber(b)) {
    return a % b + 0 // must return 0 instead of -0
  }

  throw new Error(`${_mtype_v(a)} and ${_mtype_v(b)} cannot be divided (remainder).`)
}

export const multiply = (a, b) => {
  if (isNumber(a) && isNumber(b)) {
    return a * b
  }

  throw new Error(`${_mtype_v(a)} and ${_mtype_v(b)} cannot be multiplied.`)
}

export const product = (stream1, stream2, fn) => {
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

export const sortBy = (value, fn) => {
  if (!isArray(value)) {
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

export const stringify = (value) => {
  if (isNumber(value)) {
    // for NaN and Infinity
    return value.toString()
  }

  // for JQ conformance
  const replacer = (key, value) =>
    value ===  Infinity ?  Number.MAX_VALUE :
    value === -Infinity ? -Number.MAX_VALUE :
    value

  return JSON.stringify(value, replacer)
}

export const subtract = (a, b) => {
  if (isNumber(a) && isNumber(b)) {
    return a - b
  }

  throw new Error(`${_mtype_v(a)} and ${_mtype_v(b)} cannot be subtracted.`)
}

export const toArray = (stream) => {
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

// Message formatting helpers. Don't use for other purposes.

export const _mtype = (value) => {
  if (value === null) {
    return 'null'
  }
  if (Array.isArray(value)) {
    return 'array'
  }

  return typeof value
}

export const _mtype_v = (value) => {
  const type = _mtype(value)
  value = stringify(value)

  if (value.length > 14) {
    value = value.slice(0, 14 - 3) + '...'
  }

  return `${type} (${value})`
}
