// -*- coding: utf-8 -*-
//  Copyright (C) 2015 Toru Nagashima
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
"use strict";

/* eslint-disable no-unused-expressions */
/* eslint-disable guard-for-in */

const expect = require("chai").expect;
const espree = require("../third_party/espree");
const analyze = require("..").analyze;

describe("ES6 default parameters:", function() {
    describe("a default parameter creates a writable reference for its initialization:", function() {
        const patterns = {
            FunctionDeclaration: "function foo(a, b = 0) {}",
            FunctionExpression: "let foo = function(a, b = 0) {};",
            ArrowExpression: "let foo = (a, b = 0) => {};"
        };

        for (const name in patterns) {
            const code = patterns[name];
            it(name, function() {
                const numVars = name === "ArrowExpression" ? 2 : 3;
                const ast = espree(code);

                const scopeManager = analyze(ast, {ecmaVersion: 6});
                expect(scopeManager.scopes).to.have.length(2);  // [global, foo]

                const scope = scopeManager.scopes[1];
                expect(scope.variables).to.have.length(numVars);  // [arguments?, a, b]
                expect(scope.references).to.have.length(1);

                const reference = scope.references[0];
                expect(reference.from).to.equal(scope);
                expect(reference.identifier.name).to.equal("b");
                expect(reference.resolved).to.equal(scope.variables[numVars - 1]);
                expect(reference.writeExpr).to.not.be.undefined;
                expect(reference.isWrite()).to.be.true;
                expect(reference.isRead()).to.be.false;
            });
        }
    });

    describe("a default parameter creates a readable reference for references in right:", function() {
        const patterns = {
            FunctionDeclaration: `
                let a;
                function foo(b = a) {}
            `,
            FunctionExpression: `
                let a;
                let foo = function(b = a) {}
            `,
            ArrowExpression: `
                let a;
                let foo = (b = a) => {};
            `
        };

        for (const name in patterns) {
            const code = patterns[name];
            it(name, function() {
                const numVars = name === "ArrowExpression" ? 1 : 2;
                const ast = espree(code);

                const scopeManager = analyze(ast, {ecmaVersion: 6});
                expect(scopeManager.scopes).to.have.length(2);  // [global, foo]

                const scope = scopeManager.scopes[1];
                expect(scope.variables).to.have.length(numVars);  // [arguments?, b]
                expect(scope.references).to.have.length(2);  // [b, a]

                const reference = scope.references[1];
                expect(reference.from).to.equal(scope);
                expect(reference.identifier.name).to.equal("a");
                expect(reference.resolved).to.equal(scopeManager.scopes[0].variables[0]);
                expect(reference.writeExpr).to.be.undefined;
                expect(reference.isWrite()).to.be.false;
                expect(reference.isRead()).to.be.true;
            });
        }
    });

    describe("a default parameter creates a readable reference for references in right (for const):", function() {
        const patterns = {
            FunctionDeclaration: `
                const a = 0;
                function foo(b = a) {}
            `,
            FunctionExpression: `
                const a = 0;
                let foo = function(b = a) {}
            `,
            ArrowExpression: `
                const a = 0;
                let foo = (b = a) => {};
            `
        };

        for (const name in patterns) {
            const code = patterns[name];
            it(name, function() {
                const numVars = name === "ArrowExpression" ? 1 : 2;
                const ast = espree(code);

                const scopeManager = analyze(ast, {ecmaVersion: 6});
                expect(scopeManager.scopes).to.have.length(2);  // [global, foo]

                const scope = scopeManager.scopes[1];
                expect(scope.variables).to.have.length(numVars);  // [arguments?, b]
                expect(scope.references).to.have.length(2);  // [b, a]

                const reference = scope.references[1];
                expect(reference.from).to.equal(scope);
                expect(reference.identifier.name).to.equal("a");
                expect(reference.resolved).to.equal(scopeManager.scopes[0].variables[0]);
                expect(reference.writeExpr).to.be.undefined;
                expect(reference.isWrite()).to.be.false;
                expect(reference.isRead()).to.be.true;
            });
        }
    });

    describe("a default parameter creates a readable reference for references in right (partial):", function() {
        const patterns = {
            FunctionDeclaration: `
                let a;
                function foo(b = a.c) {}
            `,
            FunctionExpression: `
                let a;
                let foo = function(b = a.c) {}
            `,
            ArrowExpression: `
                let a;
                let foo = (b = a.c) => {};
            `
        };

        for (const name in patterns) {
            const code = patterns[name];
            it(name, function() {
                const numVars = name === "ArrowExpression" ? 1 : 2;
                const ast = espree(code);

                const scopeManager = analyze(ast, {ecmaVersion: 6});
                expect(scopeManager.scopes).to.have.length(2);  // [global, foo]

                const scope = scopeManager.scopes[1];
                expect(scope.variables).to.have.length(numVars);  // [arguments?, b]
                expect(scope.references).to.have.length(2);  // [b, a]

                const reference = scope.references[1];
                expect(reference.from).to.equal(scope);
                expect(reference.identifier.name).to.equal("a");
                expect(reference.resolved).to.equal(scopeManager.scopes[0].variables[0]);
                expect(reference.writeExpr).to.be.undefined;
                expect(reference.isWrite()).to.be.false;
                expect(reference.isRead()).to.be.true;
            });
        }
    });

    describe("a default parameter creates a readable reference for references in right's nested scope:", function() {
        const patterns = {
            FunctionDeclaration: `
                let a;
                function foo(b = function() { return a; }) {}
            `,
            FunctionExpression: `
                let a;
                let foo = function(b = function() { return a; }) {}
            `,
            ArrowExpression: `
                let a;
                let foo = (b = function() { return a; }) => {};
            `
        };

        for (const name in patterns) {
            const code = patterns[name];
            it(name, function() {
                const ast = espree(code);

                const scopeManager = analyze(ast, {ecmaVersion: 6});
                expect(scopeManager.scopes).to.have.length(3);  // [global, foo, anonymous]

                const scope = scopeManager.scopes[2];
                expect(scope.variables).to.have.length(1);  // [arguments]
                expect(scope.references).to.have.length(1);  // [a]

                const reference = scope.references[0];
                expect(reference.from).to.equal(scope);
                expect(reference.identifier.name).to.equal("a");
                expect(reference.resolved).to.equal(scopeManager.scopes[0].variables[0]);
                expect(reference.writeExpr).to.be.undefined;
                expect(reference.isWrite()).to.be.false;
                expect(reference.isRead()).to.be.true;
            });
        }
    });
});

// vim: set sw=4 ts=4 et tw=80 :
