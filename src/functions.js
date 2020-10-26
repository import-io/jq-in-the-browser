import * as jq from './core.js'

export const fn0 = {}
export const fn1 = {}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L200
  def ascii_downcase:
    explode | map(if 65 <= . and . <= 90 then . + 32 else . end) | implode;
*/
fn0['ascii_downcase'] = (input) => {
  if (!jq.isString(input)) {
    throw new Error('ascii_downcase input must be a string.')
  }

  return input.replace(/[A-Z]/g, x => String.fromCharCode(x.charCodeAt(0) + 32))
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L203
  def ascii_upcase:
    explode | map(if 97 <= . and . <= 122 then . - 32 else . end) | implode;
*/
fn0['ascii_upcase'] = (input) => {
  if (!jq.isString(input)) {
    throw new Error('ascii_upcase input must be a string.')
  }

  return input.replace(/[a-z]/g, x => String.fromCharCode(x.charCodeAt(0) - 32))
}

fn0['downcase'] = (input) => {
  if (!jq.isString(input)) {
    throw new Error('downcase input must be a string.')
  }

  return input.toLowerCase()
}

fn0['empty'] = (input) => {
  return undefined // an empty stream
}

fn0['false'] = (input) => {
  return false
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L24
  def from_entries:
    map({(.key // .Key // .name // .Name): (if has("value") then .value else .Value end)}) | add | . //= {};
*/
fn0['from_entries'] = (input) => {
  const stream = jq.iterate(input)
  const result = {}

  jq.forEach(stream, entry => {
    const key = jq.checkKey(
      jq.ifTrue(jq.dotName(entry, 'key')) ??
      jq.ifTrue(jq.dotName(entry, 'Key')) ??
      jq.ifTrue(jq.dotName(entry, 'name')) ??
      jq.dotName(entry, 'Name'))

    result[key] =
      jq.has(entry, 'value') ? entry.value :
      jq.has(entry, 'Value') ? entry.Value :
      null
  })

  return result
}

fn0['infinite'] = (input) => {
  return Infinity
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L35
  def isfinite: type == "number" and (isinfinite | not);
*/
fn0['isfinite'] = (input) => {
  return Number.isFinite(input) || Number.isNaN(input)
}

fn0['isinfinite'] = (input) => {
  return input === Infinity || input === -Infinity
}

fn0['isnan'] = (input) => {
  return Number.isNaN(input)
}

fn0['isnormal'] = (input) => {
  return Number.isFinite(input) && input !== 0
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L48
  def join($x): reduce .[] as $i (null;
    (if . == null then "" else . + $x end) +
    ($i | if type == "boolean" or type == "number" then tostring else . // "" end)
  ) // "";
*/
fn1['join'] = (input, separator) => {
  const isStringArray =
    jq.isArray(input) && input.every(jq.isString)

  return jq.map(separator(input), separator => {
    // fast path
    if (isStringArray && (separator === null || jq.isString(separator))) {
      return input.join(separator ?? '')
    }

    // slow path (JQ algorithm)
    const stream = jq.iterate(input)
    let result = ''

    jq.forEach(stream, (value, index) => {
      if (index) {
        result = jq.add(result, separator)
      }
      if (jq.isBoolean(value) || jq.isNumber(value)) {
        value = fn0.tostring(value)
      }

      result = jq.add(result, value)
    })

    return result
  })
}

fn0['keys'] = (input) => {
  if (jq.isArray(input)) {
    return input.map((value, index) => index)
  }
  if (!jq.isObject(input)) {
    throw new Error(`${jq._mtype_v(input)} has no keys.`)
  }

  return Object.keys(input).sort()
}

fn0['keys_unsorted'] = (input) => {
  if (!jq.isObject(input)) {
    // try to handle as an array
    return fn0.keys(input)
  }

  return Object.keys(input)
}

fn0['length'] = (input) => {
  if (input === null) {
    return 0
  }
  if (jq.isArray(input) || jq.isString(input)) {
    return input.length
  }
  if (jq.isObject(input)) {
    return Object.keys(input).length
  }
  if (jq.isNumber(input)) {
    return Math.abs(input)
  }

  throw new Error(`${jq._mtype_v(input)} has no length.`)
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L3
  def map(f): [.[] | f];
*/
fn1['map'] = (input, transform) => {
  let temp = input
  temp = jq.iterate(temp)
  temp = jq.map(temp, transform)
  return jq.toArray(temp)
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L15
  def map_values(f): .[] |= f;
*/
fn1['map_values'] = (input, transform) => {
  if (!jq.isObject(input)) {
    // try to handle as an array
    return fn1.map(input, value => jq.first(transform(value)))
  }

  const result = {}
  for (const key of Object.keys(input)) {
    const value = jq.first(transform(input[key]))
    if (value !== undefined) {
      result[key] = value
    }
  }

  return result
}

fn0['nan'] = (input) => {
  return NaN
}

fn0['not'] = (input) => {
  return !jq.isTrue(input)
}

fn0['null'] = (input) => {
  return null
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L26
  def reverse: [.[length - 1 - range(0;length)]];
*/
fn0['reverse'] = (input) => {
  if (!fn0.length(input)) {
    return [] // for JQ conformance
  }
  if (!jq.isArray(input)) {
    throw new Error(`${jq._mtype_v(input)} cannot be reversed, as it is not an array.`)
  }

  return [...input].reverse()
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L4
  def select(f): if f then . else empty end;
*/
fn1['select'] = (input, predicate) => {
  return jq.map(predicate(input), value => jq.isTrue(value) ? input : undefined)
}

fn0['sort'] = (input) => {
  return jq.sortBy(input, jq.identity)
}

fn1['sort_by'] = (input, keySelector) => {
  return jq.sortBy(input, keySelector)
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L23
  def to_entries: [keys_unsorted[] as $k | {key: $k, value: .[$k]}];
*/
fn0['to_entries'] = (input) => {
  if (jq.isArray(input)) {
    return input.map((value, index) => ({ key: index, value }))
  }
  if (!jq.isObject(input)) {
    throw new Error(`${jq._mtype_v(input)} has no keys.`)
  }

  const entries = Object.entries(input)
  jq.convert(entries, ([key, value]) => ({ key, value }))
  return entries
}

fn0['tonumber'] = (input) => {
  if (jq.isNumber(input)) {
    return input
  }

  if (jq.isString(input)) {
    let string = input.trim()
    if (string) {
      const number = +string
      if (!Number.isNaN(number)) {
        return number
      }

      string = string.toLowerCase()
      if (string === 'nan' || string === '+nan' || string === '-nan') {
        return NaN
      }
      if (string === 'infinity' || string === '+infinity') {
        return Infinity
      }
      if (string === '-infinity') {
        return -Infinity
      }
    }
  }

  throw new Error(`${jq._mtype_v(input)} cannot be parsed as a number.`)
}

fn0['tostring'] = (input) => {
  if (jq.isString(input)) {
    return input
  }

  return jq.stringify(input)
}

fn0['true'] = (input) => {
  return true
}

fn0['upcase'] = (input) => {
  if (!jq.isString(input)) {
    throw new Error('upcase input must be a string.')
  }

  return input.toUpperCase()
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L25
  def with_entries(f): to_entries | map(f) | from_entries;
*/
fn1['with_entries'] = (input, transform) => {
  let temp = input
  temp = fn0.to_entries(temp)
  temp = fn1.map(temp, transform)
  return fn0.from_entries(temp)
}

Object.freeze(fn0)
Object.freeze(fn1)
