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
var dirname = require('path').dirname;
var normalize = require('path').normalize;
var resolve = require('path').resolve;
var extend = require('lodash').extend;
var first = require('lodash').first;
var forEach = require('lodash').forEach;
var last = require('lodash').last;
var map = require('lodash').map;
var merge = require('lodash').merge;
var all = require('q').all;
var defer = require('q').defer;
var when = require('q').when;
var DOMParser = require('xmldom').DOMParser;
var glob = require('glob');

var mkdirp = require('mkdirp');

var SvgPath = require('SvgPath');

var defaults = require('../defaults');

var compoundPathFromPaths = require('./util').compoundPathFromPaths;
var compoundPathFromPolygons = require('./util').compoundPathFromPolygons;
var generateRandomHex = require('./util').generateRandomHex;
var loadTemplate = require('./util').loadTemplate;
var shoot = require('./screenshot').shoot;
exports.compile = compile;


// binaries
var svg2ttfBin = "../node_modules/.bin/svg2ttf", ttf2woffBin = "../node_modules/.bin/ttf2woff", ttf2eotBin = "../node_modules/.bin/ttf2eot";

// regexes
var rgxUnicode = /([a-f\d]{3,4})/i, rgxName = /-(.+).svg/, rgxAcronym = /\b([\w\d])/ig;

function compile(options) {
  var packageJson = {};

  // ensure that input and output dirs are defined
  if (!options.input_dir) throw new TypeError("svgs-to-fonts#compile expects an options hash with an \"input_dir\" property");

  if (!options.output_dir) throw new TypeError("svgs-to-fonts#compile expects an options hash with an \"output_dir\" property");

  // normalize paths
  options.input_dir = normalizePath(options.input_dir);
  options.output_dir = normalizePath(options.output_dir);

  console.log("Compiling from " + options.input_dir + " to " + options.output_dir + "...");

  return readPackageJson().then(function (contents) {
    packageJson = contents;
  })["catch"](function (err) {
    if (err.code == "ENOENT") {
      console.warn("No package.json found in " + process.cwd());
    }
  })["finally"](function () {
    // get folder name
    var nameFromPath = last(normalizePath(process.cwd()).slice(0, -1).split("/"));

    // set options (extend defaults.json with package.json#font with CLI args)
    var font = merge(defaults, packageJson.font, { name: nameFromPath }, { name: packageJson.name }, { name: options.name }), fontHeight = font.ascent - font.descent

    // template data
    , data = {
      font: font,
      glyphs: [],
      fontHeight: fontHeight,
      fontFamily: font.name,
      prefix: options.prefix || getPrefix(font.name),
      hex: generateRandomHex()
    };

    console.log("Generating font \"" + font.name + "\"...");

    return prepare(options.input_dir, fontHeight).then(function (glyphs) {
      return generate(font, options, extend(data, {
        glyphs: glyphs
      }));
    });
  });
}

function prepare(inputDir, fontHeight) {
  // Generate normalized glyphs
  return globPromise("" + inputDir + "/*.svg").then(function (files) {
    console.info("Found " + files.length + " files in " + inputDir);

    return all(files.map(function (file) {
      // get unicode and glyph name from file name
      var fileBasename = basename(file), name = fileBasename.match(rgxName)[0], unicode = fileBasename.match(rgxUnicode)[0];

      // check for unicode
      if (!unicode) throw new (Error(_taggedTemplateLiteral(["Expected ", " to be in the format 'xxxx-icon-name.svg'"], ["Expected ", " to be in the format 'xxxx-icon-name.svg'"]), fileBasename))();

      // normalize glyphs
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

function generate(font, options, data) {
  console.log("Lazy-creating destination directory \"" + options.output_dir + "\"...");

  // create destination dir?
  return mkdirpPromise(options.output_dir).then(function () {
    // load templates
    return loadTemplates().spread(function (svgTemplate, cssTemplate, sassTemplate, htmlTemplate) {
      // generate
      var outputDir = resolve(options.output_dir), svg = "" + outputDir + "/" + font.name + ".svg", ttf = "" + outputDir + "/" + font.name + ".ttf", woff = "" + outputDir + "/" + font.name + ".woff", eot = "" + outputDir + "/" + font.name + ".eot", cssPath = "" + outputDir + "/" + font.name + ".css", sassPath = "" + outputDir + "/" + font.name + ".scss", htmlSpecPath = "" + outputDir + "/" + font.name + "-spec.html", tasks = {
        "Generated SVG font": function () {
          return writeFilePromise(svg, svgTemplate(data));
        },
        "Generated TTF, WOFF, and EOT fonts": function () {
          // execute these in sequence
          return execPromise(resolve(__dirname, "" + svg2ttfBin + " " + svg + " " + ttf)).then(function () {
            return execPromise(resolve(__dirname, "" + ttf2woffBin + " " + ttf + " " + woff));
          }).then(function () {
            return execPromise(resolve(__dirname, "" + ttf2eotBin + " " + ttf + " " + eot));
          });
        },
        "Generated CSS": function () {
          return writeFilePromise(cssPath, cssTemplate(data));
        },
        "Generated SASS": function () {
          return writeFilePromise(sassPath, sassTemplate(data));
        },
        "Generated HTML spec": function () {
          return writeFilePromise(htmlSpecPath, htmlTemplate(extend(data, { cssPath: basename(cssPath) })));
        } };

      return all(map(tasks, function (task, message) {
        return task().then(function () {
          return console.log(message);
        });
      })).then(function () {
        return shoot(htmlSpecPath, "" + outputDir + "/" + font.name + "-spec.png");
      }).then(function () {
        return "Generated screenshot";
      }).then(function () {
        return console.log("Done!");
      })["catch"](function (e) {
        return console.error(e);
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
    d: "" + compoundPathFromPaths(paths) + " " + compoundPathFromPolygons(polygons)
  };
}





/*
 * Utilities
 */

function normalizePath(path) {
  path = resolve(normalize(path));

  // add trailing slashes (wish we could use #endsWith :[)
  if (path.slice(-1) != "/") path += "/";

  return path;
}

function loadTemplates() {
  return all([loadTemplate("../templates/font.svg"), loadTemplate("../templates/font.css"), loadTemplate("../templates/font.scss"), loadTemplate("../templates/font.html")]);
}

function getPrefix(name) {
  return name.match(rgxAcronym).join("");
}

function execPromise(command) {
  var deferred = defer();

  exec(command, function (err, stdout, stderr) {
    return err ? deferred.reject(err) : deferred.resolve(stdout);
  });

  return deferred.promise;
}

function globPromise(path, options) {
  var deferred = defer();

  glob(path, options, function (err, files) {
    return err ? deferred.reject(err) : deferred.resolve(files);
  });

  return deferred.promise;
}

function mkdirpPromise(path) {
  var deferred = defer();

  mkdirp(path, function (err) {
    return err ? deferred.reject(err) : deferred.resolve();
  });

  return deferred.promise;
}

function readFilePromise(filename) {
  var deferred = defer();

  readFile(filename, function (err, contents) {
    return err ? deferred.reject(err) : deferred.resolve(contents);
  });

  return deferred.promise;
}

function writeFilePromise(filename, data, charset) {
  if (charset === undefined) charset = "utf8";


  var deferred = defer();

  writeFile(filename, data, charset, function (err) {
    return err ? deferred.reject(err) : deferred.resolve();
  });

  return deferred.promise;
}


function readPackageJson() {
  return readFilePromise(resolve("./package.json")).then(JSON.parse);
}