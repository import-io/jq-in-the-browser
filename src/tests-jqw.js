import assert from 'assert'
import jq_web from 'jq-web'
import * as jq from './index.js'
import tests from './tests-jqw.json'

// A fixed version of jq_web.json, which resolves the following issues:
//
// 1. Arrays are flattened in a multi-value output.
//
//  For raw output "1\n[2,3,4,5]":
//    jq_web.json => [1,2,3,4,5]
//    fixed - jqw => [1,[2,3,4,5]]
//
// 2. An error is thrown on empty output.
//
//  For raw output "":
//    jq_web.json => throws
//    fixed - jqw => []
//
const jqw = (json, filter) => {
  const jsonString = JSON.stringify(json)

  let result
  try {
    result = jq_web.raw(jsonString, filter, ['-c'])
  }
  catch (e) {
    let message = e.message

    const match = message.match(/^jq: error: syntax error, (.*?) \(Unix shell quoting issues\?\)/)
    if (match) {
      message = 'Syntax error: ' + match[1]
    }
    else {
      message = message.trimRight()
      message = message.replace(/^jq: error \(at <stdin>:0\): /, '')
    }

    e.message = message + '.'
    throw e
  }

  return result.trim().split('\n').filter(x => x).map(JSON.parse)
}

const substMessage = (query, input) => {
  try {
    return query(input)
  }
  catch (e) {
    let m
    if (e.message === 'Cannot index array with object.') {
      e.message = 'Start and end indices of an array slice must be numbers.'
    }
    else if ((m = e.message.match(/^(\w+) .+ cannot be reversed\b/))) {
      e.message = `Cannot index ${m[1]} with number.`
    }
    else if ((m = e.message.match(/^string \("([+-]\s.*)"\) cannot be parsed as a number\.$/))) {
      e.message = `Invalid numeric literal at line 1, column 2 (while parsing '${m[1]}').`
    }
    else if ((m = e.message.match(/^string \("([0-9.+-]+\s.*)"\) cannot be parsed as a number\.$/))) {
      e.message = `Unexpected extra JSON values (while parsing '${m[1]}').`
    }
    else if ((m = e.message.match(/^string \("([0-9.+-].*)"\) cannot be parsed as a number\.$/))) {
      e.message = `Invalid numeric literal at EOF at line 1, column ${m[1].length} (while parsing '${m[1]}').`
    }
    else if ((m = e.message.match(/^string \("(\s*)"\) cannot be parsed as a number\.$/))) {
      e.message = `Expected JSON value (while parsing '${m[1]}').`
    }
    else if ((m = e.message.match(/^string \("(.*)"\) cannot be parsed as a number\.$/))) {
      e.message = `Invalid literal at EOF at line 1, column ${m[1].length} (while parsing '${m[1]}').`
    }
    else {
      e.message = e.message.replace(/\bascii_(downcase|upcase)\b/, 'explode')
    }

    throw e
  }
}

tests.forEach(([feature, queries, inputs]) => {
  describe(feature, () => {
    const isErrorTest = feature.endsWith(' - errors')
    queries.forEach((query) => {
      describe('Query: ' + query, () => {
        inputs.forEach((input) => {
          it('Input: ' + JSON.stringify(input), () => {
            if (isErrorTest) {
              let message
              assert.throws(() => jqw(input, query), e => { message = e.message; return true })

              const compiledQuery = jq.compile(query)
              assert.throws(() => substMessage(compiledQuery, input), { message })
            }
            else {
              const ourOutput = jq.compile(query)(input)
              const jqwOutput = jqw(input, query)
              assert.deepStrictEqual(ourOutput, jqwOutput)
            }
          })
        })
      })
    })
  })
})

