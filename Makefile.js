/**
 * @fileoverview Build file
 * @author nzakas
 * @copyright jQuery Foundation and other contributors, https://jquery.org/
 * MIT License
 */
/* global echo, exec, exit, set, target */

"use strict";

/* eslint no-console: 0*/
//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

require("shelljs/make");
set("+e");

const checker = require("npm-license");

//------------------------------------------------------------------------------
// Settings
//------------------------------------------------------------------------------

const OPEN_SOURCE_LICENSES = [
    /MIT/, /BSD/, /Apache/, /ISC/, /WTF/, /Public Domain/
];

//------------------------------------------------------------------------------
// Data
//------------------------------------------------------------------------------

const NODE = "node",
    NODE_MODULES = "./node_modules/",

    // Utilities - intentional extra space at the end of each string
    MOCHA = NODE_MODULES + "mocha/bin/_mocha ",
    ESLINT = `${NODE} ${NODE_MODULES}/eslint/bin/eslint `,
    ISTANBUL = `${NODE} ${NODE_MODULES}/istanbul/lib/cli.js `,

    // Files
    MAKEFILE = "./Makefile.js",
    JS_FILES = "src/**/*.js",
    TEST_FILES = "test/*.js";

//------------------------------------------------------------------------------
// Tasks
//------------------------------------------------------------------------------

target.all = function() {
    target.test();
};

target.lint = function() {
    var errors = 0,
        lastReturn;

    echo("Validating Makefile.js");
    lastReturn = exec(ESLINT + MAKEFILE);
    if (lastReturn.code !== 0) {
        errors++;
    }

    echo("Validating JavaScript files");
    lastReturn = exec(ESLINT + JS_FILES);
    if (lastReturn.code !== 0) {
        errors++;
    }

    echo("Validating JavaScript test files");
    lastReturn = exec(ESLINT + TEST_FILES);
    if (lastReturn.code !== 0) {
        errors++;
    }

    if (errors) {
        exit(1);
    }
};

target.test = function() {
    target.lint();

    var errors = 0,
        lastReturn;

    lastReturn = exec(`${ISTANBUL} cover ${MOCHA} -- -R progress -c ${TEST_FILES}`);

    if (lastReturn.code !== 0) {
        errors++;
    }

    if (errors) {
        exit(1);
    }

    target.checkLicenses();
};

target.checkLicenses = function() {

    /**
     * Returns true if the given dependency's licenses are all permissable for use in OSS
     * @param  {object}  dependency object containing the name and licenses of the given dependency
     * @returns {boolean} is permissable dependency
     */
    function isPermissible(dependency) {
        var licenses = dependency.licenses;

        if (Array.isArray(licenses)) {
            return licenses.some(function(license) {
                return isPermissible({
                    name: dependency.name,
                    licenses: license
                });
            });
        }

        return OPEN_SOURCE_LICENSES.some(function(license) {
            return license.test(licenses);
        });
    }

    echo("Validating licenses");

    checker.init({
        start: __dirname
    }, function(deps) {
        var impermissible = Object.keys(deps).map(function(dependency) {
            return {
                name: dependency,
                licenses: deps[dependency].licenses
            };
        }).filter(function(dependency) {
            return !isPermissible(dependency);
        });

        if (impermissible.length) {
            impermissible.forEach(function(dependency) {
                console.error("%s license for %s is impermissible.",
                    dependency.licenses,
                    dependency.name
                );
            });
            exit(1);
        }
    });
};
