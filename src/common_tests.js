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
    ['. | ..1', 'Invalid numeric literal "..1".'],
    ['. | 1..', 'Invalid numeric literal "1..".'],
    ['. | 1..2', 'Invalid numeric literal "1..2".'],
    ['. | 1.2.3', 'Invalid numeric literal "1.2.3".'],
    ['. | 1foo', 'Invalid numeric literal "1foo".'],
    ['. | 0x1', 'Invalid numeric literal "0x1".'],
    ['. | 0b1', 'Invalid numeric literal "0b1".'],
    ['. | 0o1', 'Invalid numeric literal "0o1".'],

    ['. | foo', 'function foo/0 is not defined.'],
    ['. | bar', 'function bar/0 is not defined.'],
    ['. | bar(4)', 'function bar/1 is not defined.'],
    ['. | downcase', 'downcase input must be a string.'],
    ['. | upcase', 'upcase input must be a string.'],

    ['. | and', /^Expected .+, function name,.+ but "a" found\.$/],
    ['. | elif', /^Expected .+, function name,.+ but "e" found\.$/],
    ['. | else', /^Expected .+, function name,.+ but "e" found\.$/],
    ['. | end', /^Expected .+, function name,.+ but "e" found\.$/],
    ['. | if', /^Expected .+ but end of input found\.$/],
    ['. | or', /^Expected .+, function name,.+ but "o" found\.$/],
    ['. | then', /^Expected .+, function name,.+ but "t" found\.$/],

    ['. | 1and 234', 'Invalid numeric literal "1and".'],
    ['. | 1 and234', 'Expected space but "2" found.'],
    ['. | 1 andfoo', 'Expected space but "f" found.'],
    ['. | 1 and', /^Expected ((?!a-z).)+ but end of input found\.$/],
    ['. | 1or 234', 'Invalid numeric literal "1or".'],
    ['. | 1 or234', 'Expected space but "2" found.'],
    ['. | 1 orfoo', 'Expected space but "f" found.'],
    ['. | 1 or', /^Expected ((?!a-z).)+ but end of input found\.$/],

    ['. | if 1', /^Expected .*"then".* but end of input found\.$/],
    ['. | if 1 then', /^Expected .+ but end of input found\.$/],
    ['. | if 1 then 2', /^Expected .*"elif", "else".* but end of input found\.$/],
    ['. | if 1 then 2 else', /^Expected .+ but end of input found\.$/],
    ['. | if 1 then 2 else 3', /^Expected .*"end".* but end of input found\.$/],
    ['. | if 1 then 2 elif', /^Expected .+ but end of input found\.$/],
    ['. | if 1 then 2 elif 3', /^Expected .*"then".* but end of input found\.$/],

    ['. | if1 then 2 else 3 end', 'function if1/0 is not defined.'],
    ['. | iffoo then 2 else 3 end', 'function iffoo/0 is not defined.'],
    ['. | if 1 then2 else 3 end', 'Expected space but "2" found.'],
    ['. | if 1 thenfoo else 3 end', 'Expected space but "f" found.'],
    ['. | if 1 then 2 else3 end', 'Expected space but "3" found.'],
    ['. | if 1 then 2 elsefoo end', 'Expected space but "f" found.'],
    ['. | if 1 then 2 else 3 end4', 'Expected space but "4" found.'],
    ['. | if 1 then 2 else 3 endfoo', 'Expected space but "f" found.'],
    ['. | if 1 then 2 elif3 then 4 else 5 end', 'Expected space but "3" found.'],
    ['. | if 1 then 2 eliffoo then 4 else 5 end', 'Expected space but "f" found.'],
  ]

  tests.forEach(([query, error]) =>
    it(`Error '${error}' for '${query}'`, () => {
      assert.throws(() => jq(query)(null), { message: error })
    })
  )
})