describe('Non-conforming behaviors', () => {
  const tests = [
    // we support constructs that JQ refuses to compile
    {
      query: '1? as $foo | $foo',
      ourOutput: [1],
      jqwOutput: 'Error: Syntax error: unexpected as, expecting $end.',
    },
    {
      query: 'if 1 then 2 else 3 end as $foo | $foo',
      ourOutput: [2],
      jqwOutput: 'Error: Syntax error: unexpected as, expecting $end.',
    },
    {
      query: 'try 1? catch .',
      ourOutput: [1],
      jqwOutput: 'Error: Syntax error: unexpected catch, expecting $end.',
    },
    {
      query: 'try try 1 catch .? catch .',
      ourOutput: [1],
      jqwOutput: 'Error: Syntax error: unexpected catch, expecting $end.',
    },

    // we don't want to allow a whitespace between "." and a string literal, like JQ does
    {
      query: '{foo: 1} | . "foo"',
      ourOutput: /SyntaxError: Expected .+ but "\\"" found\./,
      jqwOutput: [1],
    },

    // we don't want to allow a whitespace between "$" and a variable name, like JQ does
    {
      query: '1 as $foo | $ foo',
      ourOutput: 'SyntaxError: Expected name but " " found.',
      jqwOutput: [1],
    },
    {
      query: '1 as $ foo | $foo',
      ourOutput: 'SyntaxError: Expected name but " " found.',
      jqwOutput: [1],
    },

    // in non-equality comparisons, NaN should be considered equal to NaN
    // to ensure proper work of the sorting algorithm
    {
      query: 'nan < nan',
      ourOutput: [false],
      jqwOutput: [true],
    },
    {
      query: 'nan > nan',
      ourOutput: [false],
      jqwOutput: [false],
    },
    {
      query: 'nan <= nan',
      ourOutput: [true],
      jqwOutput: [true],
    },
    {
      query: 'nan >= nan',
      ourOutput: [true],
      jqwOutput: [false],
    },

    // round-trip conversion "nan | tostring | tonumber" should work
    {
      query: 'nan | tostring',
      ourOutput: ['NaN'],
      jqwOutput: ['null'],
    },
    {
      query: 'nan | tostring | tonumber',
      ourOutput: [NaN],
      jqwOutput: 'Error: string ("null") cannot be parsed as a number.',
    },

    // round-trip conversion "infinite | tostring | tonumber" should work
    {
      query: 'infinite, -infinite | tostring',
      ourOutput: ['Infinity', '-Infinity'],
      jqwOutput: [Number.MAX_VALUE.toString(), (-Number.MAX_VALUE).toString()],
    },
    {
      query: 'infinite, -infinite | tostring | tonumber',
      ourOutput: [Infinity, -Infinity],
      jqwOutput: [Number.MAX_VALUE, -Number.MAX_VALUE],
    },

    // should be able to parse "nan" as a number (there is a bug in JQ in that
    // it cannot parse "nan", while it successfully parses "+nan" and "-nan")
    {
      query: '"nan" | tonumber',
      ourOutput: [NaN],
      jqwOutput: 'Error: Invalid literal at EOF at line 1, column 3 (while parsing \'nan\').',
    },

    // map_values() on an array should correctly handle mapping expressions that may produce
    // an empty stream; it should behave similar to map(), but JQ is buggy here
    {
      query: '[1, 2, 3, 0] | map_values(empty)',
      ourOutput: [[]],
      jqwOutput: [[2, 0]],
    },
    {
      query: '[1, 2, 3, 0] | map_values(select(. < 2))',
      ourOutput: [[1, 0]],
      jqwOutput: [[1, 3, 0, null]],
    },
    {
      query: '[1, 2, 3, 0] | map_values(select(. < 2, . < 3))',
      ourOutput: [[1, 2, 0]],
      jqwOutput: [[1, 2, 0, null]],
    },

    // we don't replicate JQ bugs for generalized optional operator
    {
      query: '-("a"?)',
      ourOutput: 'DataError: string ("a") cannot be negated.',
      jqwOutput: [],
    },
    {
      query: '-"a"?',
      ourOutput: 'DataError: string ("a") cannot be negated.',
      jqwOutput: [],
    },
    {
      query: '"a"? + 1',
      ourOutput: 'DataError: string ("a") and number (1) cannot be added.',
      jqwOutput: [],
    },
    {
      query: '1 | false? or .a',
      ourOutput: 'DataError: Cannot index number with string "a".',
      jqwOutput: [],
    },
    {
      query: '1 | .a + 2?',
      ourOutput: 'DataError: Cannot index number with string "a".',
      jqwOutput: [],
    },
    {
      query: '([1], 2, [3])? | .[]',
      ourOutput: 'DataError: Cannot iterate over number (2).',
      jqwOutput: [1],
    },
    {
      query: '([1], 2, [3] | .[])?',
      ourOutput: [],
      jqwOutput: [1],
    },

    // we don't replicate JQ bugs for "try-catch" operator
    {
      query: '-(try "a")',
      ourOutput: 'DataError: string ("a") cannot be negated.',
      jqwOutput: [],
    },
    {
      query: '(try "a") + 1',
      ourOutput: 'DataError: string ("a") and number (1) cannot be added.',
      jqwOutput: [],
    },
    {
      query: 'try "a" + 1',
      ourOutput: 'DataError: string ("a") and number (1) cannot be added.',
      jqwOutput: [],
    },
    {
      query: '1 | (try false) or .a',
      ourOutput: 'DataError: Cannot index number with string "a".',
      jqwOutput: [],
    },
    {
      query: '1 | try false or .a',
      ourOutput: 'DataError: Cannot index number with string "a".',
      jqwOutput: [],
    },
    {
      query: '1 | .a + try 2',
      ourOutput: 'DataError: Cannot index number with string "a".',
      jqwOutput: [],
    },
    {
      query: 'try ([1], 2, [3]) | .[]',
      ourOutput: 'DataError: Cannot iterate over number (2).',
      jqwOutput: [1],
    },
    {
      query: 'try ([1], 2, [3] | .[])',
      ourOutput: [],
      jqwOutput: [1],
    },
  ]

  tests.forEach(({ query, ourOutput, jqwOutput }) => {
    it('Query: ' + query, () => {
      const actual = {}

      try {
        actual.ourOutput = jq.compile(query)(null)
      }
      catch (e) {
        actual.ourOutput = e.toString()
        if (ourOutput instanceof RegExp && ourOutput.test(actual.ourOutput)) {
          ourOutput = actual.ourOutput
        }
      }

      try {
        actual.jqwOutput = jqw(null, query)
      }
      catch (e) {
        actual.jqwOutput = e.toString()
      }

      assert.deepStrictEqual(actual, { ourOutput, jqwOutput })
    })
  })
})
