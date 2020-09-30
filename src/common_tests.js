import assert from 'assert'
import jq from './index.js'

describe('Multi-line queries', () => {
  const queries = [
    '1\n+\n2',
    '1\n\n+2',
    '1\n+\n2\n',
    '\n1\n+\n2',
    '4\n\t-1',
    '4\n-\t1',
    '4\n-1\t',
    '\t4\n-1',
  ]

  const output = [3]

  queries.forEach(query =>
    it('Query: ' + JSON.stringify(query), () => {
      assert.deepStrictEqual(jq(query)(null), output)
    })
  )
})

describe('Error location', () => {
  const errors = [
    {
      query: '1!',
      start: { offset: 1, line: 1, column: 2 },
      end:   { offset: 2, line: 1, column: 3 },
    },
    {
      query: '1\n!',
      start: { offset: 2, line: 2, column: 1 },
      end:   { offset: 3, line: 2, column: 2 },
    },
    {
      query: '1\t!',
      start: { offset: 2, line: 1, column: 3 },
      end:   { offset: 3, line: 1, column: 4 },
    },
  ]

  errors.forEach(({ query, start, end }) =>
    it('Query: ' + JSON.stringify(query), () => {
      assert.throws(() => jq(query), { location: { start, end } })
    })
  )
})

describe('Single quote String literal', () => {
  it('per se', () => {
    assert.deepStrictEqual(jq("'Hello \"World\"!'")(null), ['Hello "World"!'])
  })

  it('as key', () => {
    assert.deepStrictEqual(jq("{'a': false}")(null), [{'a': false}])
  })
})

describe('Extension functions', () => {
  it('downcase', () => {
    const query = '.greeting | downcase'
    const input = { "greeting": "Hello, МИР! © 2020\nПривет, WORLD!" }
    const output = ["hello, мир! © 2020\nпривет, world!"]

    assert.deepStrictEqual(jq(query)(input), output)
  })

  it('upcase', () => {
    const query = '.greeting | upcase'
    const input = { "greeting": "Hello, МИР! © 2020\nПривет, WORLD!" }
    const output = ["HELLO, МИР! © 2020\nПРИВЕТ, WORLD!"]

    assert.deepStrictEqual(jq(query)(input), output)
  })
})

describe('Other tests', () => {
  it('handle example code correctly', () => {
    const query = '{"names": .[] | .name}'
    const input = [
      {"name": "Mary", "age": 22},
      {"name": "Rupert", "age": 29},
      {"name": "Jane", "age": 11},
      {"name": "John", "age": 42}
    ]
    const output = [
      {
        "names": "Mary"
      },
      {
        "names": "Rupert"
      },
      {
        "names": "Jane"
      },
      {
        "names": "John"
      },
    ]
    assert.deepStrictEqual(jq(query)(input), output)
  })

  it('handle example code correctly 2', () => {
    const query = '{"names": [.[] | .name]}'
    const input = [
      {"name": "Mary", "age": 22},
      {"name": "Rupert", "age": 29},
      {"name": "Jane", "age": 11},
      {"name": "John", "age": 42}
    ]
    const output = [{
      "names": [
        "Mary",
        "Rupert",
        "Jane",
        "John"
      ]
    }]

    assert.deepStrictEqual(jq(query)(input), output)
  })
})


describe('Error messages', () => {
  const tests = [
    ['. | ..1', 'Invalid numeric literal \'..1\'.'],
    ['. | 1..', 'Invalid numeric literal \'1..\'.'],
    ['. | 1..2', 'Invalid numeric literal \'1..2\'.'],
    ['. | 1.2.3', 'Invalid numeric literal \'1.2.3\'.'],
    ['. | 1foo', 'Expected [.0-9] or a space but "f" found.'],
    ['. | 1 and234', 'Expected a space but "2" found.'],
    ['. | 1 andfoo', 'Expected a space but "f" found.'],
    ['. | foo', 'function foo/0 is not defined.'],
    ['. | bar', 'function bar/0 is not defined.'],
    ['. | bar(4)', 'function bar/1 is not defined.'],
    ['. | baz(4)', 'function baz/1 is not defined.'],
    ['. | downcase', 'downcase input must be a string.'],
    ['. | upcase', 'upcase input must be a string.'],
  ]

  tests.forEach(([query, error]) =>
    it(`Error '${error}' for '${query}'`, () => {
      assert.throws(() => jq(query)(null), { message: error })
    })
  )
})
