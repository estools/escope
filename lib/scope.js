/*
  Copyright (C) 2015 Yusuke Suzuki <utatane.tea@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
(function () {
    'use strict';

    var Syntax,
        Map,
        Reference,
        Variable,
        Definition,
        assert;

    Syntax = require('estraverse').Syntax;
    Map = require('es6-map');

    Reference = require('./reference');
    Variable = require('./variable');
    Definition = require('./definition');
    assert = require('assert');

    function isStrictScope(scope, block, isMethodDefinition, useDirective) {
        var body, i, iz, stmt, expr;

        // When upper scope is exists and strict, inner scope is also strict.
        if (scope.upper && scope.upper.isStrict) {
            return true;
        }

        // ArrowFunctionExpression's scope is always strict scope.
        if (block.type === Syntax.ArrowFunctionExpression) {
            return true;
        }

        if (isMethodDefinition) {
            return true;
        }

        if (scope.type === 'class' || scope.type === 'module') {
            return true;
        }

        if (scope.type === 'block' || scope.type === 'switch') {
            return false;
        }

        if (scope.type === 'function') {
            body = block.body;
        } else if (scope.type === 'global') {
            body = block;
        } else {
            return false;
        }

        // Search 'use strict' directive.
        if (useDirective) {
            for (i = 0, iz = body.body.length; i < iz; ++i) {
                stmt = body.body[i];
                if (stmt.type !== 'DirectiveStatement') {
                    break;
                }
                if (stmt.raw === '"use strict"' || stmt.raw === '\'use strict\'') {
                    return true;
                }
            }
        } else {
            for (i = 0, iz = body.body.length; i < iz; ++i) {
                stmt = body.body[i];
                if (stmt.type !== Syntax.ExpressionStatement) {
                    break;
                }
                expr = stmt.expression;
                if (expr.type !== Syntax.Literal || typeof expr.value !== 'string') {
                    break;
                }
                if (expr.raw != null) {
                    if (expr.raw === '"use strict"' || expr.raw === '\'use strict\'') {
                        return true;
                    }
                } else {
                    if (expr.value === 'use strict') {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function registerScope(scopeManager, scope) {
        var scopes;

        scopeManager.scopes.push(scope);

        scopes = scopeManager.__nodeToScope.get(scope.block);
        if (scopes) {
            scopes.push(scope);
        } else {
            scopeManager.__nodeToScope.set(scope.block, [ scope ]);
        }
    }

    /* Special Scope types. */
    var SCOPE_NORMAL = 0,
        SCOPE_MODULE = 1,
        SCOPE_FUNCTION_EXPRESSION_NAME = 2,
        SCOPE_TDZ = 3;

    /**
     * @class Scope
     */
    function Scope(scopeManager, block, isMethodDefinition, scopeType) {
        /**
         * One of 'catch', 'with', 'function', 'global' or 'block'.
         * @member {String} Scope#type
         */
        this.type =
            (scopeType === SCOPE_TDZ) ? 'TDZ' :
            (scopeType === SCOPE_MODULE) ? 'module' :
            (block.type === Syntax.BlockStatement) ? 'block' :
            (block.type === Syntax.SwitchStatement) ? 'switch' :
            (block.type === Syntax.FunctionExpression || block.type === Syntax.FunctionDeclaration || block.type === Syntax.ArrowFunctionExpression) ? 'function' :
            (block.type === Syntax.CatchClause) ? 'catch' :
            (block.type === Syntax.ForInStatement || block.type === Syntax.ForOfStatement || block.type === Syntax.ForStatement) ? 'for' :
            (block.type === Syntax.WithStatement) ? 'with' :
            (block.type === Syntax.ClassExpression || block.type === Syntax.ClassDeclaration) ? 'class' : 'global';
         /**
         * The scoped {@link Variable}s of this scope, as <code>{ Variable.name
         * : Variable }</code>.
         * @member {Map} Scope#set
         */
        this.set = new Map();
        /**
         * The tainted variables of this scope, as <code>{ Variable.name :
         * boolean }</code>.
         * @member {Map} Scope#taints */
        this.taints = new Map();
        /**
         * Generally, through the lexical scoping of JS you can always know
         * which variable an identifier in the source code refers to. There are
         * a few exceptions to this rule. With 'global' and 'with' scopes you
         * can only decide at runtime which variable a reference refers to.
         * Moreover, if 'eval()' is used in a scope, it might introduce new
         * bindings in this or its prarent scopes.
         * All those scopes are considered 'dynamic'.
         * @member {boolean} Scope#dynamic
         */
        this.dynamic = this.type === 'global' || this.type === 'with';
        /**
         * A reference to the scope-defining syntax node.
         * @member {esprima.Node} Scope#block
         */
        this.block = block;
         /**
         * The {@link Reference|references} that are not resolved with this scope.
         * @member {Reference[]} Scope#through
         */
        this.through = [];
         /**
         * The scoped {@link Variable}s of this scope. In the case of a
         * 'function' scope this includes the automatic argument <em>arguments</em> as
         * its first element, as well as all further formal arguments.
         * @member {Variable[]} Scope#variables
         */
        this.variables = [];
         /**
         * Any variable {@link Reference|reference} found in this scope. This
         * includes occurrences of local variables as well as variables from
         * parent scopes (including the global scope). For local variables
         * this also includes defining occurrences (like in a 'var' statement).
         * In a 'function' scope this does not include the occurrences of the
         * formal parameter in the parameter list.
         * @member {Reference[]} Scope#references
         */
        this.references = [];

         /**
         * For 'global' and 'function' scopes, this is a self-reference. For
         * other scope types this is the <em>variableScope</em> value of the
         * parent scope.
         * @member {Scope} Scope#variableScope
         */
        this.variableScope =
            (this.type === 'global' || this.type === 'function' || this.type === 'module') ? this : scopeManager.__currentScope.variableScope;
         /**
         * Whether this scope is created by a FunctionExpression.
         * @member {boolean} Scope#functionExpressionScope
         */
        this.functionExpressionScope = false;
         /**
         * Whether this is a scope that contains an 'eval()' invocation.
         * @member {boolean} Scope#directCallToEvalScope
         */
        this.directCallToEvalScope = false;
         /**
         * @member {boolean} Scope#thisFound
         */
        this.thisFound = false;

        this.__left = [];

        if (scopeType === SCOPE_FUNCTION_EXPRESSION_NAME) {
            this.__define(block.id,
                    new Definition(
                        Variable.FunctionName,
                        block.id,
                        block,
                        null,
                        null,
                        null
                    ));
            this.functionExpressionScope = true;
        } else {
            // section 9.2.13, FunctionDeclarationInstantiation.
            // NOTE Arrow functions never have an arguments objects.
            if (this.type === 'function' && this.block.type !== Syntax.ArrowFunctionExpression) {
                this.__defineArguments();
            }

            if (block.type === Syntax.FunctionExpression && block.id) {
                scopeManager.__nestFunctionExpressionNameScope(block, isMethodDefinition);
            }
        }

         /**
         * Reference to the parent {@link Scope|scope}.
         * @member {Scope} Scope#upper
         */
        this.upper = scopeManager.__currentScope;
         /**
         * Whether 'use strict' is in effect in this scope.
         * @member {boolean} Scope#isStrict
         */
        this.isStrict = isStrictScope(this, block, isMethodDefinition, scopeManager.__useDirective());

         /**
         * List of nested {@link Scope}s.
         * @member {Scope[]} Scope#childScopes
         */
        this.childScopes = [];
        if (scopeManager.__currentScope) {
            scopeManager.__currentScope.childScopes.push(this);
        }


        // RAII
        scopeManager.__currentScope = this;
        if (this.type === 'global') {
            scopeManager.globalScope = this;
            scopeManager.globalScope.implicit = {
                set: new Map(),
                variables: [],
                /**
                * List of {@link Reference}s that are left to be resolved (i.e. which
                * need to be linked to the variable they refer to).
                * @member {Reference[]} Scope#implicit#left
                */
                left: []
            };
        }

        registerScope(scopeManager, this);
    }

    Scope.prototype.__close = function __close(scopeManager) {
        var i, iz, ref, current, implicit, info;

        // Because if this is global environment, upper is null
        if (!this.dynamic || scopeManager.__isOptimistic()) {
            // static resolve
            for (i = 0, iz = this.__left.length; i < iz; ++i) {
                ref = this.__left[i];
                if (!this.__resolve(ref)) {
                    this.__delegateToUpperScope(ref);
                }
            }
        } else {
            // this is "global" / "with" / "function with eval" environment
            if (this.type === 'with') {
                for (i = 0, iz = this.__left.length; i < iz; ++i) {
                    ref = this.__left[i];
                    ref.tainted = true;
                    this.__delegateToUpperScope(ref);
                }
            } else {
                for (i = 0, iz = this.__left.length; i < iz; ++i) {
                    // notify all names are through to global
                    ref = this.__left[i];
                    current = this;
                    do {
                        current.through.push(ref);
                        current = current.upper;
                    } while (current);
                }
            }
        }

        if (this.type === 'global') {
            implicit = [];
            for (i = 0, iz = this.__left.length; i < iz; ++i) {
                ref = this.__left[i];
                if (ref.__maybeImplicitGlobal && !this.set.has(ref.identifier.name)) {
                    implicit.push(ref.__maybeImplicitGlobal);
                }
            }

            // create an implicit global variable from assignment expression
            for (i = 0, iz = implicit.length; i < iz; ++i) {
                info = implicit[i];
                this.__defineImplicit(info.pattern,
                        new Definition(
                            Variable.ImplicitGlobalVariable,
                            info.pattern,
                            info.node,
                            null,
                            null,
                            null
                        ));

            }

            this.implicit.left = this.__left;
        }

        this.__left = null;
        scopeManager.__currentScope = this.upper;
    };

    Scope.prototype.__resolve = function __resolve(ref) {
        var variable, name;
        name = ref.identifier.name;
        if (this.set.has(name)) {
            variable = this.set.get(name);
            variable.references.push(ref);
            variable.stack = variable.stack && ref.from.variableScope === this.variableScope;
            if (ref.tainted) {
                variable.tainted = true;
                this.taints.set(variable.name, true);
            }
            ref.resolved = variable;
            return true;
        }
        return false;
    };

    Scope.prototype.__delegateToUpperScope = function __delegateToUpperScope(ref) {
        if (this.upper) {
            this.upper.__left.push(ref);
        }
        this.through.push(ref);
    };

    Scope.prototype.__defineGeneric = function (name, set, variables, node, def) {
        var variable;

        variable = set.get(name);
        if (!variable) {
            variable = new Variable(name, this);
            set.set(name, variable);
            variables.push(variable);
        }

        if (def) {
            variable.defs.push(def);
        }
        if (node) {
            variable.identifiers.push(node);
        }
    };

    Scope.prototype.__defineArguments = function () {
        this.__defineGeneric(
                'arguments',
                this.set,
                this.variables,
                null,
                null);
        this.taints.set('arguments', true);
    };

    Scope.prototype.__defineImplicit = function (node, def) {
        if (node && node.type === Syntax.Identifier) {
            this.__defineGeneric(
                    node.name,
                    this.implicit.set,
                    this.implicit.variables,
                    node,
                    def);
        }
    };

    Scope.prototype.__define = function (node, def) {
        if (node && node.type === Syntax.Identifier) {
            this.__defineGeneric(
                    node.name,
                    this.set,
                    this.variables,
                    node,
                    def);
        }
    };

    Scope.prototype.__referencing = function __referencing(node, assign, writeExpr, maybeImplicitGlobal, partial) {
        var ref;
        // because Array element may be null
        if (node && node.type === Syntax.Identifier) {
            ref = new Reference(node, this, assign || Reference.READ, writeExpr, maybeImplicitGlobal, !!partial);
            this.references.push(ref);
            this.__left.push(ref);
        }
    };

    Scope.prototype.__detectEval = function __detectEval() {
        var current;
        current = this;
        this.directCallToEvalScope = true;
        do {
            current.dynamic = true;
            current = current.upper;
        } while (current);
    };

    Scope.prototype.__detectThis = function __detectThis() {
        this.thisFound = true;
    };

    Scope.prototype.__isClosed = function isClosed() {
        return this.__left === null;
    };

    // API Scope#resolve(name)
    // returns resolved reference
    Scope.prototype.resolve = function resolve(ident) {
        var ref, i, iz;
        assert(this.__isClosed(), 'Scope should be closed.');
        assert(ident.type === Syntax.Identifier, 'Target should be identifier.');
        for (i = 0, iz = this.references.length; i < iz; ++i) {
            ref = this.references[i];
            if (ref.identifier === ident) {
                return ref;
            }
        }
        return null;
    };

    // API Scope#isStatic
    // returns this scope is static
    Scope.prototype.isStatic = function isStatic() {
        return !this.dynamic;
    };

    // API Scope#isArgumentsMaterialized
    // return this scope has materialized arguments
    Scope.prototype.isArgumentsMaterialized = function isArgumentsMaterialized() {
        // TODO(Constellation)
        // We can more aggressive on this condition like this.
        //
        // function t() {
        //     // arguments of t is always hidden.
        //     function arguments() {
        //     }
        // }
        var variable;

        // This is not function scope
        if (this.type !== 'function') {
            return true;
        }

        if (!this.isStatic()) {
            return true;
        }

        variable = this.set.get('arguments');
        assert(variable, 'Always have arguments variable.');
        return variable.tainted || variable.references.length  !== 0;
    };

    // API Scope#isThisMaterialized
    // return this scope has materialized `this` reference
    Scope.prototype.isThisMaterialized = function isThisMaterialized() {
        // This is not function scope
        if (this.type !== 'function') {
            return true;
        }
        if (!this.isStatic()) {
            return true;
        }
        return this.thisFound;
    };

    Scope.prototype.isUsedName = function (name) {
        if (this.set.has(name)) {
            return true;
        }
        for (var i = 0, iz = this.through.length; i < iz; ++i) {
            if (this.through[i].identifier.name === name) {
                return true;
            }
        }
        return false;
    };

    Scope.SCOPE_NORMAL = SCOPE_NORMAL;
    Scope.SCOPE_MODULE = SCOPE_MODULE;
    Scope.SCOPE_FUNCTION_EXPRESSION_NAME = SCOPE_FUNCTION_EXPRESSION_NAME;
    Scope.SCOPE_TDZ = SCOPE_TDZ;

    module.exports = Scope;
}());
/* vim: set sw=4 ts=4 et tw=80 : */
