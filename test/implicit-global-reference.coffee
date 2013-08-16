# Copyright (C) 2013 Yusuke Suzuki <utatane.tea@gmail.com>
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions are met:
#
#   * Redistributions of source code must retain the above copyright
#     notice, this list of conditions and the following disclaimer.
#   * Redistributions in binary form must reproduce the above copyright
#     notice, this list of conditions and the following disclaimer in the
#     documentation and/or other materials provided with the distribution.
#
# THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
# AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
# IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
# ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
# DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
# (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
# LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
# ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
# (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
# THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

'use strict'

expect = require('chai').expect
escope = require '..'
esprima = require 'esprima'

describe 'implicit global reference', ->
    it 'assignment leaks', ->
        ast = esprima.parse """
        function outer() {
            x = 20;
        }
        """

        scopes = escope.analyze(ast).scopes

        expect(scopes.map((scope) ->
            scope.variables.map((variable) -> variable.name))).to.be.eql(
            [
                [
                    'outer'
                    'x'
                ]
                [
                    'arguments'
                ]
            ]
        )

    it 'assignment doesn\'t leak', ->
        ast = esprima.parse """
        function outer() {
            function inner() {
                x = 20;
            }
            var x;
        }
        """

        scopes = escope.analyze(ast).scopes

        expect(scopes.map((scope) ->
            scope.variables.map((variable) -> variable.name))).to.be.eql(
            [
                [
                    'outer'
                ]
                [
                    'arguments'
                    'inner'
                    'x'
                ]
                [
                    'arguments'
                ]
            ]
        )

    it 'for-in-statement leaks', ->
        ast = esprima.parse """
        function outer() {
            for (x in y) { }
        }
        """

        scopes = escope.analyze(ast).scopes

        expect(scopes.map((scope) ->
            scope.variables.map((variable) -> variable.name))).to.be.eql(
            [
                [
                    'outer'
                    'x'
                ]
                [
                    'arguments'
                ]
            ]
        )

    it 'for-in-statement doesn\'t leaks', ->
        ast = esprima.parse """
        function outer() {
            function inner() {
                for (x in y) { }
            }
            var x;
        }
        """

        scopes = escope.analyze(ast).scopes

        expect(scopes.map((scope) ->
            scope.variables.map((variable) -> variable.name))).to.be.eql(
            [
                [
                    'outer'
                ]
                [
                    'arguments'
                    'inner'
                    'x'
                ]
                [
                    'arguments'
                ]
            ]
        )
