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

describe 'ES6 default parameters:', ->
    describe 'a default parameter creates a writable reference for its initialization:', ->
        patterns =
            FunctionDeclaration: """
                function foo(a, b = 0) {}
            """
            FunctionExpression: """
                let foo = function(a, b = 0) {};
            """
            ArrowExpression: """
                let foo = (a, b = 0) => {};
            """

        for name, code of patterns then do (name, code) ->
            it name, ->
                numVars = if name == 'ArrowExpression' then 2 else 3
                ast = espree code

                scopeManager = escope.analyze ast, ecmaVersion: 6
                expect(scopeManager.scopes).to.have.length 2  # [global, foo]

                scope = scopeManager.scopes[1]
                expect(scope.variables).to.have.length numVars  # [arguments?, a, b]
                expect(scope.references).to.have.length 1

                reference = scope.references[0]
                expect(reference.from).to.equal scope
                expect(reference.identifier.name).to.equal 'b'
                expect(reference.resolved).to.equal scope.variables[numVars - 1]
                expect(reference.writeExpr).to.not.be.undefined
                expect(reference.isWrite()).to.be.true
                expect(reference.isRead()).to.be.false

    describe 'a default parameter creates a readable reference for references in right:', ->
        patterns =
            FunctionDeclaration: """
                let a;
                function foo(b = a) {}
            """
            FunctionExpression: """
                let a;
                let foo = function(b = a) {}
            """
            ArrowExpression: """
                let a;
                let foo = (b = a) => {};
            """

        for name, code of patterns then do (name, code) ->
            it name, ->
                numVars = if name == 'ArrowExpression' then 1 else 2
                ast = espree code

                scopeManager = escope.analyze ast, ecmaVersion: 6
                expect(scopeManager.scopes).to.have.length 2  # [global, foo]

                scope = scopeManager.scopes[1]
                expect(scope.variables).to.have.length numVars  # [arguments?, b]
                expect(scope.references).to.have.length 2  # [b, a]

                reference = scope.references[1]
                expect(reference.from).to.equal scope
                expect(reference.identifier.name).to.equal 'a'
                expect(reference.resolved).to.equal scopeManager.scopes[0].variables[0]
                expect(reference.writeExpr).to.be.undefined
                expect(reference.isWrite()).to.be.false
                expect(reference.isRead()).to.be.true

    describe 'a default parameter creates a readable reference for references in right (for const):', ->
        patterns =
            FunctionDeclaration: """
                const a = 0;
                function foo(b = a) {}
            """
            FunctionExpression: """
                const a = 0;
                let foo = function(b = a) {}
            """
            ArrowExpression: """
                const a = 0;
                let foo = (b = a) => {};
            """

        for name, code of patterns then do (name, code) ->
            it name, ->
                numVars = if name == 'ArrowExpression' then 1 else 2
                ast = espree code

                scopeManager = escope.analyze ast, ecmaVersion: 6
                expect(scopeManager.scopes).to.have.length 2  # [global, foo]

                scope = scopeManager.scopes[1]
                expect(scope.variables).to.have.length numVars  # [arguments?, b]
                expect(scope.references).to.have.length 2  # [b, a]

                reference = scope.references[1]
                expect(reference.from).to.equal scope
                expect(reference.identifier.name).to.equal 'a'
                expect(reference.resolved).to.equal scopeManager.scopes[0].variables[0]
                expect(reference.writeExpr).to.be.undefined
                expect(reference.isWrite()).to.be.false
                expect(reference.isRead()).to.be.true

    describe 'a default parameter creates a readable reference for references in right (partial):', ->
        patterns =
            FunctionDeclaration: """
                let a;
                function foo(b = a.c) {}
            """
            FunctionExpression: """
                let a;
                let foo = function(b = a.c) {}
            """
            ArrowExpression: """
                let a;
                let foo = (b = a.c) => {};
            """

        for name, code of patterns then do (name, code) ->
            it name, ->
                numVars = if name == 'ArrowExpression' then 1 else 2
                ast = espree code

                scopeManager = escope.analyze ast, ecmaVersion: 6
                expect(scopeManager.scopes).to.have.length 2  # [global, foo]

                scope = scopeManager.scopes[1]
                expect(scope.variables).to.have.length numVars  # [arguments?, b]
                expect(scope.references).to.have.length 2  # [b, a]

                reference = scope.references[1]
                expect(reference.from).to.equal scope
                expect(reference.identifier.name).to.equal 'a'
                expect(reference.resolved).to.equal scopeManager.scopes[0].variables[0]
                expect(reference.writeExpr).to.be.undefined
                expect(reference.isWrite()).to.be.false
                expect(reference.isRead()).to.be.true

    describe 'a default parameter creates a readable reference for references in right\'s nested scope:', ->
        patterns =
            FunctionDeclaration: """
                let a;
                function foo(b = function() { return a; }) {}
            """
            FunctionExpression: """
                let a;
                let foo = function(b = function() { return a; }) {}
            """
            ArrowExpression: """
                let a;
                let foo = (b = function() { return a; }) => {};
            """

        for name, code of patterns then do (name, code) ->
            it name, ->
                ast = espree code

                scopeManager = escope.analyze ast, ecmaVersion: 6
                expect(scopeManager.scopes).to.have.length 3  # [global, foo, anonymous]

                scope = scopeManager.scopes[2]
                expect(scope.variables).to.have.length 1  # [arguments]
                expect(scope.references).to.have.length 1  # [a]

                reference = scope.references[0]
                expect(reference.from).to.equal scope
                expect(reference.identifier.name).to.equal 'a'
                expect(reference.resolved).to.equal scopeManager.scopes[0].variables[0]
                expect(reference.writeExpr).to.be.undefined
                expect(reference.isWrite()).to.be.false
                expect(reference.isRead()).to.be.true

# vim: set sw=4 ts=4 et tw=80 :
