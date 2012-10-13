/*
  Copyright (C) 2012 Yusuke Suzuki <utatane.tea@gmail.com>

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

/*jslint bitwise:true */
/*global escope:true, exports:true, define:true*/
(function (factory, global) {
    'use strict';

    function namespace(str, obj) {
        var i, iz, names, name;
        names = str.split('.');
        for (i = 0, iz = names.length; i < iz; ++i) {
            name = names[i];
            if (obj.hasOwnProperty(name)) {
                obj = obj[name];
            } else {
                obj = (obj[name] = {});
            }
        }
        return obj;
    }

    // Universal Module Definition (UMD) to support AMD, CommonJS/Node.js,
    // and plain browser loading,
    if (typeof define === 'function' && define.amd) {
        define('escope', ['exports'], factory);
    } else if (typeof exports !== 'undefined') {
        factory(exports);
    } else {
        factory(namespace('escope', global));
    }
}(function (exports) {
    'use strict';

    var estraverse,
        Syntax,
        VERSION,
        hasOwnProperty,
        scope,
        scopes;

    VERSION = '0.0.7-dev';

    estraverse = require('estraverse');
    Syntax = estraverse.Syntax;

    function assert(cond, text) {
        if (!cond) {
            throw new Error(text);
        }
    }

    function unreachable() {
        throw new Error('Unreachable point. logically broken.');
    }

    hasOwnProperty = (function () {
        var pred = Object.prototype.hasOwnProperty;
        return function hasOwnProperty(obj, name) {
            return pred.call(obj, name);
        };
    }());

    function Reference(ident, scope, flag, writeExpr) {
        this.identifier = ident;
        this.from = scope;
        this.tainted = false;
        this.resolved = null;
        this.flag = flag;
        if (this.isWrite()) {
            this.writeExpr = writeExpr;
        }
    }

    Reference.READ = 0x1;
    Reference.WRITE = 0x2;
    Reference.RW = 0x3;

    Reference.prototype.isStatic = function isStatic() {
        return !this.tainted && this.resolved && this.resolved.scope.isStatic();
    };

    Reference.prototype.isWrite = function isWrite() {
        return this.flag & Reference.WRITE;
    };

    Reference.prototype.isRead = function isRead() {
        return this.flag & Reference.READ;
    };

    Reference.prototype.isReadOnly = function isReadOnly() {
        return this.flag === Reference.READ;
    };

    Reference.prototype.isWriteOnly = function isWriteOnly() {
        return this.flag === Reference.WRITE;
    };

    Reference.prototype.isReadWrite = function isReadWrite() {
        return this.flag === Reference.RW;
    };

    function Variable(name, scope) {
        this.name = name;
        this.identifiers = [];
        this.references = [];

        this.defs = [];

        this.tainted = false;
        this.stack = true;
        this.scope = scope;
    }

    Variable.CatchClause = 'CatchClause';
    Variable.Parameter = 'Parameter';
    Variable.FunctionName = 'FunctionName';
    Variable.Variable = 'Variable';

    function Scope(block, opt) {
        var variable;

        this.type =
            (block.type === Syntax.CatchClause) ? 'catch' :
            (block.type === Syntax.WithStatement) ? 'with' :
            (block.type === Syntax.Program) ? 'global' : 'function';
        this.set = {};
        this.tip = 'a';
        this.dynamic = this.type === 'global' || this.type === 'with';
        this.block = block;
        this.through = [];
        this.variables = [];
        this.references = [];
        this.taints = {};
        this.left = [];
        this.variableScope =
            (this.type === 'global' || this.type === 'function') ? this : scope.variableScope;
        this.functionExpressionScope = false;
        this.directCallToEvalScope = false;
        this.thisFound = false;

        if (opt.naming) {
            this.__define(block.id, {
                type: Variable.FunctionName,
                name: block.id,
                node: block
            });
            this.functionExpressionScope = true;
        } else {
            if (this.type === 'function') {
                variable = new Variable('arguments', this);
                this.taints['arguments'] = true;
                this.set['arguments'] = variable;
                this.variables.push(variable);
            }

            if (block.type === Syntax.FunctionExpression && block.id) {
                new Scope(block, { naming: true });
            }
        }

        // RAII
        this.upper = scope;
        scope = this;
        scopes.push(this);
    }

    Scope.prototype.__close = function __close() {
        var i, iz, ref, set, current;

        // Because if this is global environment, upper is null
        if (!this.dynamic) {
            // static resolve
            for (i = 0, iz = this.left.length; i < iz; ++i) {
                ref = this.left[i];
                if (!this.__resolve(ref)) {
                    this.__delegateToUpperScope(ref);
                }
            }
        } else {
            // this is global / with / function with eval environment
            if (this.type === 'with') {
                for (i = 0, iz = this.left.length; i < iz; ++i) {
                    ref = this.left[i];
                    ref.tainted = true;
                    this.__delegateToUpperScope(ref);
                }
            } else {
                for (i = 0, iz = this.left.length; i < iz; ++i) {
                    // notify all names are through to global
                    ref = this.left[i];
                    current = this;
                    do {
                        current.through.push(ref);
                        current = current.upper;
                    } while (current);
                }
            }
        }
        this.left = null;
        scope = this.upper;
    };

    Scope.prototype.__resolve = function __resolve(ref) {
        var i, iz, variable, name;
        name = ref.identifier.name;
        if (hasOwnProperty(this.set, name)) {
            variable = this.set[name];
            variable.references.push(ref);
            variable.stack = variable.stack && ref.from.variableScope === this.variableScope;
            if (ref.tainted) {
                variable.tainted = true;
                this.taints[variable.name] = true;
            }
            ref.resolved = variable;
            return true;
        }
        return false;
    };

    Scope.prototype.__delegateToUpperScope = function __delegateToUpperScope(ref) {
        assert(this.upper, 'upper should be here');
        this.upper.left.push(ref);
        this.through.push(ref);
    };

    Scope.prototype.__define = function __define(node, info) {
        var name, variable;
        if (node && node.type === Syntax.Identifier) {
            name = node.name;
            if (!hasOwnProperty(this.set, name)) {
                variable = new Variable(name, this);
                variable.identifiers.push(node);
                variable.defs.push(info);
                this.set[name] = variable;
                this.variables.push(variable);
            } else {
                variable = this.set[name];
                variable.identifiers.push(node);
                variable.defs.push(info);
            }
        }
    };

    Scope.prototype.__referencing = function __referencing(node, assign, writeExpr) {
        var ref;
        // because Array element may be null
        if (node && node.type === Syntax.Identifier) {
            ref = new Reference(node, this, assign || Reference.READ, writeExpr);
            this.references.push(ref);
            this.left.push(ref);
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
        return this.left === null;
    };

    // API Scope#resolve(name)
    // returns resolved reference
    Scope.prototype.resolve = function resolve(ident) {
        var ref, i, iz;
        assert(this.__isClosed(), "scope should be closed");
        assert(ident.type === Syntax.Identifier, "target should be identifier");
        for (i = 0, iz = this.references.length; i < iz; ++i) {
            ref = this.references[i];
            if (ref.identifier === ident) {
                return ref;
            }
        }
        unreachable();
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

        variable = this.set['arguments'];
        assert(variable, 'always have arguments variable');
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

    Scope.name = '__$escope$__';

    Scope.prototype.attach = function attach() {
        if (!this.functionExpressionScope) {
            this.block.__$escope$__ = this;
        }
    };

    Scope.prototype.detach = function detach() {
        if (!this.functionExpressionScope) {
            delete this.block.__$escope$__;
        }
    };

    function ScopeManager(scopes) {
        this.scopes = scopes;
        this.attached = false;
    }

    // Returns appropliate scope for this node
    ScopeManager.prototype.__get = function __get(node) {
        var i, iz, scope;
        if (this.attached) {
            return node.__$escope$__ || null;
        }
        if (Scope.isRequired(node)) {
            for (i = 0, iz = this.scopes.length; i < iz; ++i) {
                scope = this.scopes[i];
                if (!scope.functionExpressionScope) {
                    if (scope.block === node) {
                        return scope;
                    }
                }
            }
        }
        return null;
    };

    ScopeManager.prototype.acquire = function acquire(node) {
        return this.__get(node);
    };

    ScopeManager.prototype.release = function release(node) {
        var scope = this.__get(node);
        if (scope) {
            scope = scope.upper;
            while (scope) {
                if (!scope.functionExpressionScope) {
                    return scope;
                }
                scope = scope.upper;
            }
        }
        return null;
    };

    ScopeManager.prototype.attach = function attach() {
        var i, iz, scope;
        for (i = 0, iz = this.scopes.length; i < iz; ++i) {
            this.scopes[i].attach();
        }
        this.attached = true;
    };

    ScopeManager.prototype.detach = function detach() {
        var i, iz, scope;
        for (i = 0, iz = this.scopes.length; i < iz; ++i) {
            this.scopes[i].detach();
        }
        this.attached = false;
    };

    Scope.isRequired = function isRequired(node) {
        return node.type === Syntax.Program || node.type === Syntax.FunctionExpression || node.type === Syntax.FunctionDeclaration || node.type === Syntax.WithStatement || node.type === Syntax.CatchClause;
    };

    function analyze(tree) {
        scopes = [];
        scope = null;

        // attach scope and collect / resolve names
        estraverse.traverse(tree, {
            enter: function enter(node, parent) {
                var i, iz, decl;
                if (Scope.isRequired(node)) {
                    new Scope(node, {});
                }

                switch (node.type) {
                case Syntax.AssignmentExpression:
                    scope.__referencing(node.left, Reference.WRITE, node.right);
                    scope.__referencing(node.right);
                    break;

                case Syntax.ArrayExpression:
                    for (i = 0, iz = node.elements.length; i < iz; ++i) {
                        scope.__referencing(node.elements[i]);
                    }
                    break;

                case Syntax.BlockStatement:
                    break;

                case Syntax.BinaryExpression:
                    scope.__referencing(node.left);
                    scope.__referencing(node.right);
                    break;

                case Syntax.BreakStatement:
                    break;

                case Syntax.CallExpression:
                    scope.__referencing(node.callee);
                    for (i = 0, iz = node['arguments'].length; i < iz; ++i) {
                        scope.__referencing(node['arguments'][i]);
                    }

                    // check this is direct call to eval
                    if (node.callee.type === Syntax.Identifier && node.callee.name === 'eval') {
                        scope.variableScope.__detectEval();
                    }
                    break;

                case Syntax.CatchClause:
                    scope.__define(node.param, {
                        type: Variable.CatchClause,
                        name: node.param,
                        node: node
                    });
                    break;

                case Syntax.ConditionalExpression:
                    scope.__referencing(node.test);
                    scope.__referencing(node.consequent);
                    scope.__referencing(node.alternate);
                    break;

                case Syntax.ContinueStatement:
                    break;

                case Syntax.DirectiveStatement:
                    break;

                case Syntax.DoWhileStatement:
                    scope.__referencing(node.test);
                    break;

                case Syntax.DebuggerStatement:
                    break;

                case Syntax.EmptyStatement:
                    break;

                case Syntax.ExpressionStatement:
                    scope.__referencing(node.expression);
                    break;

                case Syntax.ForStatement:
                    scope.__referencing(node.init);
                    scope.__referencing(node.test);
                    scope.__referencing(node.update);
                    break;

                case Syntax.ForInStatement:
                    if (node.left.type === Syntax.VariableDeclaration) {
                        scope.__referencing(node.left.declarations[0].id, Reference.WRITE, null);
                    } else {
                        scope.__referencing(node.left, Reference.WRITE, null);
                    }
                    scope.__referencing(node.right);
                    break;

                case Syntax.FunctionDeclaration:
                    // FunctionDeclaration name is defined in upper scope
                    scope.upper.__define(node.id, {
                        type: Variable.FunctionName,
                        name: node.id,
                        node: node
                    });
                    for (i = 0, iz = node.params.length; i < iz; ++i) {
                        scope.__define(node.params[i], {
                            type: Variable.Parameter,
                            name: node.params[i],
                            node: node,
                            index: i
                        });
                    }
                    break;

                case Syntax.FunctionExpression:
                    // id is defined in upper scope
                    for (i = 0, iz = node.params.length; i < iz; ++i) {
                        scope.__define(node.params[i], {
                            type: Variable.Parameter,
                            name: node.params[i],
                            node: node,
                            index: i
                        });
                    }
                    break;

                case Syntax.Identifier:
                    break;

                case Syntax.IfStatement:
                    scope.__referencing(node.test);
                    break;

                case Syntax.Literal:
                    break;

                case Syntax.LabeledStatement:
                    break;

                case Syntax.LogicalExpression:
                    scope.__referencing(node.left);
                    scope.__referencing(node.right);
                    break;

                case Syntax.MemberExpression:
                    scope.__referencing(node.object);
                    if (node.computed) {
                        scope.__referencing(node.property);
                    }
                    break;

                case Syntax.NewExpression:
                    scope.__referencing(node.callee);
                    for (i = 0, iz = node['arguments'].length; i < iz; ++i) {
                        scope.__referencing(node['arguments'][i]);
                    }
                    break;

                case Syntax.ObjectExpression:
                    break;

                case Syntax.Program:
                    break;

                case Syntax.Property:
                    scope.__referencing(node.value);
                    break;

                case Syntax.ReturnStatement:
                    scope.__referencing(node.argument);
                    break;

                case Syntax.SequenceExpression:
                    for (i = 0, iz = node.expressions.length; i < iz; ++i) {
                        scope.__referencing(node.expressions[i]);
                    }
                    break;

                case Syntax.SwitchStatement:
                    scope.__referencing(node.discriminant);
                    break;

                case Syntax.SwitchCase:
                    scope.__referencing(node.test);
                    break;

                case Syntax.ThisExpression:
                    scope.variableScope.__detectThis();
                    break;

                case Syntax.ThrowStatement:
                    scope.__referencing(node.argument);
                    break;

                case Syntax.TryStatement:
                    break;

                case Syntax.UnaryExpression:
                    scope.__referencing(node.argument);
                    break;

                case Syntax.UpdateExpression:
                    scope.__referencing(node.argument, Reference.RW, null);
                    break;

                case Syntax.VariableDeclaration:
                    for (i = 0, iz = node.declarations.length; i < iz; ++i) {
                        decl = node.declarations[i];
                        scope.variableScope.__define(decl.id, {
                            type: Variable.Variable,
                            name: decl.id,
                            node: decl,
                            index: i,
                            parent: node
                        });
                        if (decl.init) {
                            // initializer is found
                            scope.__referencing(decl.id, Reference.WRITE, decl.init);
                            scope.__referencing(decl.init);
                        }
                    }
                    break;

                case Syntax.VariableDeclarator:
                    break;

                case Syntax.WhileStatement:
                    scope.__referencing(node.test);
                    break;

                case Syntax.WithStatement:
                    scope.__referencing(node.object);
                    break;
                }
            },

            leave: function leave(node) {
                while (scope && node === scope.block) {
                    scope.__close();
                }
            }
        });
        assert(scope === null);

        return new ScopeManager(scopes);
    }

    exports.version = VERSION;
    exports.Reference = Reference;
    exports.Variable = Variable;
    exports.Scope = Scope;
    exports.ScopeManager = ScopeManager;
    exports.analyze = analyze;
}, this));
/* vim: set sw=4 ts=4 et tw=80 : */
