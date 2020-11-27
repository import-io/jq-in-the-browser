import assert from 'assert'
import * as jq from './index.js'

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

  queries.forEach(query => {
    it('Query: ' + JSON.stringify(query), () => {
      assert.deepStrictEqual(jq.compile(query)(null), output)
    })
  })
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

  errors.forEach(({ query, start, end }) => {
    it('Query: ' + JSON.stringify(query), () => {
      assert.throws(() => jq.compile(query), { location: { start, end } })
    })
  })
})

describe('Extension functions', () => {
  it('downcase', () => {
    const query = '.greeting | downcase'
    const input = { greeting: 'Hello, МИР! © 2020\nПривет, WORLD!' }
    const output = ['hello, мир! © 2020\nпривет, world!']

    assert.deepStrictEqual(jq.compile(query)(input), output)
  })

  it('upcase', () => {
    const query = '.greeting | upcase'
    const input = { greeting: 'Hello, МИР! © 2020\nПривет, WORLD!' }
    const output = ['HELLO, МИР! © 2020\nПРИВЕТ, WORLD!']

    assert.deepStrictEqual(jq.compile(query)(input), output)
  })
})

describe('Compile-time errors', () => {
  const tests = [
    ['!', /^Expected .+, number,.+ but "!" found\.$/],
    ['..1', 'Invalid numeric literal "..1".'],
    ['1..', 'Invalid numeric literal "1..".'],
    ['1..2', 'Invalid numeric literal "1..2".'],
    ['1.2.3', 'Invalid numeric literal "1.2.3".'],
    ['1foo', 'Invalid numeric literal "1foo".'],
    ['0x1', 'Invalid numeric literal "0x1".'],
    ['0b1', 'Invalid numeric literal "0b1".'],
    ['0o1', 'Invalid numeric literal "0o1".'],

    ['!', /^Expected .+, string,.+ but "!" found\.$/],
    ['"foo', 'Expected "\\"", "\\\\", or any character but end of input found.'],
    ['"foo\\', 'Expected "/", "\\"", "\\\\", "b", "f", "n", "r", or "t" but end of input found.'],
    ['"foo\\"', 'Expected "\\"", "\\\\", or any character but end of input found.'],
    ['"foo\\a"', 'Expected "/", "\\"", "\\\\", "b", "f", "n", "r", or "t" but "a" found.'],

    ['!', /^Expected .+, or variable name but "!" found\.$/],
    ['$', 'Expected name but end of input found.'],
    ['$$', 'Expected name but "$" found.'],
    ['$1', 'Expected name but "1" found.'],
    ['$foo', 'Variable "$foo" is not defined.'],
    ['$as', 'Variable "$as" is not defined.'],
    ['$if', 'Variable "$if" is not defined.'],

    ['1 as', 'Expected space or variable name but end of input found.'],
    ['1 as234', 'Expected space or variable name but "2" found.'],
    ['1 asfoo', 'Expected space or variable name but "f" found.'],
    ['1 as $foo', 'Expected "|" or space but end of input found.'],

    ['(1 as $foo | 2) | $foo', 'Variable "$foo" is not defined.'],
    ['(1 as $foo | 2) + $foo', 'Variable "$foo" is not defined.'],
    ['if 1 as $foo | 2 then $foo else 3 end', 'Variable "$foo" is not defined.'],
    ['if 1 as $foo | 2 then 3 else $foo end', 'Variable "$foo" is not defined.'],
    ['if 1 as $foo | 2 then 3 else 4 end | $foo', 'Variable "$foo" is not defined.'],
    ['if 1 as $foo | 2 then 3 else 4 end + $foo', 'Variable "$foo" is not defined.'],

    ['foo()', /^Expected .+ but "\)" found\.$/],
    ['foo(!)', /^Expected .+ but "!" found\.$/],
    ['foo', 'Function "foo" is not defined.'],
    ['bar(1)', 'Function "bar" is not defined.'],
    ['empty()', /^Expected .+ but "\)" found\.$/],
    ['empty(!)', /^Expected .+ but "!" found\.$/],
    ['empty(1)', 'Function "empty" expects no parameters.'],
    ['empty(1;2)', 'Function "empty" expects no parameters.'],
    ['select()', /^Expected .+ but "\)" found\.$/],
    ['select(!)', /^Expected .+ but "!" found\.$/],
    ['select', 'Function "select" expects one parameter.'],
    ['select(1;2)', 'Function "select" expects one parameter.'],
    ['test(;)', /^Expected .+ but ";" found\.$/],
    ['test(1;)', /^Expected .+ but "\)" found\.$/],
    ['test(1;!)', /^Expected .+ but "!" found\.$/],
    ['test', 'Function "test" expects 1 or 2 parameters.'],
    ['test(1;2;3)', 'Function "test" expects 1 or 2 parameters.'],

    ['and', /^Expected .+, function name,.+ but "a" found\.$/],
    ['as', /^Expected .+, function name,.+ but "a" found\.$/],
    ['catch', /^Expected .+, function name,.+ but "c" found\.$/],
    ['elif', /^Expected .+, function name,.+ but "e" found\.$/],
    ['else', /^Expected .+, function name,.+ but "e" found\.$/],
    ['end', /^Expected .+, function name,.+ but "e" found\.$/],
    ['if', /^Expected .+ but end of input found\.$/],
    ['or', /^Expected .+, function name,.+ but "o" found\.$/],
    ['then', /^Expected .+, function name,.+ but "t" found\.$/],
    ['try', /^Expected .+ but end of input found\.$/],

    ['1and 234', 'Invalid numeric literal "1and".'],
    ['1 and234', 'Expected space but "2" found.'],
    ['1 andfoo', 'Expected space but "f" found.'],
    ['1 and', /^Expected ((?!a-z).)+ but end of input found\.$/],
    ['1or 234', 'Invalid numeric literal "1or".'],
    ['1 or234', 'Expected space but "2" found.'],
    ['1 orfoo', 'Expected space but "f" found.'],
    ['1 or', /^Expected ((?!a-z).)+ but end of input found\.$/],

    ['if 1', /^Expected .*"then".* but end of input found\.$/],
    ['if 1 then', /^Expected .+ but end of input found\.$/],
    ['if 1 then 2', /^Expected .*"elif", "else".* but end of input found\.$/],
    ['if 1 then 2 else', /^Expected .+ but end of input found\.$/],
    ['if 1 then 2 else 3', /^Expected .*"end".* but end of input found\.$/],
    ['if 1 then 2 elif', /^Expected .+ but end of input found\.$/],
    ['if 1 then 2 elif 3', /^Expected .*"then".* but end of input found\.$/],

    ['if1 then 2 else 3 end', 'Function "if1" is not defined.'],
    ['iffoo then 2 else 3 end', 'Function "iffoo" is not defined.'],
    ['if 1 then2 else 3 end', 'Expected space but "2" found.'],
    ['if 1 thenfoo else 3 end', 'Expected space but "f" found.'],
    ['if 1 then 2 else3 end', 'Expected space but "3" found.'],
    ['if 1 then 2 elsefoo end', 'Expected space but "f" found.'],
    ['if 1 then 2 else 3 end4', 'Expected space but "4" found.'],
    ['if 1 then 2 else 3 endfoo', 'Expected space but "f" found.'],
    ['if 1 then 2 elif3 then 4 else 5 end', 'Expected space but "3" found.'],
    ['if 1 then 2 eliffoo then 4 else 5 end', 'Expected space but "f" found.'],

    ['try 1 catch', /^Expected .+ but end of input found\.$/],
    ['try1', 'Function "try1" is not defined.'],
    ['tryfoo', 'Function "tryfoo" is not defined.'],
    ['try 1 catch2', 'Expected space but "2" found.'],
    ['try 1 catchfoo', 'Expected space but "f" found.'],
  ]

  tests.forEach(([query, error]) => {
    it(`Error '${error}' for '${query}'`, () => {
      assert.throws(() => jq.compile(query), { name: 'SyntaxError', message: error })
    })
  })
})

describe('Run-time errors', () => {
  const tests = [
    ['downcase', 'downcase input must be a string.'],
    ['upcase', 'upcase input must be a string.'],
  ]

  tests.forEach(([query, error]) => {
    it(`Error '${error}' for '${query}'`, () => {
      assert.throws(() => jq.compile(query)(null), { message: error })
    })
  })
})

describe('Don\'t return cached instances of objects', () => {
  const queries = [
    'empty',
    '[]',
    '{}',
  ]

  queries.forEach(query => {
    it('Query: ' + query, () => {
      const compiledQuery = jq.compile(query)
      const output1 = compiledQuery(null)
      const output2 = compiledQuery(null)

      assert.notStrictEqual(output2, output1)
      if (output2.length) {
        assert.notStrictEqual(output2[0], output1[0])
      }
    })
  })
})
