#!/usr/bin/env node

import { compile } from './savant'

let packageJson = require('../package.json')
let argv = require('optimist')
  .usage(packageJson.description + '\nUsage: $0 -i [input_dir] -o [output_dir]')
  .demand('in')
  .demand('out')
  .alias('i', 'in')
  .alias('o', 'out')
  .alias('n', 'name')
  .alias('p', 'prefix')
  .describe('in', 'Input directory (containing your SVG icons)')
  .describe('out', 'Output directory (where savant should put your new icon font)')
  .describe('name', 'A name for your new font (avoid spaces)')
  .describe('prefix', 'A prefix for your font\'s CSS className')
  .argv

compile({
  input_dir: argv.in,
  output_dir: argv.out,
  name: argv.name,
  prefix: argv.prefix
})