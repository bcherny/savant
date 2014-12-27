"use strict";

var defer = require('q').defer;
var readFile = require('fs').readFile;
var template = require('lodash').template;
var toArray = require('lodash').toArray;
var resolve = require('path').resolve;
exports.compoundPathFromPaths = compoundPathFromPaths;
exports.compoundPathFromPolygons = compoundPathFromPolygons;
exports.generateRandomHex = generateRandomHex;
exports.loadTemplate = loadTemplate;


function compoundPathFromPaths(paths) {
  return toArray(paths).map(function (path) {
    return path.getAttribute("d");
  }).join(" ");
}

function compoundPathFromPolygons(paths) {
  return "M " + toArray(paths).map(function (path) {
    return path.getAttribute("points");
  }).join("z M") + "z";
}

/**
 * Generates a random hex code for cache busting
 * @return {String} eg. "#ffffff"
 */
function generateRandomHex() {
  return Math.floor(Math.random() * 16777215).toString(16);
}

/**
 * Get a lodash template object from a file
 * @param  {String} filename
 * @return {Promise<Function>} Lodash template function
 */
function loadTemplate(filename) {
  var deferred = defer(), resolvedFilename = resolve(__dirname, filename);

  readFile(resolvedFilename, function (err, contents) {
    if (err) {
      return deferred.reject(err);
    }

    deferred.resolve(template(contents));
  });

  return deferred.promise;
}