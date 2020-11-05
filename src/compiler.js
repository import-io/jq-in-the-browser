import * as jq from './core.js'
import { fn0, fn1 } from './functions.js'

// bindings for binary operators
export const {
  areEqual, // "==", "!="
  compare,  // "<=", "<", ">=", ">"
  add,      // "+"
  subtract, // "-"
  multiply, // "*"
  divide,   // "/"
  modulo,   // "%"
} = jq

export const compileAddMul = (first, rest) => {
  const reducer = (input, vars) => (left, next) => {
    return jq.product(left, next.expr(input, vars), next.op)
  }

  return (input, vars) => reduce(
    first(input, vars), rest, jq.isEmpty, reducer(input, vars))
}

export const compileAlternative = (first, rest) => {
  const last = rest[rest.length - 1]
  --rest.length

  const prep = (input, vars, expr) => {
    return jq.map(expr(input, vars), jq.ifTrue)
  }
  const stop = left => {
    return !jq.isEmpty(left)
  }
  const reducer = (input, vars) => (left, next) => {
    return prep(input, vars, next)
  }

  return (input, vars) => {
    const result = reduce(
      prep(input, vars, first), rest, stop, reducer(input, vars))

    if (!jq.isEmpty(result)) {
      return result
    }

    return last(input, vars)
  }
}

export const compileArrayConstruction = (items) => {
  return (input, vars) => jq.toArray(items(input, vars))
}

export const compileCompare = (left, right, op) => {
  return (input, vars) => {
    const left_ = left(input, vars)
    if (jq.isEmpty(left_)) {
      return undefined
    }

    return jq.product(left_, right(input, vars), op)
  }
}

export const compileDot = () => {
  return jq.identity
}

export const compileDotName = (name, optional) => {
  return (input) => jq.dotName(input, name, optional)
}

export const compileDotNameTransform = (name, optional) => {
  return (left) => jq.map(left, left => jq.dotName(left, name, optional))
}

export const compileFilter = (first, rest) => {
  const reducer = (input, vars) => (left, next) => {
    return next(left, input, vars)
  }

  return (input, vars) => reduce(
    first(input, vars), rest, jq.isEmpty, reducer(input, vars))
}

export const compileFunctionCall0 = (errorFn, name) => {
  if (jq.has(fn0, name)) {
    return fn0[name]
  }

  return errorFn(jq.has(fn1, name)
    ? `Function "${name}" requires a parameter.`
    : `Function "${name}" is not defined.`)
}

export const compileFunctionCall1 = (errorFn, name, arg) => {
  if (jq.has(fn1, name)) {
    const fn = fn1[name]
    return arg.length === 2 // needs vars
      ? (input, vars) => fn(input, input => arg(input, vars))
      : (input) => fn(input, arg)
  }

  return errorFn(jq.has(fn0, name)
    ? `Function "${name}" accepts no parameters.`
    : `Function "${name}" is not defined.`)
}

export const compileIfThenElse = (cond, left, right) => {
  return (input, vars) => jq.map(cond(input, vars),
    cond => jq.isTrue(cond) ? left(input, vars) : right(input, vars))
}

export const compileIndexTransform = (index, optional) => {
  return (left, input, vars) => jq.product(left, index(input, vars), (left, index) => {
    if (jq.isString(index)) {
      return jq.dotName(left, index, optional)
    }
    if (left !== null && !jq.isArray(left) || !jq.isNumber(index)) {
      if (optional) return undefined
      throw new jq.DataError(`Cannot index ${jq._mtype(left)} with ${jq._mtype(index)}.`)
    }
    if (left === null || !Number.isInteger(index)) {
      return null
    }
    if (index < 0 && (index += left.length) < 0) {
      return null
    }
    if (index >= left.length) {
      return null
    }

    return left[index]
  })
}

export const compileIterateTransform = (optional) => {
  return (left) => jq.iterate(left, optional)
}

export const compileLogicalAnd = (first, rest) => {
  const prep = (input, vars, expr) => {
    return jq.map(expr(input, vars), jq.isTrue)
  }
  const stop = left => {
    return !jq.includes(left, true)
  }
  const reducer = (input, vars) => (left, next) => {
    next = prep(input, vars, next)
    return jq.map(left, left => left && next)
  }

  return (input, vars) => reduce(
    prep(input, vars, first), rest, stop, reducer(input, vars))
}

