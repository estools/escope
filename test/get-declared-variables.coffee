# -*- coding: utf-8 -*-
#  Copyright (C) 2015 Toru Nagashima
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
esrecurse = require 'esrecurse'
espree = require '../third_party/espree'
escope = require '..'

describe 'ScopeManager.prototype.getDeclaredVariables', ->

    verify = (ast, type, expectedNamesList) ->
        scopeManager = escope.analyze ast,
            ecmaVersion: 6
            sourceType: 'module'

        visitor = {}
        visitor[type] = (node) ->
            expected = expectedNamesList.shift()
            actual = scopeManager.getDeclaredVariables node

            expect(actual).to.have.length expected.length
            if actual.length > 0
                for i in [0..actual.length-1]
                    expect(actual[i].name).to.be.equal expected[i]

            @visitChildren node

        esrecurse.visit ast, visitor

        expect(expectedNamesList).to.have.length 0


    it 'should get variables that declared on `VariableDeclaration`', ->
        ast = espree """
        var {a, x: [b], y: {c = 0}} = foo;
        let {d, x: [e], y: {f = 0}} = foo;
        const {g, x: [h], y: {i = 0}} = foo, {j, k = function() { let l; }} = bar;
        """

        verify ast, 'VariableDeclaration', [
            ['a', 'b', 'c']
            ['d', 'e', 'f']
            ['g', 'h', 'i', 'j', 'k']
            ['l']
        ]


    it 'should get variables that declared on `VariableDeclaration` in for-in/of', ->
        ast = espree """
        for (var {a, x: [b], y: {c = 0}} in foo) {
            let g;
        }
        for (let {d, x: [e], y: {f = 0}} of foo) {
            let h;
        }
        """

        verify ast, 'VariableDeclaration', [
            ['a', 'b', 'c']
            ['g']
            ['d', 'e', 'f']
            ['h']
        ]


    it 'should get variables that declared on `VariableDeclarator`', ->
        ast = espree """
        var {a, x: [b], y: {c = 0}} = foo;
        let {d, x: [e], y: {f = 0}} = foo;
        const {g, x: [h], y: {i = 0}} = foo, {j, k = function() { let l; }} = bar;
        """

        verify ast, 'VariableDeclarator', [
            ['a', 'b', 'c']
            ['d', 'e', 'f']
            ['g', 'h', 'i']
            ['j', 'k']
            ['l']
        ]


    it 'should get variables that declared on `FunctionDeclaration`', ->
        ast = espree """
        function foo({a, x: [b], y: {c = 0}}, [d, e]) {
            let z;
        }
        function bar({f, x: [g], y: {h = 0}}, [i, j = function(q) { let w; }]) {
            let z;
        }
        """

        verify ast, 'FunctionDeclaration', [
            ['foo', 'a', 'b', 'c', 'd', 'e']
            ['bar', 'f', 'g', 'h', 'i', 'j']
        ]


    it 'should get variables that declared on `FunctionExpression`', ->
        ast = espree """
        (function foo({a, x: [b], y: {c = 0}}, [d, e]) {
            let z;
        });
        (function bar({f, x: [g], y: {h = 0}}, [i, j = function(q) { let w; }]) {
            let z;
        });
        """

        verify ast, 'FunctionExpression', [
            ['foo', 'a', 'b', 'c', 'd', 'e']
            ['bar', 'f', 'g', 'h', 'i', 'j']
            ['q']
        ]


    it 'should get variables that declared on `ArrowFunctionExpression`', ->
        ast = espree """
        (({a, x: [b], y: {c = 0}}, [d, e]) => {
            let z;
        });
        (({f, x: [g], y: {h = 0}}, [i, j]) => {
            let z;
        });
        """

        verify ast, 'ArrowFunctionExpression', [
            ['a', 'b', 'c', 'd', 'e']
            ['f', 'g', 'h', 'i', 'j']
        ]


    it 'should get variables that declared on `ClassDeclaration`', ->
        ast = espree """
        class A { foo(x) { let y; } }
        class B { foo(x) { let y; } }
        """

        verify ast, 'ClassDeclaration', [
            ['A', 'A'] # outer scope's and inner scope's.
            ['B', 'B']
        ]


    it 'should get variables that declared on `ClassExpression`', ->
        ast = espree """
        (class A { foo(x) { let y; } });
        (class B { foo(x) { let y; } });
        """

        verify ast, 'ClassExpression', [
            ['A']
            ['B']
        ]


    it 'should get variables that declared on `CatchClause`', ->
        ast = espree """
        try {} catch ({a, b}) {
            let x;
            try {} catch ({c, d}) {
                let y;
            }
        }
        """

        verify ast, 'CatchClause', [
            ['a', 'b']
            ['c', 'd']
        ]


    it 'should get variables that declared on `ImportDeclaration`', ->
        ast = espree """
        import "aaa";
        import * as a from "bbb";
        import b, {c, x as d} from "ccc";
        """, sourceType: 'module'

        verify ast, 'ImportDeclaration', [
            []
            ['a']
            ['b', 'c', 'd']
        ]


    it 'should get variables that declared on `ImportSpecifier`', ->
        ast = espree """
        import "aaa";
        import * as a from "bbb";
        import b, {c, x as d} from "ccc";
        """, sourceType: 'module'

        verify ast, 'ImportSpecifier', [
            ['c']
            ['d']
        ]


    it 'should get variables that declared on `ImportDefaultSpecifier`', ->
        ast = espree """
        import "aaa";
        import * as a from "bbb";
        import b, {c, x as d} from "ccc";
        """, sourceType: 'module'

        verify ast, 'ImportDefaultSpecifier', [
            ['b']
        ]


    it 'should get variables that declared on `ImportNamespaceSpecifier`', ->
        ast = espree """
        import "aaa";
        import * as a from "bbb";
        import b, {c, x as d} from "ccc";
        """, sourceType: 'module'

        verify ast, 'ImportNamespaceSpecifier', [
            ['a']
        ]


# vim: set sw=4 ts=4 et tw=80 :
