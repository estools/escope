/**
 * @fileoverview Typescript scope tests
 * @author Reyad Attiyat
 */
"use strict";

/* eslint-disable no-unused-expressions */

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const expect = require("chai").expect,
    parse = require("typescript-eslint-parser").parse,
    analyze = require("../src").analyze;

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("typescript", () => {
    describe("multiple call signatures", () => {
        it("should create a function scope", () => {
            const ast = parse(`
                function foo(bar: number): number;
                function foo(bar: string): string;
                function foo(bar: string | number): string | number {
                    return bar;
                }
            `);

            const scopeManager = analyze(ast);

            expect(scopeManager.scopes).to.have.length(4);

            const globalScope = scopeManager.scopes[0];
            expect(globalScope.type).to.be.equal("global");
            expect(globalScope.variables).to.have.length(1);
            expect(globalScope.references).to.have.length(0);
            expect(globalScope.isArgumentsMaterialized()).to.be.true;

            // Function scopes
            let scope = scopeManager.scopes[1];
            expect(scope.type).to.be.equal("function");
            expect(scope.variables).to.have.length(2);
            expect(scope.variables[0].name).to.be.equal("arguments");
            expect(scope.isArgumentsMaterialized()).to.be.false;
            expect(scope.references).to.have.length(0);

            scope = scopeManager.scopes[2];
            expect(scope.type).to.be.equal("function");
            expect(scope.variables).to.have.length(2);
            expect(scope.variables[0].name).to.be.equal("arguments");
            expect(scope.isArgumentsMaterialized()).to.be.false;
            expect(scope.references).to.have.length(0);

            scope = scopeManager.scopes[3];
            expect(scope.type).to.be.equal("function");
            expect(scope.variables).to.have.length(2);
            expect(scope.variables[0].name).to.be.equal("arguments");
            expect(scope.isArgumentsMaterialized()).to.be.false;
            expect(scope.references).to.have.length(1);


        });
    });
});
