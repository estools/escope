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
espree = require '../third_party/espree'
escope = require '..'

describe 'References:', ->
    describe 'When there is a `let` declaration on global,', ->
        it 'the reference on global should be resolved.', ->
            ast = espree """
            let a = 0;
            """

            scopeManager = escope.analyze ast, ecmaVersion: 6
            expect(scopeManager.scopes).to.have.length 1

            scope = scopeManager.scopes[0]
            expect(scope.variables).to.have.length 1
            expect(scope.references).to.have.length 1

            reference = scope.references[0]
            expect(reference.from).to.equal scope
            expect(reference.identifier.name).to.equal 'a'
            expect(reference.resolved).to.equal scope.variables[0]
            expect(reference.writeExpr).to.not.be.undefined
            expect(reference.isWrite()).to.be.true
            expect(reference.isRead()).to.be.false

        it 'the reference in functions should be resolved.', ->
            ast = espree """
            let a = 0;
            function foo() {
                let b = a;
            }
            """

            scopeManager = escope.analyze ast, ecmaVersion: 6
            expect(scopeManager.scopes).to.have.length 2  # [global, foo]

            scope = scopeManager.scopes[1]
            expect(scope.variables).to.have.length 2  # [arguments, b]
            expect(scope.references).to.have.length 2  # [b, a]

            reference = scope.references[1]
            expect(reference.from).to.equal scope
            expect(reference.identifier.name).to.equal 'a'
            expect(reference.resolved).to.equal scopeManager.scopes[0].variables[0]
            expect(reference.writeExpr).to.be.undefined
            expect(reference.isWrite()).to.be.false
            expect(reference.isRead()).to.be.true

        it 'the reference in default parameters should be resolved.', ->
            ast = espree """
            let a = 0;
            function foo(b = a) {
            }
            """

            scopeManager = escope.analyze ast, ecmaVersion: 6
            expect(scopeManager.scopes).to.have.length 2  # [global, foo]

            scope = scopeManager.scopes[1]
            expect(scope.variables).to.have.length 2  # [arguments, b]
            expect(scope.references).to.have.length 2  # [b, a]

            reference = scope.references[1]
            expect(reference.from).to.equal scope
            expect(reference.identifier.name).to.equal 'a'
            expect(reference.resolved).to.equal scopeManager.scopes[0].variables[0]
            expect(reference.writeExpr).to.be.undefined
            expect(reference.isWrite()).to.be.false
            expect(reference.isRead()).to.be.true

    describe 'When there is a `const` declaration on global,', ->
        it 'the reference on global should be resolved.', ->
            ast = espree """
            const a = 0;
            """

            scopeManager = escope.analyze ast, ecmaVersion: 6
            expect(scopeManager.scopes).to.have.length 1

            scope = scopeManager.scopes[0]
            expect(scope.variables).to.have.length 1
            expect(scope.references).to.have.length 1

            reference = scope.references[0]
            expect(reference.from).to.equal scope
            expect(reference.identifier.name).to.equal 'a'
            expect(reference.resolved).to.equal scope.variables[0]
            expect(reference.writeExpr).to.not.be.undefined
            expect(reference.isWrite()).to.be.true
            expect(reference.isRead()).to.be.false

        it 'the reference in functions should be resolved.', ->
            ast = espree """
            const a = 0;
            function foo() {
                const b = a;
            }
            """

            scopeManager = escope.analyze ast, ecmaVersion: 6
            expect(scopeManager.scopes).to.have.length 2  # [global, foo]

            scope = scopeManager.scopes[1]
            expect(scope.variables).to.have.length 2  # [arguments, b]
            expect(scope.references).to.have.length 2  # [b, a]

            reference = scope.references[1]
            expect(reference.from).to.equal scope
            expect(reference.identifier.name).to.equal 'a'
            expect(reference.resolved).to.equal scopeManager.scopes[0].variables[0]
            expect(reference.writeExpr).to.be.undefined
            expect(reference.isWrite()).to.be.false
            expect(reference.isRead()).to.be.true

    describe 'When there is a `var` declaration on global,', ->
        it 'the reference on global should NOT be resolved.', ->
            ast = espree """
            var a = 0;
            """

            scopeManager = escope.analyze ast, ecmaVersion: 6
            expect(scopeManager.scopes).to.have.length 1

            scope = scopeManager.scopes[0]
            expect(scope.variables).to.have.length 1
            expect(scope.references).to.have.length 1

            reference = scope.references[0]
            expect(reference.from).to.equal scope
            expect(reference.identifier.name).to.equal 'a'
            expect(reference.resolved).to.be.null
            expect(reference.writeExpr).to.not.be.undefined
            expect(reference.isWrite()).to.be.true
            expect(reference.isRead()).to.be.false

        it 'the reference in functions should NOT be resolved.', ->
            ast = espree """
            var a = 0;
            function foo() {
                var b = a;
            }
            """

            scopeManager = escope.analyze ast, ecmaVersion: 6
            expect(scopeManager.scopes).to.have.length 2  # [global, foo]

            scope = scopeManager.scopes[1]
            expect(scope.variables).to.have.length 2  # [arguments, b]
            expect(scope.references).to.have.length 2  # [b, a]

            reference = scope.references[1]
            expect(reference.from).to.equal scope
            expect(reference.identifier.name).to.equal 'a'
            expect(reference.resolved).to.be.null
            expect(reference.writeExpr).to.be.undefined
            expect(reference.isWrite()).to.be.false
            expect(reference.isRead()).to.be.true

    describe 'When there is a `function` declaration on global,', ->
        it 'the reference on global should NOT be resolved.', ->
            ast = espree """
            function a() {}
            a();
            """

            scopeManager = escope.analyze ast, ecmaVersion: 6
            expect(scopeManager.scopes).to.have.length 2  # [global, a]

            scope = scopeManager.scopes[0]
            expect(scope.variables).to.have.length 1
            expect(scope.references).to.have.length 1

            reference = scope.references[0]
            expect(reference.from).to.equal scope
            expect(reference.identifier.name).to.equal 'a'
            expect(reference.resolved).to.be.null
            expect(reference.writeExpr).to.be.undefined
            expect(reference.isWrite()).to.be.false
            expect(reference.isRead()).to.be.true

        it 'the reference in functions should NOT be resolved.', ->
            ast = espree """
            function a() {}
            function foo() {
                let b = a();
            }
            """

            scopeManager = escope.analyze ast, ecmaVersion: 6
            expect(scopeManager.scopes).to.have.length 3  # [global, a, foo]

            scope = scopeManager.scopes[2]
            expect(scope.variables).to.have.length 2  # [arguments, b]
            expect(scope.references).to.have.length 2  # [b, a]

            reference = scope.references[1]
            expect(reference.from).to.equal scope
            expect(reference.identifier.name).to.equal 'a'
            expect(reference.resolved).to.be.null
            expect(reference.writeExpr).to.be.undefined
            expect(reference.isWrite()).to.be.false
            expect(reference.isRead()).to.be.true

    describe 'When there is a `class` declaration on global,', ->
        it 'the reference on global should be resolved.', ->
            ast = espree """
            class A {}
            let b = new A();
            """

            scopeManager = escope.analyze ast, ecmaVersion: 6
            expect(scopeManager.scopes).to.have.length 2  # [global, A]

            scope = scopeManager.scopes[0]
            expect(scope.variables).to.have.length 2  # [A, b]
            expect(scope.references).to.have.length 2  # [b, A]

            reference = scope.references[1]
            expect(reference.from).to.equal scope
            expect(reference.identifier.name).to.equal 'A'
            expect(reference.resolved).to.equal scope.variables[0]
            expect(reference.writeExpr).to.be.undefined
            expect(reference.isWrite()).to.be.false
            expect(reference.isRead()).to.be.true

        it 'the reference in functions should be resolved.', ->
            ast = espree """
            class A {}
            function foo() {
                let b = new A();
            }
            """

            scopeManager = escope.analyze ast, ecmaVersion: 6
            expect(scopeManager.scopes).to.have.length 3  # [global, A, foo]

            scope = scopeManager.scopes[2]
            expect(scope.variables).to.have.length 2  # [arguments, b]
            expect(scope.references).to.have.length 2  # [b, A]

            reference = scope.references[1]
            expect(reference.from).to.equal scope
            expect(reference.identifier.name).to.equal 'A'
            expect(reference.resolved).to.equal scopeManager.scopes[0].variables[0]
            expect(reference.writeExpr).to.be.undefined
            expect(reference.isWrite()).to.be.false
            expect(reference.isRead()).to.be.true

    describe 'When there is a `let` declaration in functions,', ->
        it 'the reference on the function should be resolved.', ->
            ast = espree """
            function foo() {
                let a = 0;
            }
            """

            scopeManager = escope.analyze ast, ecmaVersion: 6
            expect(scopeManager.scopes).to.have.length 2  # [global, foo]

            scope = scopeManager.scopes[1]
            expect(scope.variables).to.have.length 2  # [arguments, a]
            expect(scope.references).to.have.length 1

            reference = scope.references[0]
            expect(reference.from).to.equal scope
            expect(reference.identifier.name).to.equal 'a'
            expect(reference.resolved).to.equal scope.variables[1]
            expect(reference.writeExpr).to.not.be.undefined
            expect(reference.isWrite()).to.be.true
            expect(reference.isRead()).to.be.false

        it 'the reference in nested functions should be resolved.', ->
            ast = espree """
            function foo() {
                let a = 0;
                function bar() {
                    let b = a;
                }
            }
            """

            scopeManager = escope.analyze ast, ecmaVersion: 6
            expect(scopeManager.scopes).to.have.length 3  # [global, foo, bar]

            scope = scopeManager.scopes[2]
            expect(scope.variables).to.have.length 2  # [arguments, b]
            expect(scope.references).to.have.length 2  # [b, a]

            reference = scope.references[1]
            expect(reference.from).to.equal scope
            expect(reference.identifier.name).to.equal 'a'
            expect(reference.resolved).to.equal scopeManager.scopes[1].variables[1]
            expect(reference.writeExpr).to.be.undefined
            expect(reference.isWrite()).to.be.false
            expect(reference.isRead()).to.be.true

    describe 'When there is a `var` declaration in functions,', ->
        it 'the reference on the function should be resolved.', ->
            ast = espree """
            function foo() {
                var a = 0;
            }
            """

            scopeManager = escope.analyze ast, ecmaVersion: 6
            expect(scopeManager.scopes).to.have.length 2  # [global, foo]

            scope = scopeManager.scopes[1]
            expect(scope.variables).to.have.length 2  # [arguments, a]
            expect(scope.references).to.have.length 1

            reference = scope.references[0]
            expect(reference.from).to.equal scope
            expect(reference.identifier.name).to.equal 'a'
            expect(reference.resolved).to.equal scope.variables[1]
            expect(reference.writeExpr).to.not.be.undefined
            expect(reference.isWrite()).to.be.true
            expect(reference.isRead()).to.be.false

        it 'the reference in nested functions should be resolved.', ->
            ast = espree """
            function foo() {
                var a = 0;
                function bar() {
                    var b = a;
                }
            }
            """

            scopeManager = escope.analyze ast, ecmaVersion: 6
            expect(scopeManager.scopes).to.have.length 3  # [global, foo, bar]

            scope = scopeManager.scopes[2]
            expect(scope.variables).to.have.length 2  # [arguments, b]
            expect(scope.references).to.have.length 2  # [b, a]

            reference = scope.references[1]
            expect(reference.from).to.equal scope
            expect(reference.identifier.name).to.equal 'a'
            expect(reference.resolved).to.equal scopeManager.scopes[1].variables[1]
            expect(reference.writeExpr).to.be.undefined
            expect(reference.isWrite()).to.be.false
            expect(reference.isRead()).to.be.true

    describe 'When there is a `let` declaration with destructuring assignment', ->
        it '"let [a] = [1];", the reference should be resolved.', ->
            ast = espree """
            let [a] = [1];
            """

            scopeManager = escope.analyze ast, ecmaVersion: 6
            expect(scopeManager.scopes).to.have.length 1

            scope = scopeManager.scopes[0]
            expect(scope.variables).to.have.length 1
            expect(scope.references).to.have.length 1

            reference = scope.references[0]
            expect(reference.from).to.equal scope
            expect(reference.identifier.name).to.equal 'a'
            expect(reference.resolved).to.equal scope.variables[0]
            expect(reference.writeExpr).to.not.be.undefined
            expect(reference.isWrite()).to.be.true
            expect(reference.isRead()).to.be.false

        it '"let {a} = {a: 1};", the reference should be resolved.', ->
            ast = espree """
            let {a} = {a: 1};
            """

            scopeManager = escope.analyze ast, ecmaVersion: 6
            expect(scopeManager.scopes).to.have.length 1

            scope = scopeManager.scopes[0]
            expect(scope.variables).to.have.length 1
            expect(scope.references).to.have.length 1

            reference = scope.references[0]
            expect(reference.from).to.equal scope
            expect(reference.identifier.name).to.equal 'a'
            expect(reference.resolved).to.equal scope.variables[0]
            expect(reference.writeExpr).to.not.be.undefined
            expect(reference.isWrite()).to.be.true
            expect(reference.isRead()).to.be.false

        it '"let {a: {a}} = {a: {a: 1}};", the reference should be resolved.', ->
            ast = espree """
            let {a: {a}} = {a: {a: 1}};
            """

            scopeManager = escope.analyze ast, ecmaVersion: 6
            expect(scopeManager.scopes).to.have.length 1

            scope = scopeManager.scopes[0]
            expect(scope.variables).to.have.length 1
            expect(scope.references).to.have.length 1

            reference = scope.references[0]
            expect(reference.from).to.equal scope
            expect(reference.identifier.name).to.equal 'a'
            expect(reference.resolved).to.equal scope.variables[0]
            expect(reference.writeExpr).to.not.be.undefined
            expect(reference.isWrite()).to.be.true
            expect(reference.isRead()).to.be.false

    describe 'Reference.init should be a boolean value of whether it is one to initialize or not.', ->
        trueCodes = [
            'var a = 0;'
            'let a = 0;'
            'const a = 0;'
            'var [a] = [];'
            'let [a] = [];'
            'const [a] = [];'
            'var [a = 1] = [];'
            'let [a = 1] = [];'
            'const [a = 1] = [];'
            'var {a} = {};'
            'let {a} = {};'
            'const {a} = {};'
            'var {b: a} = {};'
            'let {b: a} = {};'
            'const {b: a} = {};'
            'var {b: a = 0} = {};'
            'let {b: a = 0} = {};'
            'const {b: a = 0} = {};'
            'for (var a in []);'
            'for (let a in []);'
            'for (var [a] in []);'
            'for (let [a] in []);'
            'for (var [a = 0] in []);'
            'for (let [a = 0] in []);'
            'for (var {a} in []);'
            'for (let {a} in []);'
            'for (var {a = 0} in []);'
            'for (let {a = 0} in []);'
            'new function(a = 0) {}'
            'new function([a = 0] = []) {}'
            'new function({b: a = 0} = {}) {}'
        ]
        for code in trueCodes then do (code) ->
            it '"' + code + '", all references should be true.', ->
                ast = espree code

                scopeManager = escope.analyze ast, ecmaVersion: 6
                expect(scopeManager.scopes).to.be.length.of.at.least 1

                scope = scopeManager.scopes[scopeManager.scopes.length - 1]
                expect(scope.variables).to.have.length.of.at.least 1
                expect(scope.references).to.have.length.of.at.least 1

                for reference in scope.references
                    expect(reference.identifier.name).to.equal 'a'
                    expect(reference.isWrite()).to.be.true
                    expect(reference.init).to.be.true

        falseCodes = [
            'let a; a = 0;'
            'let a; [a] = [];'
            'let a; [a = 1] = [];'
            'let a; ({a}) = {};'
            'let a; ({b: a}) = {};'
            'let a; ({b: a = 0}) = {};'
            'let a; for (a in []);'
            'let a; for ([a] in []);'
            'let a; for ([a = 0] in []);'
            'let a; for ({a} in []);'
            'let a; for ({a = 0} in []);'
        ]
        for code in falseCodes then do (code) ->
            it '"' + code + '", all references should be false.', ->
                ast = espree code

                scopeManager = escope.analyze ast, ecmaVersion: 6
                expect(scopeManager.scopes).to.be.length.of.at.least 1

                scope = scopeManager.scopes[scopeManager.scopes.length - 1]
                expect(scope.variables).to.have.length 1
                expect(scope.references).to.have.length.of.at.least 1

                for reference in scope.references
                    expect(reference.identifier.name).to.equal 'a'
                    expect(reference.isWrite()).to.be.true
                    expect(reference.init).to.be.false

        falseCodes = [
            'let a; let b = a;'
            'let a; let [b] = a;'
            'let a; let [b = a] = [];'
            'let a; for (var b in a);'
            'let a; for (var [b = a] in []);'
            'let a; for (let b in a);'
            'let a; for (let [b = a] in []);'
            'let a,b; b = a;'
            'let a,b; [b] = a;'
            'let a,b; [b = a] = [];'
            'let a,b; for (b in a);'
            'let a,b; for ([b = a] in []);'
            'let a; a.foo = 0;'
            'let a,b; b = a.foo;'
        ]
        for code in falseCodes then do (code) ->
            it '"' + code + '", readonly references of "a" should be undefined.', ->
                ast = espree code

                scopeManager = escope.analyze ast, ecmaVersion: 6
                expect(scopeManager.scopes).to.be.length.of.at.least 1

                scope = scopeManager.scopes[0]
                expect(scope.variables).to.have.length.of.at.least 1
                expect(scope.variables[0].name).to.equal 'a'

                references = scope.variables[0].references
                expect(references).to.have.length.of.at.least 1

                for reference in references
                    expect(reference.isRead()).to.be.true
                    expect(reference.init).to.be.undefined

# vim: set sw=4 ts=4 et tw=80 :
