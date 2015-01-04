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
        Reference,
        Variable,
        Definition,
        assert,
        util,
        objectAssign,
        estraverse,
        esrecurse;

    util = require('util');
    objectAssign = require('object-assign');
    estraverse = require('estraverse');
    esrecurse = require('esrecurse');

    Syntax = estraverse.Syntax;
    Reference = require('./reference');
    Variable = require('./variable');
    Definition = require('./definition');
    assert = require('assert');

    function traverseIdentifierInPattern(rootPattern, callback) {
        estraverse.traverse(rootPattern, {
            enter: function (pattern, parent) {
                var i, iz, element, property;

                switch (pattern.type) {
                    case Syntax.Identifier:
                        // Toplevel identifier.
                        if (parent === null) {
                            callback(pattern, true);
                        }
                        break;

                    case Syntax.SpreadElement:
                        if (pattern.argument.type === Syntax.Identifier) {
                            callback(pattern.argument, false);
                        }
                        break;

                    case Syntax.ObjectPattern:
                        for (i = 0, iz = pattern.properties.length; i < iz; ++i) {
                            property = pattern.properties[i];
                            if (property.shorthand) {
                                callback(property.key, false);
                                continue;
                            }
                            if (property.value.type === Syntax.Identifier) {
                                callback(property.value, false);
                                continue;
                            }
                        }
                        break;

                    case Syntax.ArrayPattern:
                        for (i = 0, iz = pattern.elements.length; i < iz; ++i) {
                            element = pattern.elements[i];
                            if (element && element.type === Syntax.Identifier) {
                                callback(element, false);
                            }
                        }
                        break;
                }
            }
        });
    }

    function isPattern(node) {
        var nodeType = node.type;
        return nodeType === Syntax.Identifier || nodeType === Syntax.ObjectPattern || nodeType === Syntax.ArrayPattern || nodeType === Syntax.SpreadElement;
    }

    // Importing ImportDeclaration.
    // http://people.mozilla.org/~jorendorff/es6-draft.html#sec-moduledeclarationinstantiation
    // FIXME: Now, we don't create module environment, because the context is
    // implementation dependent.

    function Importer(declaration, referencer) {
        esrecurse.Visitor.call(this, this);
        this.declaration = declaration;
        this.referencer = referencer;
    }
    util.inherits(Importer, esrecurse.Visitor);

    objectAssign(Importer.prototype, {
        visitImport: function (id, specifier) {
            var that = this;
            that.referencer.visitPattern(id, function (pattern) {
                that.referencer.currentScope().__define(pattern,
                    new Definition(
                        Variable.ImportBinding,
                        pattern,
                        specifier,
                        that.declaration,
                        null,
                        null
                        ));
            });
        },

        ImportNamespaceSpecifier: function (node) {
            if (node.id) {
                this.visitImport(node.id, node);
            }
        },

        ImportDefaultSpecifier: function (node) {
            this.visitImport(node.id, node);
        },

        ImportSpecifier: function (node) {
            if (node.name) {
                this.visitImport(node.name, node);
            } else {
                this.visitImport(node.id, node);
            }
        }
    });

    // Referencing variables and creating bindings.

    function Referencer(scopeManager) {
        esrecurse.Visitor.call(this, this);
        this.scopeManager = scopeManager;
        this.parent = null;
        this.isInnerMethodDefinition = false;
    }

    util.inherits(Referencer, esrecurse.Visitor);

    objectAssign(Referencer.prototype, {
        currentScope: function () {
            return this.scopeManager.__currentScope;
        },

        close: function (node) {
            while (this.currentScope() && node === this.currentScope().block) {
                this.currentScope().__close(this.scopeManager);
            }
        },

        pushInnerMethodDefinition: function (isInnerMethodDefinition) {
            var previous = this.isInnerMethodDefinition;
            this.isInnerMethodDefinition = isInnerMethodDefinition;
            return previous;
        },

        popInnerMethodDefinition: function (isInnerMethodDefinition) {
            this.isInnerMethodDefinition = isInnerMethodDefinition;
        },

        materializeTDZScope: function (node, iterationNode) {
            // http://people.mozilla.org/~jorendorff/es6-draft.html#sec-runtime-semantics-forin-div-ofexpressionevaluation-abstract-operation
            // TDZ scope hides the declaration's names.
            this.scopeManager.__nestTDZScope(node, iterationNode);
            this.visitVariableDeclaration(this.currentScope(), Variable.TDZ, iterationNode.left, 0);
        },

        materializeIterationScope: function (node) {
            // Generate iteration scope for upper ForIn/ForOf Statements.
            // parent node for __nestScope is only necessary to
            // distinguish MethodDefinition.
            var letOrConstDecl, that = this;
            this.scopeManager.__nestScope(node, false);
            letOrConstDecl = node.left;
            this.visitVariableDeclaration(this.currentScope(), Variable.Variable, letOrConstDecl, 0);
            this.visitPattern(letOrConstDecl.declarations[0].id, function (pattern) {
                that.currentScope().__referencing(pattern, Reference.WRITE, node.right, null, true);
            });
        },

        visitPattern: function (node, callback) {
            traverseIdentifierInPattern(node, callback);
        },

        visitFunction: function (node) {
            var i, iz, that = this;
            // FunctionDeclaration name is defined in upper scope
            // NOTE: Not referring variableScope. It is intended.
            // Since
            //  in ES5, FunctionDeclaration should be in FunctionBody.
            //  in ES6, FunctionDeclaration should be block scoped.
            if (node.type === Syntax.FunctionDeclaration) {
                // id is defined in upper scope
                this.currentScope().__define(node.id,
                        new Definition(
                            Variable.FunctionName,
                            node.id,
                            node,
                            null,
                            null,
                            null
                        ));
            }

            // Consider this function is in the MethodDefinition.
            this.scopeManager.__nestScope(node, this.isInnerMethodDefinition);

            for (i = 0, iz = node.params.length; i < iz; ++i) {
                this.visitPattern(node.params[i], function (pattern) {
                    that.currentScope().__define(pattern,
                        new Definition(
                            Variable.Parameter,
                            pattern,
                            node,
                            null,
                            i,
                            null
                        ));
                });
            }

            // Skip BlockStatement to prevent creating BlockStatement scope.
            if (node.body.type === Syntax.BlockStatement) {
                this.visitChildren(node.body);
            } else {
                this.visit(node.body);
            }

            this.close(node);
        },

        visitClass: function (node) {
            if (node.type === Syntax.ClassDeclaration) {
                this.currentScope().__define(node.id,
                        new Definition(
                            Variable.ClassName,
                            node.id,
                            node,
                            null,
                            null,
                            null
                        ));
            }

            // FIXME: Maybe consider TDZ.
            this.visit(node.superClass);

            this.scopeManager.__nestScope(node);

            if (node.id) {
                this.currentScope().__define(node.id,
                        new Definition(
                            Variable.ClassName,
                            node.id,
                            node
                        ));
            }
            this.visit(node.body);

            this.close(node);
        },

        visitProperty: function (node) {
            var previous, isMethodDefinition;
            if (node.computed) {
                this.visit(node.key);
            }

            isMethodDefinition = node.type === Syntax.MethodDefinition || node.method;
            if (isMethodDefinition) {
                previous = this.pushInnerMethodDefinition(true);
            }
            this.visit(node.value);
            if (isMethodDefinition) {
                this.popInnerMethodDefinition(previous);
            }
        },

        visitForIn: function (node) {
            var that = this;
            if (node.left.type === Syntax.VariableDeclaration && node.left.kind !== 'var') {
                this.materializeTDZScope(node.right, node);
                this.visit(node.right);
                this.close(node.right);

                this.materializeIterationScope(node);
                this.visit(node.body);
                this.close(node);
            } else {
                if (node.left.type === Syntax.VariableDeclaration) {
                    this.visit(node.left);
                    this.visitPattern(node.left.declarations[0].id, function (pattern) {
                        that.currentScope().__referencing(pattern, Reference.WRITE, node.right, null, true);
                    });
                } else {
                    if (!isPattern(node.left)) {
                        this.visit(node.left);
                    }
                    this.visitPattern(node.left, function (pattern) {
                        var maybeImplicitGlobal = null;
                        if (!that.currentScope().isStrict) {
                            maybeImplicitGlobal = {
                                pattern: pattern,
                                node: node
                            };
                        }
                        that.currentScope().__referencing(pattern, Reference.WRITE, node.right, maybeImplicitGlobal, true);
                    });
                }
                this.visit(node.right);
                this.visit(node.body);
            }
        },

        visitVariableDeclaration: function (variableTargetScope, type, node, index) {
            var decl, init, that = this;

            decl = node.declarations[index];
            init = decl.init;
            // FIXME: Don't consider initializer with complex patterns.
            // Such as,
            // var [a, b, c = 20] = array;
            this.visitPattern(decl.id, function (pattern, toplevel) {
                variableTargetScope.__define(pattern,
                    new Definition(
                        type,
                        pattern,
                        decl,
                        node,
                        index,
                        node.kind
                    ));

                if (init) {
                    that.currentScope().__referencing(pattern, Reference.WRITE, init, null, !toplevel);
                }
            });
        },

        AssignmentExpression: function (node) {
            var that = this;
            if (isPattern(node.left)) {
                if (node.operator === '=') {
                    this.visitPattern(node.left, function (pattern, toplevel) {
                        var maybeImplicitGlobal = null;
                        if (!that.currentScope().isStrict) {
                            maybeImplicitGlobal = {
                                pattern: pattern,
                                node: node
                            };
                        }
                        that.currentScope().__referencing(pattern, Reference.WRITE, node.right, maybeImplicitGlobal, !toplevel);
                    });
                } else {
                    that.currentScope().__referencing(node.left, Reference.RW, node.right);
                }
            } else {
                this.visit(node.left);
            }
            this.visit(node.right);
        },

        CatchClause: function (node) {
            var that = this;
            this.scopeManager.__nestScope(node);

            this.visitPattern(node.param, function (pattern) {
                that.currentScope().__define(pattern,
                    new Definition(
                        Variable.CatchClause,
                        node.param,
                        node,
                        null,
                        null,
                        null
                    ));
            });
            this.visit(node.body);

            this.close(node);
        },

        Program: function (node) {
            this.scopeManager.__nestScope(node);

            if (this.scopeManager.__isES6() && this.scopeManager.isModule()) {
                this.scopeManager.__nestModuleScope(node);
            }

            this.visitChildren(node);
            this.close(node);
        },

        Identifier: function (node) {
            this.currentScope().__referencing(node);
        },

        UpdateExpression: function (node) {
            if (isPattern(node)) {
                this.currentScope().__referencing(node.argument, Reference.RW, null);
            } else {
                this.visitChildren(node);
            }
        },

        MemberExpression: function (node) {
            this.visit(node.object);
            if (node.computed) {
                this.visit(node.property);
            }
        },

        Property: function (node) {
            this.visitProperty(node);
        },

        MethodDefinition: function (node) {
            this.visitProperty(node);
        },

        BreakStatement: function () {},

        ContinueStatement: function () {},

        LabelledStatement: function () {},

        ForStatement: function (node) {
            // Create ForStatement declaration.
            // NOTE: In ES6, ForStatement dynamically generates
            // per iteration environment. However, escope is
            // a static analyzer, we only generate one scope for ForStatement.
            if (node.init && node.init.type === Syntax.VariableDeclaration && node.init.kind !== 'var') {
                this.scopeManager.__nestScope(node);
            }

            this.visitChildren(node);

            this.close(node);
        },

        ClassExpression: function (node) {
            this.visitClass(node);
        },

        ClassDeclaration: function (node) {
            this.visitClass(node);
        },

        CallExpression: function (node) {
            // Check this is direct call to eval
            if (!this.scopeManager.__ignoreEval() && node.callee.type === Syntax.Identifier && node.callee.name === 'eval') {
                // NOTE: This should be `variableScope`. Since direct eval call always creates Lexical environment and
                // let / const should be enclosed into it. Only VariableDeclaration affects on the caller's environment.
                this.currentScope().variableScope.__detectEval();
            }
            this.visitChildren(node);
        },

        BlockStatement: function (node) {
            if (this.scopeManager.__isES6()) {
                this.scopeManager.__nestScope(node);
            }

            this.visitChildren(node);

            this.close(node);
        },

        ThisExpression: function () {
            this.currentScope().variableScope.__detectThis();
        },

        WithStatement: function (node) {
            this.visit(node.object);
            // Then nest scope for WithStatement.
            this.scopeManager.__nestScope(node);

            this.visit(node.body);

            this.close(node);
        },

        VariableDeclaration: function (node) {
            var variableTargetScope, i, iz, decl;
            variableTargetScope = (node.kind === 'var') ? this.currentScope().variableScope : this.currentScope();
            for (i = 0, iz = node.declarations.length; i < iz; ++i) {
                decl = node.declarations[i];
                this.visitVariableDeclaration(variableTargetScope, Variable.Variable, node, i);
                if (decl.init) {
                    this.visit(decl.init);
                }
            }
        },

        // sec 13.11.8
        SwitchStatement: function (node) {
            var i, iz;

            this.visit(node.discriminant);

            if (this.scopeManager.__isES6()) {
                this.scopeManager.__nestScope(node);
            }

            for (i = 0, iz = node.cases.length; i < iz; ++i) {
                this.visit(node.cases[i]);
            }

            this.close(node);
        },

        FunctionDeclaration: function (node) {
            this.visitFunction(node);
        },

        FunctionExpression: function (node) {
            this.visitFunction(node);
        },

        ForOfStatement: function (node) {
            this.visitForIn(node);
        },

        ForInStatement: function (node) {
            this.visitForIn(node);
        },

        ArrowFunctionExpression: function (node) {
            this.visitFunction(node);
        },

        ImportDeclaration: function (node) {
            var importer;

            assert(this.scopeManager.__isES6() && this.scopeManager.isModule(), 'ImportDeclaration should appear when the mode is ES6 and in the module context.');

            importer = new Importer(node, this);
            importer.visit(node);
        },

        ExportDeclaration: function (node) {
            if (node.source) {
                return;
            }
            if (node.declaration) {
                this.visit(node.declaration);
                return;
            }

            this.visitChildren(node);
        },

        ExportSpecifier: function (node) {
            this.visit(node.id);
        }
    });

    module.exports = Referencer;
}());
/* vim: set sw=4 ts=4 et tw=80 : */
