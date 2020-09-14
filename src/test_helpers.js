import jq from './index.js'
import assert from 'assert'
import jq_web from 'jq-web'
import node_jq from 'node-jq'

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

const test_with_node_jq = ([feature, queries, inputs]) => {
  describe(feature, () =>
    queries.forEach((query) =>
      describe(`Query: ${query}`, () => {
        inputs.forEach((input) => {
          it(`Input: ${JSON.stringify(input)}`, async () => {
            const parser_result = jq(query)(input)
            const jq_result = await node_jq.run(query, input, {input: 'json', output: 'json'})
            assert.deepStrictEqual(parser_result, jq_result)
          })
        })
      })
    )
  )
}

const test_with_jq_web = ([feature, queries, inputs]) => {
  describe(feature, () =>
    queries.forEach((query) =>
      describe(`Query: ${query}`, () => {
        inputs.forEach((input) => {
          it(`Input: ${JSON.stringify(input)}`, () => {
            const parser_result = jq(query)(input)
            const jq_result = jq_web_fixed(input, query)
            assert.deepStrictEqual(parser_result, jq_result)
          })
        })
      })
    )
  )
}

export { test_with_jq_web, test_with_node_jq }
