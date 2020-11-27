import * as jq from './core.js'

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L70
  def capture(re; mods):
    match(re; mods)
    | reduce (.captures | .[] | select(.name != null) | {(.name): .string}) as $pair ({}; . + $pair);
*/
export const capture = (input, pattern, flags) => {
  const matches = apply(input, pattern, flags, APPLY_FIX_GROUPS)
  jq.convert(matches, match => match.groups)
  return jq.toStream(matches)
}

export const capturePolymorphic = (input, args) => {
  return polymorphicCall(capture, input, args)
}

export const match = (input, pattern, flags) => {
  const matches = apply(input, pattern, flags)
  jq.convert(matches, match => {
    const string = match[0]
    return {
      offset: match.index,
      length: string.length,
      string,
      captures: getCaptures(match, string => ({
        offset: '<not supported>',
        length: string !== undefined ? string.length : 0,
        string: string !== undefined ? string : null,
        name:   '<not supported>',
      })),
    }
  })

  return jq.toStream(matches)
}

export const matchPolymorphic = (input, args) => {
  return polymorphicCall(match, input, args)
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L75
  def scan(re):
    match(re; "g")
    | if (.captures | length > 0)
        then [.captures | .[] | .string]
        else .string
      end;
*/
export const scan = (input, pattern) => {
  const matches = apply(input, pattern, null, APPLY_GLOBAL)
  jq.convert(matches, match => match.length > 1
    ? getCaptures(match, string => string ?? null)
    : match[0])

  return jq.toStream(matches)
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L88
  def splits($re; flags):
    . as $s
    | [match($re; "g" + flags) | (.offset, .offset + .length)]
    | [0] + . + [$s | length]
    | _nwise(2)
    | $s[.[0]:.[1]];
*/
export const splits = (input, pattern, flags) => {
  const matches = apply(input, pattern, flags, APPLY_GLOBAL)
  if (!matches.length) {
    return input
  }

  const parts = new Array(matches.length + 1)
  let start = 0

  for (let i = 0, n = matches.length; i < n; ++i) {
    const match = matches[i]
    const end = match.index
    parts[i] = input.slice(start, end)
    start = end + match[0].length
  }

  parts[matches.length] = input.slice(start)
  return jq.toStream(parts)
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L113
  (too long; see the link)
*/
export const sub = (input, pattern, replacer, flags, global) => {
  const matches = apply(input, pattern, flags, (global && APPLY_GLOBAL) | APPLY_FIX_GROUPS)
  if (!matches.length) {
    return input
  }

  let result = ''
  let start = 0

  for (const match of matches) {
    const replacement = replacer(match.groups)
    if (jq.isEmpty(replacement)) {
      return undefined
    }

    const end = match.index
    if (start < end) {
      const part = input.slice(start, end)
      result = jq.map(result, result => result + part)
    }

    start = end + match[0].length
    result = jq.product(result, replacement, jq.add)
  }

  if (start < input.length) {
    const part = input.slice(start)
    result = jq.map(result, result => result + part)
  }

  return result
}

export const test = (input, pattern, flags) => {
  return apply(input, pattern, flags, APPLY_TEST)
}

export const testPolymorphic = (input, args) => {
  return polymorphicCall(test, input, args)
}

// Private helpers

const APPLY_TEST        = 1 << 0
const APPLY_GLOBAL      = 1 << 1
const APPLY_FIX_GROUPS  = 1 << 2
const APPLY_DOT_ALL     = 1 << 3
const APPLY_IGNORE_CASE = 1 << 4
const APPLY_IGNORE_EMPTY_MATCHES = 1 << 5

const apply = (input, pattern, flags, options) => {
  if (!jq.isString(input)) {
    throw new jq.DataError(`${jq._mtype_v(input)} cannot be matched, as it is not a string.`)
  }
  if (!jq.isString(pattern)) {
    throw new jq.DataError(`${jq._mtype_v(pattern)} is not a string.`)
  }
  if (flags !== null && !jq.isString(flags)) {
    throw new jq.DataError(`${jq._mtype_v(flags)} is not a string.`)
  }

  options |= parseFlags(flags)

  const re = compile(pattern, options)
  if ((options & (APPLY_TEST | APPLY_IGNORE_EMPTY_MATCHES)) === APPLY_TEST) {
    return re.test(input)
  }

  const result = options & APPLY_TEST ? false : []
  do {
    const match = re.exec(input)
    if (!match) {
      break
    }

    const isEmptyMatch = !match[0]
    if (!(isEmptyMatch && options & APPLY_IGNORE_EMPTY_MATCHES)) {
      if (options & APPLY_TEST) {
        return true
      }

      // JQ doesn't return captures for an empty match
      if (isEmptyMatch) {
        match.groups = undefined
        match.length = 1
      }

      if (options & APPLY_FIX_GROUPS) {
        fixGroups(match)
      }

      result.push(match)
      if (!(options & APPLY_GLOBAL)) {
        break
      }
    }

    if (isEmptyMatch && re.lastIndex < input.length) {
      re.lastIndex += input.codePointAt(re.lastIndex) >= 0x10000 ? 2 : 1
    }
  }
  while (re.lastIndex < input.length)

  return result
}

const compile = (pattern, options) => {
  let flags = 'gu'
  if (options & APPLY_IGNORE_CASE) {
    flags += 'i'
  }
  if (options & APPLY_DOT_ALL) {
    flags += 's'
  }

  try {
    return new RegExp(pattern, flags)
  }
  catch (e) {
    throw e instanceof SyntaxError
      ? new jq.DataError(e.message + '.')
      : e
  }
}

const fixGroups = (match) => {
  const groups = match.groups
  if (!groups) {
    match.groups = {}
    return
  }

  Object.setPrototypeOf(groups, Object.prototype) // denullify prototype
  for (const [key, value] of Object.entries(groups)) {
    if (value === undefined) {
      groups[key] = null
    }
  }
}

const getCaptures = (match, transform) => {
  const captures = new Array(match.length - 1)
  for (let i = 0, n = captures.length; i < n; ++i) {
    captures[i] = transform(match[i + 1])
  }

  return captures
}

const parseFlags = (flags) => {
  if (!flags) {
    return 0
  }

  let options = 0
  for (const f of flags) {
    switch (f) {
      case 'g':
        options |= APPLY_GLOBAL
        break
      case 'i':
        options |= APPLY_IGNORE_CASE
        break
      case 'm':
        options |= APPLY_DOT_ALL
        break
      case 'n':
        options |= APPLY_IGNORE_EMPTY_MATCHES
        break
      default:
        throw new jq.DataError(`Invalid regular expression flags: "${flags}".`)
    }
  }

  return options
}

/*
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L61
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L66
  https://github.com/stedolan/jq/blob/master/src/builtin.jq#L71
  def fn($val): ($val | type) as $vt | if $vt == "string" then fn($val; null)
    elif $vt == "array" and ($val | length) > 1 then fn($val[0]; $val[1])
    elif $vt == "array" and ($val | length) > 0 then fn($val[0]; null)
    else error( $vt + " not a string or array") end;
*/
const polymorphicCall = (fn, input, args) => {
  if (jq.isString(args)) {
    return fn(input, args, null)
  }
  if (!jq.isArray(args)) {
    throw new jq.DataError(`${jq._mtype_v(args)} is not a string or array.`)
  }
  if (!args.length) {
    throw new jq.DataError('The array of regular expression parameters must not be empty.')
  }

  return fn(input, args[0], args.length > 1 ? args[1] : null)
}
