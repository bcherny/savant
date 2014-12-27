"use strict";

var _taggedTemplateLiteral = function (strings, raw) {
  return Object.defineProperties(strings, {
    raw: {
      value: raw
    }
  });
};

var exec = require('child_process').exec;
var readFile = require('fs').readFile;
var writeFile = require('fs').writeFile;
var basename = require('path').basename;
var resolve = require('path').resolve;
var extend = require('lodash').extend;
var first = require('lodash').first;
var forEach = require('lodash').forEach;
var all = require('q').all;
var defer = require('q').defer;
var when = require('q').when;
var DOMParser = require('xmldom').DOMParser;
var glob = require('glob');

var SvgPath = require('SvgPath');

var defaults = require('../defaults');

var util = require('./util');

exports.compile = compile;


// regexes
var rgxUnicode = /([a-f][a-f\d]{3,4})/i, rgxName = /-(.+).svg/, rgxAcronym = /\b([\w\d])/ig;

function compile(args) {
  return readPackageJson().then(function (config) {
    try {
      var _ret = (function () {
        // set options (extend defaults.json with package.json#font with CLI args)
        var font = extend(defaults, config.font, args), fontHeight = font.ascent - font.descent

        // template data
        , data = {
          font: font,
          glyphs: [],
          fontHeight: fontHeight,
          fontFamily: config.name,
          prefix: args.prefix || getPrefix(config.name),
          hex: util.generateRandomHex()
        };

        console.log("Scaling images...");

        return {
          v: prepare(args.input_dir, fontHeight).then(function (glyphs) {
            return generate(config, extend(data, {
              glyphs: glyphs
            }));
          })
        };
      })();

      if (typeof _ret === "object") return _ret.v;
    } catch (err) {
      console.log(err);
    }
  });
}

function prepare(inputDir, fontHeight) {
  // Generate normalized glyphs
  return globPromise("" + inputDir + "/*.svg").then(function (files) {
    console.info("Found " + files.length + " files");

    return all(files.map(function (file) {
      // get unicode and glyph name from file name
      var name = file.match(rgxName)[0], unicode = file.match(rgxUnicode)[0];

      // check for unicode
      if (!unicode) throw new (Error(_taggedTemplateLiteral(["Expected ", " to be in the format 'xxxx-icon-name.svg'"], ["Expected ", " to be in the format 'xxxx-icon-name.svg'"]), file))();

      // normalize glyph
      return readFilePromise(file).then(function (contents) {
        var glyph = parse(contents.toString(), file), ratio = fontHeight / glyph.height;

        return {
          css: basename(name || unicode, ".svg").replace(/-/g, " ").trim(),
          unicode: "&#x" + unicode + ";",
          width: glyph.width,
          d: new SvgPath(glyph.d).scale(ratio, -ratio).toString()
        };
      });
    }));
  });
}

function generate(config, data) {
  // load templates
  loadTemplates().spread(function (svgTemplate, cssTemplate, sassTemplate, htmlTemplate) {
    var svg = "" + data.font.output_dir + "/" + config.name + ".svg", ttf = "" + data.font.output_dir + "/" + config.name + ".ttf", tasks = {
      "Generating SVG": function (_) {
        return writeFilePromise(svg, svgTemplate(data));
      },
      "Generating TTF": function (_) {
        return execPromise(resolve(__dirname, "../node_modules/.bin/svg2ttf " + svg + " " + ttf));
      },
      "Generating WOFF": function (_) {
        return execPromise(resolve(__dirname, "../node_modules/.bin/ttf2woff " + ttf + " " + data.font.output_dir + "/" + config.name + ".woff"));
      },
      "Generating EOT": function (_) {
        return execPromise(resolve(__dirname, "../node_modules/.bin/ttf2eot " + ttf + " " + data.font.output_dir + "/" + config.name + ".eot"));
      },
      "Generating CSS": function (_) {
        return writeFilePromise(resolve(process.cwd(), "./dist/font.css"), cssTemplate(data));
      },
      "Generating SASS": function (_) {
        return writeFilePromise(resolve(process.cwd(), "./dist/font.scss"), sassTemplate(data));
      },
      "Generating HTML spec": function (_) {
        return writeFilePromise(resolve(process.cwd(), "./dist/font.html"), htmlTemplate(data));
      },
      "Done!": function (_) {
        return when();
      }
    };

    forEach(tasks, function (fn, message) {
      fn().then(function (_) {
        console.log(message);
      }, function (err) {
        console.log("err", err.stack);
      });
    });
  });
}

function parse(data, filename) {
  var doc = new DOMParser().parseFromString(data, "application/xml"), svg = doc.getElementsByTagName("svg")[0], height = parseFloat(svg.getAttribute("height"), 10), width = parseFloat(svg.getAttribute("width"), 10);

  // check for width and height
  if (isNaN(height)) throw new Error("Missing height attribute in " + filename);

  if (isNaN(width)) throw new Error("Missing width attribute in " + filename);

  // get elements
  var paths = svg.getElementsByTagName("path"), polygons = svg.getElementsByTagName("polygon");

  // check for paths/polygons
  if (!paths.length && !polygons.length) throw new Error("No path or polygon data found in " + filename);

  return {
    height: height,
    width: width,
    d: "" + util.compoundPathFromPaths(paths) + " " + util.compoundPathFromPolygons(polygons)
  };
}





/*
 * Utilities
 */

function loadTemplates() {
  return all([util.loadTemplate("../templates/font.svg"), util.loadTemplate("../templates/font.css"), util.loadTemplate("../templates/font.scss"), util.loadTemplate("../templates/font.html")]);
}

function getPrefix(name) {
  return name.match(rgxAcronym).join("");
}

function execPromise(command) {
  var deferred = defer();

  exec(command, function (err, stdout, stderr) {
    if (err) deferred.reject(err);

    deferred.resolve(stdout);
  });

  return deferred.promise;
}

function globPromise(path, options) {
  var deferred = defer();

  glob(path, options, function (err, files) {
    if (err) deferred.reject(err);

    deferred.resolve(files);
  });

  return deferred.promise;
}

function readFilePromise(filename) {
  var deferred = defer();

  readFile(filename, function (err, contents) {
    if (err) deferred.reject(err);

    deferred.resolve(contents);
  });

  return deferred.promise;
}

function writeFilePromise(filename, data, charset) {
  if (charset === undefined) charset = "utf8";


  var deferred = defer();

  console.log("write", filename, data);

  writeFile(filename, data, charset, function (err) {
    if (err) return deferred.reject(err);

    deferred.resolve();
  });

  return deferred.promise;
}


function readPackageJson() {
  return readFilePromise(resolve("./package.json")).then(function (contents) {
    return JSON.parse(contents);
  });
}