// -*- coding: utf-8 -*-
//  Copyright (C) 2014 Yusuke Suzuki <utatane.tea@gmail.com>
//
//  Redistribution and use in source and binary forms, with or without
//  modification, are permitted provided that the following conditions are met:
//
//    * Redistributions of source code must retain the above copyright
//      notice, this list of conditions and the following disclaimer.
//    * Redistributions in binary form must reproduce the above copyright
//      notice, this list of conditions and the following disclaimer in the
//      documentation and/or other materials provided with the distribution.
//
//  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
//  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
//  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
//  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
//  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
//  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
//  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
//  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
//  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
//  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

import { expect } from 'chai';
import { parse } from 'esprima';
import { analyze } from '../src/index.js';

describe('ES6 block scope', function() {
    it('let is materialized in ES6 block scope#1', function() {
        const ast = parse(`
            {
                let i = 20;
                i;
            }
        `);

        const scopeManager = analyze(ast, { ecmaVersion: 6 });
        expect(scopeManager.scopes).to.have.length(2);  // Program and BlcokStatement scope.

        let [scope] = scopeManager.scopes;
        expect(scope.type).to.be.equal('global');
        expect(scope.variables).to.have.length(0);  // No variable in Program scope.

        [, scope] = scopeManager.scopes;
        expect(scope.type).to.be.equal('block');
        expect(scope.variables).to.have.length(1);  // `i` in block scope.
        expect(scope.variables[0].name).to.be.equal('i');
        expect(scope.references).to.have.length(2);
        expect(scope.references[0].identifier.name).to.be.equal('i');
        expect(scope.references[1].identifier.name).to.be.equal('i');
    });

    it('let is materialized in ES6 block scope#2', function() {
        const ast = parse(`
            {
                let i = 20;
                var i = 20;
                i;
            }
        `);

        const scopeManager = analyze(ast, { ecmaVersion: 6 });
        expect(scopeManager.scopes).to.have.length(2);  // Program and BlcokStatement scope.

        let [scope] = scopeManager.scopes;
        expect(scope.type).to.be.equal('global');
        expect(scope.variables).to.have.length(1);  // No variable in Program scope.
        expect(scope.variables[0].name).to.be.equal('i');

        [, scope] = scopeManager.scopes;
        expect(scope.type).to.be.equal('block');
        expect(scope.variables).to.have.length(1);  // `i` in block scope.
        expect(scope.variables[0].name).to.be.equal('i');
        expect(scope.references).to.have.length(3);
        expect(scope.references[0].identifier.name).to.be.equal('i');
        expect(scope.references[1].identifier.name).to.be.equal('i');
        expect(scope.references[2].identifier.name).to.be.equal('i');
    });

    it('function delaration is materialized in ES6 block scope', function() {
        const ast = parse(`
            {
                function test() {
                }
                test();
            }
        `);

        const scopeManager = analyze(ast, { ecmaVersion: 6 });
        expect(scopeManager.scopes).to.have.length(3);

        let [scope] = scopeManager.scopes;
        expect(scope.type).to.be.equal('global');
        expect(scope.variables).to.have.length(0);

        [, scope] = scopeManager.scopes;
        expect(scope.type).to.be.equal('block');
        expect(scope.variables).to.have.length(1);
        expect(scope.variables[0].name).to.be.equal('test');
        expect(scope.references).to.have.length(1);
        expect(scope.references[0].identifier.name).to.be.equal('test');

        [, , scope] = scopeManager.scopes;
        expect(scope.type).to.be.equal('function');
        expect(scope.variables).to.have.length(1);
        expect(scope.variables[0].name).to.be.equal('arguments');
        expect(scope.references).to.have.length(0);
    });

    it('let is not hoistable#1', function() {
        const ast = parse(`
            var i = 42; (1)
            {
                i;  // (2) ReferenceError at runtime.
                let i = 20;  // (2)
                i;  // (2)
            }
        `);

        const scopeManager = analyze(ast, { ecmaVersion: 6 });
        expect(scopeManager.scopes).to.have.length(2);

        const [globalScope] = scopeManager.scopes;
        expect(globalScope.type).to.be.equal('global');
        expect(globalScope.variables).to.have.length(1);
        expect(globalScope.variables[0].name).to.be.equal('i');
        expect(globalScope.references).to.have.length(1);

        const [, scope] = scopeManager.scopes;
        expect(scope.type).to.be.equal('block');
        expect(scope.variables).to.have.length(1);
        expect(scope.variables[0].name).to.be.equal('i');
        expect(scope.references).to.have.length(3);
        expect(scope.references[0].resolved).to.be.equal(scope.variables[0]);
        expect(scope.references[1].resolved).to.be.equal(scope.variables[0]);
        expect(scope.references[2].resolved).to.be.equal(scope.variables[0]);
    });

    it('let is not hoistable#2', function() {
        const ast = parse(`
            (function () {
                var i = 42; // (1)
                i;  // (1)
                {
                    i;  // (3)
                    {
                        i;  // (2)
                        let i = 20;  // (2)
                        i;  // (2)
                    }
                    let i = 30;  // (3)
                    i;  // (3)
                }
                i;  // (1)
            }());
        `);

        const scopeManager = analyze(ast, { ecmaVersion: 6 });
        expect(scopeManager.scopes).to.have.length(4);

        const [globalScope] = scopeManager.scopes;
        expect(globalScope.type).to.be.equal('global');
        expect(globalScope.variables).to.have.length(0);
        expect(globalScope.references).to.have.length(0);

        let [, scope] = scopeManager.scopes;
        expect(scope.type).to.be.equal('function');
        expect(scope.variables).to.have.length(2);
        expect(scope.variables[0].name).to.be.equal('arguments');
        expect(scope.variables[1].name).to.be.equal('i');
        const [, v1] = scope.variables;
        expect(scope.references).to.have.length(3);
        expect(scope.references[0].resolved).to.be.equal(v1);
        expect(scope.references[1].resolved).to.be.equal(v1);
        expect(scope.references[2].resolved).to.be.equal(v1);

        [, , scope] = scopeManager.scopes;
        expect(scope.type).to.be.equal('block');
        expect(scope.variables).to.have.length(1);
        expect(scope.variables[0].name).to.be.equal('i');
        const [v3] = scope.variables;
        expect(scope.references).to.have.length(3);
        expect(scope.references[0].resolved).to.be.equal(v3);
        expect(scope.references[1].resolved).to.be.equal(v3);
        expect(scope.references[2].resolved).to.be.equal(v3);

        [, , , scope] = scopeManager.scopes;
        expect(scope.type).to.be.equal('block');
        expect(scope.variables).to.have.length(1);
        expect(scope.variables[0].name).to.be.equal('i');
        const [v2] = scope.variables;
        expect(scope.references).to.have.length(3);
        expect(scope.references[0].resolved).to.be.equal(v2);
        expect(scope.references[1].resolved).to.be.equal(v2);
        expect(scope.references[2].resolved).to.be.equal(v2);
    });
});

// vim: set sw=4 ts=4 et tw=80 :
