import { exec } from 'child_process'
import { readFile, writeFile } from 'fs'
import { basename, resolve } from 'path'
import { extend, first, forEach } from 'lodash'
import { all, defer, when } from 'q'
import { DOMParser } from 'xmldom'
import * as glob from 'glob'
import * as SvgPath from 'SvgPath'
import * as defaults from '../defaults'
import * as util from './util'

export { compile }

// regexes
const rgxUnicode = /([a-f][a-f\d]{3,4})/i
    , rgxName = /-(.+).svg/
    , rgxAcronym = /\b([\w\d])/ig

function compile (args) {

  return readPackageJson().then(function (config) {

    try {

    // set options (extend defaults.json with package.json#font with CLI args)
    let font = extend(defaults, config.font, args)
      , fontHeight = font.ascent - font.descent

        // template data
      , data = {
          font: font,
          glyphs: [],
          fontHeight: fontHeight,
          fontFamily: config.name,
          prefix: args.prefix || getPrefix(config.name),
          hex: util.generateRandomHex()
        }

    console.log('Scaling images...')

    return prepare(args.input_dir, fontHeight).then(function (glyphs) {
      return generate(config, extend(data, {
        glyphs: glyphs
      }))
    })

  } catch (err) {
    console.log(err)
  }

  })

}

function prepare (inputDir, fontHeight) {

  // Generate normalized glyphs
  return globPromise(`${ inputDir }\/*.svg`).then(function (files) {

    console.info(`Found ${ files.length } files`)

    return all(files.map(function (file) {

      // get unicode and glyph name from file name
      let name = file.match(rgxName)[0]
        , unicode = file.match(rgxUnicode)[0]

      // check for unicode
      if (!unicode)
        throw new Error `Expected ${file} to be in the format 'xxxx-icon-name.svg'`

      // normalize glyph
      return readFilePromise(file).then(function (contents) {

        let glyph = parse(contents.toString(), file)
          , ratio = fontHeight/glyph.height

        return {
          css: basename(name || unicode, '.svg')
              .replace(/-/g, ' ')
              .trim(),
          unicode: `&#x${unicode};`,
          width: glyph.width,
          d: new SvgPath(glyph.d)
              .scale(ratio, -ratio)
              .toString()
        }

      })

    }))

  })

}

function generate (config, data) {

  // load templates
  loadTemplates().spread(function (svgTemplate, cssTemplate, sassTemplate, htmlTemplate) {

    let svg = `${ data.font.output_dir }/${ config.name }.svg`
      , ttf = `${ data.font.output_dir }/${ config.name }.ttf`
      , tasks = {
          'Generating SVG': _ => writeFilePromise(svg, svgTemplate(data)),
          'Generating TTF': _ => execPromise(resolve(__dirname, `../node_modules/.bin/svg2ttf ${svg} ${ttf}`)),
          'Generating WOFF': _ => execPromise(resolve(__dirname, `../node_modules/.bin/ttf2woff ${ttf} ${data.font.output_dir}/${config.name}.woff`)),
          'Generating EOT': _ => execPromise(resolve(__dirname, `../node_modules/.bin/ttf2eot ${ttf} ${data.font.output_dir}/${config.name}.eot`)),
          'Generating CSS': _ => writeFilePromise(resolve(process.cwd(), './dist/font.css'), cssTemplate(data)),
          'Generating SASS': _ => writeFilePromise(resolve(process.cwd(), './dist/font.scss'), sassTemplate(data)),
          'Generating HTML spec': _ => writeFilePromise(resolve(process.cwd(), './dist/font.html'), htmlTemplate(data)),
          'Done!': _ => when()
        }

    forEach(tasks, (fn, message) => {
      fn().then(
        _ => {console.log(message) },
        err => { console.log('err', err.stack)}
      )
    })

  })

}

function parse (data, filename) {

  let doc = new DOMParser().parseFromString(data, 'application/xml')
    , svg = doc.getElementsByTagName('svg')[0]
    , height = parseFloat(svg.getAttribute('height'), 10)
    , width = parseFloat(svg.getAttribute('width'), 10)

  // check for width and height
  if (isNaN(height))
    throw new Error(`Missing height attribute in ${ filename }`)

  if (isNaN(width))
    throw new Error(`Missing width attribute in ${ filename }`)

  // get elements
  let paths = svg.getElementsByTagName('path')
    , polygons = svg.getElementsByTagName('polygon')

  // check for paths/polygons
  if (!paths.length && !polygons.length)
    throw new Error(`No path or polygon data found in ${ filename }`)

  return {
    height: height,
    width: width,
    d: `${ util.compoundPathFromPaths(paths) } ${ util.compoundPathFromPolygons(polygons) }`
  }

}





/*
 * Utilities
 */

function loadTemplates () {
  return all([
    util.loadTemplate('../templates/font.svg'),
    util.loadTemplate('../templates/font.css'),
    util.loadTemplate('../templates/font.scss'),
    util.loadTemplate('../templates/font.html')
  ])
}

function getPrefix (name) {
  return name.match(rgxAcronym).join('')
}

function execPromise (command) {

  let deferred = defer()

  exec(command, function (err, stdout, stderr) {

    if (err) deferred.reject(err)

    deferred.resolve(stdout)

  })

  return deferred.promise

}

function globPromise (path, options) {

  let deferred = defer()

  glob(path, options, function (err, files) {

    if (err) deferred.reject(err)

    deferred.resolve(files)

  })

  return deferred.promise

}

function readFilePromise (filename) {

  let deferred = defer()

  readFile(filename, function (err, contents) {

    if (err) deferred.reject(err)

    deferred.resolve(contents)

  })

  return deferred.promise

}

function writeFilePromise (filename, data, charset = 'utf8') {

  let deferred = defer()

  console.log('write', filename, data)

  writeFile(filename, data, charset, function (err) {

    if (err) return deferred.reject(err)

    deferred.resolve()

  })

  return deferred.promise

}


function readPackageJson () {

  return readFilePromise(resolve('./package.json'))
    .then(contents => JSON.parse(contents))

}