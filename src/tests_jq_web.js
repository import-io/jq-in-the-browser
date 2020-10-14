import assert from 'assert'
import jq_web from 'jq-web'
import jq from './index.js'
import tests from './tests.json'

// A fixed version of jq_web.json, which resolves the following issues:
//
// 1. Arrays are flattened in a multi-value output.
//
//  For raw output "1\n[2,3,4,5]":
//    jq_web.json  => [1,2,3,4,5]
//    jq_web_fixed => [1,[2,3,4,5]]
//
// 2. An error is thrown on empty output.
//
//  For raw output "":
//    jq_web.json  => throws
//    jq_web_fixed => []
//
const jq_web_fixed = (json, filter) => {
  const jsonString = JSON.stringify(json)
  const result = jq_web.raw(jsonString, filter, ['-c']).trim()
  return result.split('\n').filter(x => x).map(JSON.parse)
}

const substMessage = (query, input) => {
  try {
    return query(input)
  }
  catch (e) {
    e.message = e.message
      .replace(/\bascii_(downcase|upcase)\b/, 'explode')
      .replace(/^(\w+) .+ cannot be reversed\b.*/, 'Cannot index $1 with number.')
      .replace(/^Cannot index array with object\.$/, 'Start and end indices of an array slice must be numbers.')

    throw e
  }
}

const test_with_jq_web = ([feature, queries, inputs]) => {
  describe(feature, () => {
    const isErrorTest = feature.endsWith(' - errors')
    queries.forEach((query) =>
      describe(`Query: ${query}`, () =>
        inputs.forEach((input) =>
          it(`Input: ${JSON.stringify(input)}`, () => {
            if (isErrorTest) {
              let message
              assert.throws(() => jq_web_fixed(input, query), e => { message = e.message; return true })
              message = message.trimRight()
              message = message.replace(/^jq: error \(at <stdin>:0\): /, '')
              message += '.'

              const compiledQuery = jq(query)
              assert.throws(() => substMessage(compiledQuery, input), { message })
            }
            else {
              const ourOutput = jq(query)(input)
              const refOutput = jq_web_fixed(input, query)
              assert.deepStrictEqual(ourOutput, refOutput)
            }
          })
        )
      )
    )
  })
}

tests.forEach(test_with_jq_web)
