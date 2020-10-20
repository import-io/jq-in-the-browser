import * as jq from './core.js'
import { fn0, fn1 } from './functions.js'

// bindings for binary operators
export {
  areEqual, // "==", "!="
  compare,  // "<=", "<", ">=", ">"
  add,      // "+"
  subtract, // "-"
  multiply, // "*"
  divide,   // "/"
  modulo,   // "%"
} from './core.js'

export const compileAddMul = (first, rest) => {
  const reducer = input => (left, next) =>
    jq.product(left, next.expr(input), next.op)

  return input => reduce(
    first(input), rest, jq.isEmpty, reducer(input))
}

export const compileAlternative = (first, rest) => {
  const last = rest[rest.length - 1]
  --rest.length

  const prep = (input, expr) =>
    jq.map(expr(input), jq.ifTrue)

  const stop = left =>
    !jq.isEmpty(left)

  const reducer = input => (left, next) =>
    prep(input, next)

  return input => {
    const result = reduce(
      prep(input, first), rest, stop, reducer(input))

    if (!jq.isEmpty(result)) {
      return result
    }

    return last(input)
  }
}

export const compileArrayConstruction = (items) => {
  return input => jq.toArray(items(input))
}

export const compileCompare = (left, right, op) => {
  return input => {
    const left_ = left(input)
    if (jq.isEmpty(left_)) {
      return undefined
    }

    return jq.product(left_, right(input), op)
  }
}

export const compileDot = () => {
  return jq.identity
}

export const compileDotName = (name, optional) => {
  return input => jq.dotName(input, name, optional)
}

export const compileFilter = (first, rest) => {
  const reducer = input => (left, next) => {
    return jq.has(next, 'arg')
      ? jq.product(left, next.arg(input), next)
      : jq.map(left, next)
  }

  return input => reduce(
    first(input), rest, jq.isEmpty, reducer(input))
}

export const compileFunctionCall0 = (errorFn, name) => {
  if (jq.has(fn0, name)) {
    return fn0[name]
  }

  errorFn(jq.has(fn1, name)
    ? `Function "${name}" requires a parameter.`
    : `Function "${name}" is not defined.`)
}

export const compileFunctionCall1 = (errorFn, name, arg) => {
  if (jq.has(fn1, name)) {
    return fn1[name](arg)
  }

  errorFn(jq.has(fn0, name)
    ? `Function "${name}" accepts no parameters.`
    : `Function "${name}" is not defined.`)
}

export const compileIfThenElse = (cond, left, right) => {
  return input => jq.map(cond(input),
    cond => jq.isTrue(cond) ? left(input) : right(input))
}

export const compileIndex = (index, optional) => {
  const transform = (input, index) => {
    if (jq.isString(index)) {
      return jq.dotName(input, index, optional)
    }
    if (input !== null && !jq.isArray(input) || !jq.isNumber(index)) {
      if (optional) return undefined
      throw new Error(`Cannot index ${jq._mtype(input)} with ${jq._mtype(index)}.`)
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

  transform.arg = index
  return transform
}

export const compileIterator = (optional) => {
  return input => jq.iterate(input, optional)
}

export const compileLiteral = (value) => {
  return input => value
}

export const compileLogicalAnd = (first, rest) => {
  const prep = (input, expr) =>
    jq.map(expr(input), jq.isTrue)

  const stop = left =>
    !jq.includes(left, true)

  const reducer = input => (left, next) => {
    next = prep(input, next)
    return jq.map(left, left => left && next)
  }

  return input => reduce(
    prep(input, first), rest, stop, reducer(input))
}

export const compileLogicalOr = (first, rest) => {
  const prep = (input, expr) =>
    jq.map(expr(input), jq.isTrue)

  const stop = left =>
    !jq.includes(left, false)

  const reducer = input => (left, next) => {
    next = prep(input, next)
    return jq.map(left, left => left || next)
  }

  return input => reduce(
    prep(input, first), rest, stop, reducer(input))
}

export const compileNegation = (count, right) => {
  count %= 2

  return input => jq.map(right(input), right => {
    if (!jq.isNumber(right)) {
      throw new Error(`${jq._mtype_v(right)} cannot be negated.`)
    }
    if (!count) {
      return right
    }

    return -right
  })
}

export const compileObjectConstruction = (first, rest) => {
  const reducer = input => (left, next) => jq.product(next(input), left,
    (next, left) => ({ ...left, ...next }))

  return input => reduce(
    first(input), rest, jq.isEmpty, reducer(input))
}

export const compileObjectEntry = (key, value) => {
  return input => {
    const key_ = key(input)
    if (jq.isEmpty(key_)) {
      return undefined
    }

    return jq.product(value(input), key_,
      (value, key) => ({ [jq.checkKey(key)]: value }))
  }
}

export const compileObjectEntryShort = (key) => {
  return input => ({ [key]: jq.dotName(input, key) })
}

export const compileOutput = (expr) => {
  return input => {
    if (input === undefined) {
      return []
    }

    return jq.toArray(expr(input))
  }
}

export const compilePipe = (first, rest) => {
  return input => reduce(first(input), rest, jq.isEmpty, jq.map)
}

export const compileSlice = (start, end, optional) => {
  start ||= fn0.null
  end   ||= fn0.null

  const transform = (input, [start, end]) => {
    if (input === null) {
      return null
    }
    if (!jq.isArray(input) && !jq.isString(input)) {
      if (optional) return undefined
      throw new Error(`Cannot index ${jq._mtype(input)} with object.`)
    }
    if (start !== null && !jq.isNumber(start) || end !== null && !jq.isNumber(end)) {
      if (optional) return undefined
      throw new Error(`Start and end indices of an ${jq._mtype(input)} slice must be numbers.`)
    }

    start = start !== null
      ? Math.floor(start)
      : 0
    end = end !== null
      ? Math.ceil(end)
      : undefined

    return input.slice(start, end)
  }

  transform.arg = input => {
    const start_ = start(input)
    if (jq.isEmpty(start_)) {
      return undefined
    }

    return jq.product(end(input), start_,
      (end, start) => [start, end])
  }

  return transform
}

export const compileStream = (first, rest) => {
  const all = [first, ...rest]
  return input => jq.concat(all.map(expr => expr(input)))
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
