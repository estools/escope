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

    var WeakMap, Scope;

    WeakMap = require('es6-weak-map');
    Scope = require('./scope');

    /**
     * @class ScopeManager
     */
    function ScopeManager(options) {
        this.scopes = [];
        this.globalScope = null;
        this.__nodeToScope = new WeakMap();
        this.__currentScope = null;
        this.__options = options;
    }

    ScopeManager.prototype.__useDirective = function () {
        return this.__options.directive;
    };

    ScopeManager.prototype.__isOptimistic = function () {
        return this.__options.optimistic;
    };

    ScopeManager.prototype.__ignoreEval = function () {
        return this.__options.ignoreEval;
    };

    ScopeManager.prototype.isModule = function () {
        return this.__options.sourceType === 'module';
    };

    // Returns appropliate scope for this node.
    ScopeManager.prototype.__get = function __get(node) {
        return this.__nodeToScope.get(node);
    };

    ScopeManager.prototype.acquire = function acquire(node, inner) {
        var scopes, scope, i, iz;

        function predicate(scope) {
            if (scope.type === 'function' && scope.functionExpressionScope) {
                return false;
            }
            if (scope.type === 'TDZ') {
                return false;
            }
            return true;
        }

        scopes = this.__get(node);
        if (!scopes || scopes.length === 0) {
            return null;
        }

        // Heuristic selection from all scopes.
        // If you would like to get all scopes, please use ScopeManager#acquireAll.
        if (scopes.length === 1) {
            return scopes[0];
        }

        if (inner) {
            for (i = scopes.length - 1; i >= 0; --i) {
                scope = scopes[i];
                if (predicate(scope)) {
                    return scope;
                }
            }
        } else {
            for (i = 0, iz = scopes.length; i < iz; ++i) {
                scope = scopes[i];
                if (predicate(scope)) {
                    return scope;
                }
            }
        }

        return null;
    };

    ScopeManager.prototype.acquireAll = function acquire(node) {
        return this.__get(node);
    };

    ScopeManager.prototype.release = function release(node, inner) {
        var scopes, scope;
        scopes = this.__get(node);
        if (scopes && scopes.length) {
            scope = scopes[0].upper;
            if (!scope) {
                return null;
            }
            return this.acquire(scope.block, inner);
        }
        return null;
    };

    ScopeManager.prototype.attach = function attach() { };

    ScopeManager.prototype.detach = function detach() { };

    ScopeManager.prototype.__nestScope = function (node, isMethodDefinition) {
        return new Scope(this, node, isMethodDefinition, Scope.SCOPE_NORMAL);
    };

    ScopeManager.prototype.__nestModuleScope = function (node) {
        return new Scope(this, node, false, Scope.SCOPE_MODULE);
    };

    ScopeManager.prototype.__nestTDZScope = function (node) {
        return new Scope(this, node, false, Scope.SCOPE_TDZ);
    };

    ScopeManager.prototype.__nestFunctionExpressionNameScope = function (node, isMethodDefinition) {
        return new Scope(this, node, isMethodDefinition, Scope.SCOPE_FUNCTION_EXPRESSION_NAME);
    };

    ScopeManager.prototype.__isES6 = function () {
        return this.__options.ecmaVersion >= 6;
    };

    module.exports = ScopeManager;
}());
/* vim: set sw=4 ts=4 et tw=80 : */
