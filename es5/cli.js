#!/usr/bin/env node
"use strict";

var compile = require('./savant').compile;


var packageJson = require("../package.json");
var argv = require("optimist").usage(packageJson.description + "\nUsage: $0 -i [input_dir] -o [output_dir]").demand("in").demand("out").alias("i", "in").alias("o", "out").describe("in", "Input directory (containing your SVG icons)").describe("out", "Output directory (where savant should put your new icon font)").argv;

compile({
  input_dir: argv["in"],
  output_dir: argv.out
});