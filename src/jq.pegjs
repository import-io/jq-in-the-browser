{
    const identity = f => f
    const flow = funcs => funcs.reduce((result, element) => (input => element(result(input))), identity)
    const mapf = func => function(input) {
        if (input instanceof Stream) {
            return input.map(func)
        }

        return func(input)
    }
    const construct_pair_simple = (key, value) => input => {
        let obj = {};
        obj[key] = value(input);
        return obj;
    }
    const construct_pair = (key, value) => input => {
        const value_results = value(input)
        console.log(value_results, value_results instanceof Stream)
        if (value_results instanceof Stream) {
            return value_results.map(i => construct_pair_simple(key, f => f)(i))
        }
        return construct_pair_simple(key, value)(input)
    }

    const flatten = (arr) => [].concat.apply([], arr);

    const product = (...sets) =>
      sets.reduce((acc, set) =>
        flatten(acc.map(x => set.map(y => [ ...x, y ]))),
        [[]]);

    const combine_pairs = (left, right, input) => {
        console.log(left, right, input)
        const left_value = left(input)
        const right_value = right(input)
        if (left_value instanceof Stream) {
            if (right_value instanceof Stream) {
                return left_value.product(right_value).map((a, _) => Object.assign({}, ...a))
            }
        }
        return Object.assign(left_value, right_value)
    }
    const unpack = a => (a instanceof Stream) ? (unpack(a.unpack())) : a

    class Stream {
    // Simulates multiple "lines" of output
      constructor(items) {
        this.items = items;
      }

      unpack() {
        return this.items
      }

      map(f) {
        return new Stream(this.items.map(f))
      }

      product(other) {
        return new Stream(product(this.items, unpack(other)))
      }
    }
}

value
    = _ additive:additive _ {return input => unpack(additive(input))}

additive
    = left:multiplicative right:((_ ('+'/ '-') _ additive)+) {return input => {
        const f = (k) => ({
            '+': (a, b) => a + b,
            '-': (a, b) => a - b,
        }[k])
        return right.reduce(
            (result, element) => f(element[1])(result, element[3](input)),
            left(input))
    }}
    / multiplicative

multiplicative
    = left:pipeline right:((_ ('*'/ '/' / '%') _ pipeline)+) {return input => {
        const f = (k) => ({
            '*': (a, b) => a * b,
            '/': (a, b) => a / b,
            '%': (a, b) => a % b,
        }[k])
        return right.reduce(
            (result, element) => f(element[1])(result, element[3](input)),
            left(input))
    }}
    / pipeline

_
    = [ ]*

pipeline
    = "(" _ pipeline:value _ ")" {return pipeline}
    / left:filter _ "|" _ right:pipeline {return input => mapf(right)(left(input))}
    / filter

head_filter
    = float_literal
    / boolean_literal
    / object_identifier_index
    / identity
    / array_construction
    / object_construction
    / integer_literal
    / single_quote_string_literal
    / double_quote_string_literal
    / length
    / keys_unsorted
    / keys

double_quote_string_literal
    = '"' core:double_quote_string_core '"' {return input => core}

single_quote_string_literal
    = '\'' core:single_quote_string_core '\'' {return input => core}

boolean_literal
    = true
    / false

true
    = "true" {return input => true}

false
    = "false" {return input => false}

length
    = "length" {return input => input.length}

keys
    = "keys" {return input => Object.keys(input).sort()}

keys_unsorted
    = "keys_unsorted" {return input => Object.keys(input)}

array_construction
    = "[" _ "]" {return input => []}
    / "[" array_inside:array_inside "]" {return input => array_inside(input)}

object_construction
    = "{" _ "}" {return input => ({})}
    / "{" object_inside:object_inside "}" {return input => object_inside(input)}

array_inside
    = left:value _ "," _ right:array_inside {return input => [left(input)].concat(right(input))}
    / value:value {return input => [value(input)]}

object_inside
    = left:pair _ "," _ right:object_inside {return input => combine_pairs(left, right, input)}
    / pair:pair {return input => pair(input)}

pair
    = '"' key:double_quote_string_core '"' _ ':' _ value:additive {return construct_pair(key, value)}
    / "'" key:single_quote_string_core "'" _ ':' _ value:additive {return construct_pair(key, value)}
    / "(" _ key:value _  ")" _ ':' _ value:additive {return input => construct_pair(key(input), value)(input)}
    / key:name _ ':' _ value:additive {return construct_pair(key, value)}

float_literal
    = "-" number:float_literal {return input => -number(input)}
    / ([0-9]*) "." ([0-9]+) {const v = (text() * 1); return input => v}

integer_literal
    = "-" number:integer_literal {return input => -number(input)}
    / number:([0-9]+) {return input => number.join() * 1}

filter
    = head_filter:head_filter transforms:transforms {return i => transforms(head_filter(i))}
    / head_filter

transforms
    = funcs:(transform +) {return input => flow(funcs)(input)}

transform
    = bracket_transforms
    / object_identifier_index

bracket_transforms
    = "[" _ "]" {
        return function(input) {
            const handle_array = function(array) {
                if (array.length == 0) return []
                if (array.length == 1) return array[0]
                return new Stream(array)
            }

            if (input instanceof Array) {
                return handle_array(input)
            } else {
                if (typeof input === 'object') return handle_array(Object.values(input))
            }

            return input
        }
    }
    / '[' _ '"' _ key:double_quote_string_core _ '"' _ ']' {return i => i[key]}
    / '[' _ "'" _ key:single_quote_string_core _ "'" _ ']' {return i => i[key]}
    / "[" _ index:index _ "]" {return i => i[index]}
    / "[" _ "-" _ index:index _ "]" {return i => i[i.length - index]}

identity
    = "." {return identity}

object_identifier_index
    = "." name:name {return mapf(x => x[name])}

double_quote_string_core
    = double_quote_string_char* {return text()}

double_quote_string_char
    = [^"] {return text()}

single_quote_string_core
    = single_quote_string_char* {return text()}

single_quote_string_char
    = [^\'] {return text()}

name
    = name:([a-zA-Z_$][0-9a-zA-Z_$]*) {return text()}

index
    = index:[0-9]+ {return index}
