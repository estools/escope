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

describe 'ES6 block scope', ->
    it 'let is materialized in ES6 block scope#1', ->
        ast = harmony.parse """
{
    let i = 20;
    i;
}
        """

        scopeManager = escope.analyze ast, ecmaVersion: 6
        expect(scopeManager.scopes).to.have.length 2  # Program and BlcokStatement scope.

        scope = scopeManager.scopes[0]
        expect(scope.type).to.be.equal 'global'
        expect(scope.variables).to.have.length 0  # No variable in Program scope.

        scope = scopeManager.scopes[1]
        expect(scope.type).to.be.equal 'block'
        expect(scope.variables).to.have.length 1  # `i` in block scope.
        expect(scope.variables[0].name).to.be.equal 'i'
        expect(scope.references).to.have.length 2
        expect(scope.references[0].identifier.name).to.be.equal('i')
        expect(scope.references[1].identifier.name).to.be.equal('i')

    it 'let is materialized in ES6 block scope#2', ->
        ast = harmony.parse """
{
    let i = 20;
    var i = 20;
    i;
}
        """

        scopeManager = escope.analyze ast, ecmaVersion: 6
        expect(scopeManager.scopes).to.have.length 2  # Program and BlcokStatement scope.

        scope = scopeManager.scopes[0]
        expect(scope.type).to.be.equal 'global'
        expect(scope.variables).to.have.length 1  # No variable in Program scope.
        expect(scope.variables[0].name).to.be.equal 'i'

        scope = scopeManager.scopes[1]
        expect(scope.type).to.be.equal 'block'
        expect(scope.variables).to.have.length 1  # `i` in block scope.
        expect(scope.variables[0].name).to.be.equal 'i'
        expect(scope.references).to.have.length 3
        expect(scope.references[0].identifier.name).to.be.equal('i')
        expect(scope.references[1].identifier.name).to.be.equal('i')
        expect(scope.references[2].identifier.name).to.be.equal('i')

# vim: set sw=4 ts=4 et tw=80 :
