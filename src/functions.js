import * as jq from './core.js'

const fn = {}
export default fn

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L200
  def ascii_downcase:
    explode | map(if 65 <= . and . <= 90 then . + 32 else . end) | implode;
*/
fn['ascii_downcase/0'] = (input) => {
  if (!jq.isString(input)) {
    throw new jq.DataError('ascii_downcase input must be a string.')
  }

  return input.replace(/[A-Z]/g, x => String.fromCharCode(x.charCodeAt(0) + 32))
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L203
  def ascii_upcase:
    explode | map(if 97 <= . and . <= 122 then . - 32 else . end) | implode;
*/
fn['ascii_upcase/0'] = (input) => {
  if (!jq.isString(input)) {
    throw new jq.DataError('ascii_upcase input must be a string.')
  }

  return input.replace(/[a-z]/g, x => String.fromCharCode(x.charCodeAt(0) - 32))
}

fn['downcase/0'] = (input) => {
  if (!jq.isString(input)) {
    throw new jq.DataError('downcase input must be a string.')
  }

  return input.toLowerCase()
}

fn['empty/0'] = () => {
  return undefined // an empty stream
}

fn['false/0'] = () => {
  return false
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L24
  def from_entries:
    map({(.key // .Key // .name // .Name): (if has("value") then .value else .Value end)}) | add | . //= {};
*/
fn['from_entries/0'] = (input) => {
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

fn['infinite/0'] = () => {
  return Infinity
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L35
  def isfinite: type == "number" and (isinfinite | not);
*/
fn['isfinite/0'] = (input) => {
  return Number.isFinite(input) || Number.isNaN(input)
}

fn['isinfinite/0'] = (input) => {
  return input === Infinity || input === -Infinity
}

fn['isnan/0'] = (input) => {
  return Number.isNaN(input)
}

fn['isnormal/0'] = (input) => {
  return Number.isFinite(input) && input !== 0
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L48
  def join($x): reduce .[] as $i (null;
    (if . == null then "" else . + $x end) +
    ($i | if type == "boolean" or type == "number" then tostring else . // "" end)
  ) // "";
*/
fn['join/1'] = (input, separator) => {
  separator = separator(input)
  if (jq.isEmpty(separator)) {
    return undefined
  }

  const isStringArray =
    jq.isArray(input) && input.every(jq.isString)

  return jq.map(separator, separator => {
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
        value = fn['tostring/0'](value)
      }

      result = jq.add(result, value)
    })

    return result
  })
}

fn['keys/0'] = (input) => {
  if (jq.isArray(input)) {
    return input.map((value, index) => index)
  }
  if (!jq.isObject(input)) {
    throw new jq.DataError(`${jq._mtype_v(input)} has no keys.`)
  }

  return Object.keys(input).sort()
}

fn['keys_unsorted/0'] = (input) => {
  if (!jq.isObject(input)) {
    // try to handle as an array
    return fn['keys/0'](input)
  }

  return Object.keys(input)
}

fn['length/0'] = (input) => {
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

  throw new jq.DataError(`${jq._mtype_v(input)} has no length.`)
}

fn['ltrimstr/1'] = (input, prefix) => {
  return jq.map(prefix(input), prefix => {
    if (!jq.isString(input) || !jq.isString(prefix)) {
      return input // JQ doesn't throw here
    }
    if (!prefix || !input.startsWith(prefix)) {
      return input
    }

    return input.slice(prefix.length)
  })
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L3
  def map(f): [.[] | f];
*/
fn['map/1'] = (input, transform) => {
  let temp = input
  temp = jq.iterate(temp)
  temp = jq.map(temp, transform)
  return jq.toArray(temp)
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L15
  def map_values(f): .[] |= f;
*/
fn['map_values/1'] = (input, transform) => {
  if (!jq.isObject(input)) {
    // try to handle as an array
    return fn['map/1'](input, value => jq.first(transform(value)))
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

fn['nan/0'] = () => {
  return NaN
}

fn['not/0'] = (input) => {
  return !jq.isTrue(input)
}

fn['null/0'] = () => {
  return null
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L26
  def reverse: [.[length - 1 - range(0;length)]];
*/
fn['reverse/0'] = (input) => {
  if (!fn['length/0'](input)) {
    return [] // for JQ conformance
  }
  if (!jq.isArray(input)) {
    throw new jq.DataError(`${jq._mtype_v(input)} cannot be reversed, as it is not an array.`)
  }

  return [...input].reverse()
}

fn['rtrimstr/1'] = (input, suffix) => {
  return jq.map(suffix(input), suffix => {
    if (!jq.isString(input) || !jq.isString(suffix)) {
      return input // JQ doesn't throw here
    }
    if (!suffix || !input.endsWith(suffix)) {
      return input
    }

    return input.slice(0, -suffix.length)
  })
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L4
  def select(f): if f then . else empty end;
*/
fn['select/1'] = (input, predicate) => {
  return jq.map(predicate(input), value => jq.isTrue(value) ? input : undefined)
}

fn['sort/0'] = (input) => {
  return jq.sortBy(input, jq.identity)
}

fn['sort_by/1'] = (input, keySelector) => {
  return jq.sortBy(input, keySelector)
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L23
  def to_entries: [keys_unsorted[] as $k | {key: $k, value: .[$k]}];
*/
fn['to_entries/0'] = (input) => {
  if (jq.isArray(input)) {
    return input.map((value, index) => ({ key: index, value }))
  }
  if (!jq.isObject(input)) {
    throw new jq.DataError(`${jq._mtype_v(input)} has no keys.`)
  }

  const entries = Object.entries(input)
  jq.convert(entries, ([key, value]) => ({ key, value }))
  return entries
}

fn['tonumber/0'] = (input) => {
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

  throw new jq.DataError(`${jq._mtype_v(input)} cannot be parsed as a number.`)
}

fn['tostring/0'] = (input) => {
  if (jq.isString(input)) {
    return input
  }

  return jq.stringify(input)
}

fn['true/0'] = () => {
  return true
}

fn['upcase/0'] = (input) => {
  if (!jq.isString(input)) {
    throw new jq.DataError('upcase input must be a string.')
  }

  return input.toUpperCase()
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L25
  def with_entries(f): to_entries | map(f) | from_entries;
*/
fn['with_entries/1'] = (input, transform) => {
  let temp = input
  temp = fn['to_entries/0'](temp)
  temp = fn['map/1'](temp, transform)
  return fn['from_entries/0'](temp)
}

Object.freeze(fn)
