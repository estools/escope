'use strict'

expect = require('chai').expect
escope = require '..'

describe 'object expression', ->
  it 'doesn\'t require property type', ->
    # Hardcoded AST
    ast =
      type: 'Program'
      body: [{
        type: 'VariableDeclaration'
        declarations: [{
          type: 'VariableDeclarator'
          id:
            type: 'Identifier'
            name: 'a'
          init:
            type: 'ObjectExpression'
            properties: [{
              kind: 'init'
              key:
                type: 'Identifier'
                name: 'foo'
              value:
                type: 'Literal'
                value: 'bar'
                raw: 'bar'
            }]
        }]
      }]

    scope = escope.analyze(ast).scopes[0]

    # TODO - Verify results.  What am I looking for?
