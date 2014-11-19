# -*- coding: utf-8 -*-
#  Copyright (C) 2014 Yusuke Suzuki <utatane.tea@gmail.com>
#
#  Redistribution and use in source and binary forms, with or without
#  modification, are permitted provided that the following conditions are met:
#
#    * Redistributions of source code must retain the above copyright
#      notice, this list of conditions and the following disclaimer.
#    * Redistributions in binary form must reproduce the above copyright
#      notice, this list of conditions and the following disclaimer in the
#      documentation and/or other materials provided with the distribution.
#
#  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
#  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
#  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
#  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
#  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
#  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
#  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
#  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
#  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
#  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

expect = require('chai').expect
harmony = require '../third_party/esprima'
escope = require '..'

describe 'ES6 destructuring assignments', ->
    it 'ArrayPattern in var', ->
        ast = harmony.parse """
        (function () {
            var [a, b, c] = array;
        }());
        """

        scopeManager = escope.analyze ast, ecmaVersion: 6
        expect(scopeManager.scopes).to.have.length 2

        scope = scopeManager.scopes[0]
        globalScope = scope
        expect(scope.type).to.be.equal 'global'
        expect(scope.variables).to.have.length 0
        expect(scope.references).to.have.length 0
        expect(scope.implicit.left).to.have.length 1
        expect(scope.implicit.left[0].identifier.name).to.be.equal 'array'

        scope = scopeManager.scopes[1]
        expect(scope.type).to.be.equal 'function'
        expect(scope.variables).to.have.length 4
        expect(scope.variables[0].name).to.be.equal 'arguments'
        expect(scope.variables[1].name).to.be.equal 'a'
        expect(scope.variables[2].name).to.be.equal 'b'
        expect(scope.variables[3].name).to.be.equal 'c'
        expect(scope.references).to.have.length 4
        expect(scope.references[0].identifier.name).to.be.equal 'a'
        expect(scope.references[0].isWrite()).to.be.true
        expect(scope.references[0].partial).to.be.true
        expect(scope.references[0].resolved).to.be.equal scope.variables[1]
        expect(scope.references[1].identifier.name).to.be.equal 'b'
        expect(scope.references[1].isWrite()).to.be.true
        expect(scope.references[1].partial).to.be.true
        expect(scope.references[1].resolved).to.be.equal scope.variables[2]
        expect(scope.references[2].identifier.name).to.be.equal 'c'
        expect(scope.references[2].isWrite()).to.be.true
        expect(scope.references[2].partial).to.be.true
        expect(scope.references[2].resolved).to.be.equal scope.variables[3]
        expect(scope.references[3].identifier.name).to.be.equal 'array'
        expect(scope.references[3].isWrite()).to.be.false

    it 'SpreadElement in var', ->
        ast = harmony.parse """
        (function () {
            var [a, b, ...rest] = array;
        }());
        """

        scopeManager = escope.analyze ast, ecmaVersion: 6
        expect(scopeManager.scopes).to.have.length 2

        scope = scopeManager.scopes[0]
        globalScope = scope
        expect(scope.type).to.be.equal 'global'
        expect(scope.variables).to.have.length 0
        expect(scope.references).to.have.length 0
        expect(scope.implicit.left).to.have.length 1
        expect(scope.implicit.left[0].identifier.name).to.be.equal 'array'

        scope = scopeManager.scopes[1]
        expect(scope.type).to.be.equal 'function'
        expect(scope.variables).to.have.length 4
        expect(scope.variables[0].name).to.be.equal 'arguments'
        expect(scope.variables[1].name).to.be.equal 'a'
        expect(scope.variables[2].name).to.be.equal 'b'
        expect(scope.variables[3].name).to.be.equal 'rest'
        expect(scope.references).to.have.length 4
        expect(scope.references[0].identifier.name).to.be.equal 'a'
        expect(scope.references[0].isWrite()).to.be.true
        expect(scope.references[0].partial).to.be.true
        expect(scope.references[0].resolved).to.be.equal scope.variables[1]
        expect(scope.references[1].identifier.name).to.be.equal 'b'
        expect(scope.references[1].isWrite()).to.be.true
        expect(scope.references[1].partial).to.be.true
        expect(scope.references[1].resolved).to.be.equal scope.variables[2]
        expect(scope.references[2].identifier.name).to.be.equal 'rest'
        expect(scope.references[2].isWrite()).to.be.true
        expect(scope.references[2].partial).to.be.true
        expect(scope.references[2].resolved).to.be.equal scope.variables[3]
        expect(scope.references[3].identifier.name).to.be.equal 'array'
        expect(scope.references[3].isWrite()).to.be.false

        ast = harmony.parse """
        (function () {
            var [a, b, ...[c, d, ...rest]] = array;
        }());
        """

        scopeManager = escope.analyze ast, ecmaVersion: 6
        expect(scopeManager.scopes).to.have.length 2

        scope = scopeManager.scopes[0]
        globalScope = scope
        expect(scope.type).to.be.equal 'global'
        expect(scope.variables).to.have.length 0
        expect(scope.references).to.have.length 0
        expect(scope.implicit.left).to.have.length 1
        expect(scope.implicit.left[0].identifier.name).to.be.equal 'array'

        scope = scopeManager.scopes[1]
        expect(scope.type).to.be.equal 'function'

        expect(scope.variables).to.have.length 6
        for name, index in [
                'arguments'
                'a'
                'b'
                'c'
                'd'
                'rest'
            ]
            expect(scope.variables[index].name).to.be.equal name

        expect(scope.references).to.have.length 6
        for name, index in [
                'a'
                'b'
                'c'
                'd'
                'rest'
            ]
            expect(scope.references[index].identifier.name).to.be.equal name
            expect(scope.references[index].isWrite()).to.be.true
            expect(scope.references[index].partial).to.be.true
        expect(scope.references[5].identifier.name).to.be.equal 'array'
        expect(scope.references[5].isWrite()).to.be.false

    it 'ObjectPattern in var', ->
        ast = harmony.parse """
        (function () {
            var {
                shorthand,
                key: value,
                hello: {
                    world
                }
            } = object;
        }());
        """

        scopeManager = escope.analyze ast, ecmaVersion: 6
        expect(scopeManager.scopes).to.have.length 2

        scope = scopeManager.scopes[0]
        globalScope = scope
        expect(scope.type).to.be.equal 'global'
        expect(scope.variables).to.have.length 0
        expect(scope.references).to.have.length 0
        expect(scope.implicit.left).to.have.length 1
        expect(scope.implicit.left[0].identifier.name).to.be.equal 'object'

        scope = scopeManager.scopes[1]
        expect(scope.type).to.be.equal 'function'
        expect(scope.variables).to.have.length 4
        expect(scope.variables[0].name).to.be.equal 'arguments'
        expect(scope.variables[1].name).to.be.equal 'shorthand'
        expect(scope.variables[2].name).to.be.equal 'value'
        expect(scope.variables[3].name).to.be.equal 'world'
        expect(scope.references).to.have.length 4
        expect(scope.references[0].identifier.name).to.be.equal 'shorthand'
        expect(scope.references[0].isWrite()).to.be.true
        expect(scope.references[0].partial).to.be.true
        expect(scope.references[0].resolved).to.be.equal scope.variables[1]
        expect(scope.references[1].identifier.name).to.be.equal 'value'
        expect(scope.references[1].isWrite()).to.be.true
        expect(scope.references[1].partial).to.be.true
        expect(scope.references[1].resolved).to.be.equal scope.variables[2]
        expect(scope.references[2].identifier.name).to.be.equal 'world'
        expect(scope.references[2].isWrite()).to.be.true
        expect(scope.references[2].partial).to.be.true
        expect(scope.references[2].resolved).to.be.equal scope.variables[3]
        expect(scope.references[3].identifier.name).to.be.equal 'object'
        expect(scope.references[3].isWrite()).to.be.false


    it 'complex pattern in var', ->
        ast = harmony.parse """
        (function () {
            var {
                shorthand,
                key: [ a, b, c, d, e ],
                hello: {
                    world
                }
            } = object;
        }());
        """

        scopeManager = escope.analyze ast, ecmaVersion: 6
        expect(scopeManager.scopes).to.have.length 2

        scope = scopeManager.scopes[0]
        globalScope = scope
        expect(scope.type).to.be.equal 'global'
        expect(scope.variables).to.have.length 0
        expect(scope.references).to.have.length 0
        expect(scope.implicit.left).to.have.length 1
        expect(scope.implicit.left[0].identifier.name).to.be.equal 'object'

        scope = scopeManager.scopes[1]
        expect(scope.type).to.be.equal 'function'
        expect(scope.variables).to.have.length 8
        for name, index in [
                'arguments'
                'shorthand'
                'a'
                'b'
                'c'
                'd'
                'e'
                'world'
            ]
            expect(scope.variables[index].name).to.be.equal name
        expect(scope.references).to.have.length 8
        for name, index in [
                'shorthand'
                'a'
                'b'
                'c'
                'd'
                'e'
                'world'
            ]
            expect(scope.references[index].identifier.name).to.be.equal name
            expect(scope.references[index].isWrite()).to.be.true
            expect(scope.references[index].partial).to.be.true
        expect(scope.references[7].identifier.name).to.be.equal 'object'
        expect(scope.references[7].isWrite()).to.be.false

# vim: set sw=4 ts=4 et tw=80 :