export const compileLogicalOr = (first, rest) => {
  const prep = (input, vars, expr) => {
    return jq.map(expr(input, vars), jq.isTrue)
  }
  const stop = left => {
    return !jq.includes(left, false)
  }
  const reducer = (input, vars) => (left, next) => {
    next = prep(input, vars, next)
    return jq.map(left, left => left || next)
  }

  return (input, vars) => reduce(
    prep(input, vars, first), rest, stop, reducer(input, vars))
}

export const compileNegation = (expr, count) => {
  count %= 2

  return (input, vars) => jq.map(expr(input, vars), value => {
    if (!jq.isNumber(value)) {
      throw new jq.DataError(`${jq._mtype_v(value)} cannot be negated.`)
    }
    if (!count) {
      return value
    }

    return -value
  })
}

export const compileObjectConstruction = (first, rest) => {
  const reducer = (input, vars) => (left, next) => {
    return jq.product(next(input, vars), left,
      (next, left) => ({ ...left, ...next }))
  }

  return (input, vars) => reduce(
    first(input, vars), rest, jq.isEmpty, reducer(input, vars))
}

export const compileObjectEntry = (key, value) => {
  return (input, vars) => {
    const key_ = key(input, vars)
    if (jq.isEmpty(key_)) {
      return undefined
    }

    return jq.product(value(input, vars), key_,
      (value, key) => ({ [jq.checkKey(key)]: value }))
  }
}

export const compileObjectEntryFromName = (name) => {
  return (input) => ({ [name]: jq.dotName(input, name) })
}

export const compileObjectEntryFromVariable = (name, index) => {
  return (input, vars) => ({ [name]: vars[index] })
}

export const compileOutput = (expr) => {
  return input => {
    if (input === undefined) {
      return []
    }

    const vars = Object.freeze([])
    return jq.toArray(expr(input, vars))
  }
}

export const compilePipe = (first, rest) => {
  const reducer = vars => (left, next) => {
    return jq.map(left, left => next(left, vars))
  }

  return (input, vars) => reduce(
    first(input, vars), rest, jq.isEmpty, reducer(vars))
}

export const compileSliceTransform = (start, end, optional) => {
  start ??= fn0.null
  end   ??= fn0.null

  const range = (input, vars) => {
    const start_ = start(input, vars)
    if (jq.isEmpty(start_)) {
      return undefined
    }

    return jq.product(end(input, vars), start_,
      (end, start) => [start, end])
  }

  return (left, input, vars) => jq.product(left, range(input, vars), (left, [start, end]) => {
    if (left === null) {
      return null
    }
    if (!jq.isArray(left) && !jq.isString(left)) {
      if (optional) return undefined
      throw new jq.DataError(`Cannot index ${jq._mtype(left)} with object.`)
    }
    if (start !== null && !jq.isNumber(start) || end !== null && !jq.isNumber(end)) {
      if (optional) return undefined
      throw new jq.DataError(`Start and end indices of an ${jq._mtype(left)} slice must be numbers.`)
    }

    start = start !== null
      ? Math.floor(start)
      : 0
    end = end !== null
      ? Math.ceil(end)
      : undefined

    return left.slice(start, end)
  })
}

export const compileStream = (first, rest) => {
  const all = [first, ...rest]
  return (input, vars) => jq.concat(all.map(
    expr => expr(input, vars)))
}

export const compileTryCatch = (left, right) => {
  right ??= fn0.empty

  return (input, vars) => {
    try {
      return left(input, vars)
    }
    catch (e) {
      if (!e || e.constructor !== jq.DataError) {
        throw e
      }

      return right(e.message, vars)
    }
  }
}

export const compileVariableExpr = (left, right, index) => {
  return (input, vars) => jq.map(left(input, vars), left => {
    const newVars = [...vars]
    newVars[index] = left
    Object.freeze(newVars)
    return right(input, newVars)
  })
}

export const compileVariableRef = (index) => {
  return (input, vars) => vars[index]
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
