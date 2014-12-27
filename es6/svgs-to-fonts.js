import { exec } from 'child_process'
import { readFile, writeFile } from 'fs'
import { basename, dirname, normalize, resolve } from 'path'
import { extend, first, forEach, map } from 'lodash'
import { all, defer, when } from 'q'
import { DOMParser } from 'xmldom'
import * as glob from 'glob'
import * as mkdirp from 'mkdirp'
import * as SvgPath from 'SvgPath'
import * as defaults from '../defaults'
import { compoundPathFromPaths, compoundPathFromPolygons, generateRandomHex, loadTemplate } from './util'
import { shoot } from './screenshot'

export { compile }

// binaries
const svg2ttfBin = '../node_modules/.bin/svg2ttf'
    , ttf2woffBin = '../node_modules/.bin/ttf2woff'
    , ttf2eotBin = '../node_modules/.bin/ttf2eot'

// regexes
const rgxUnicode = /([a-f][a-f\d]{3,4})/i
    , rgxName = /-(.+).svg/
    , rgxAcronym = /\b([\w\d])/ig

function compile (options) {

  // ensure that input and output dirs are defined
  if (!options.input_dir)
    throw new TypeError('svgs-to-fonts#compile expects an options hash with an "input_dir" property')

  if (!options.output_dir)
    throw new TypeError('svgs-to-fonts#compile expects an options hash with an "output_dir" property')

  // normalize paths
  options.input_dir = normalizePath(options.input_dir)
  options.output_dir = normalizePath(options.output_dir)

  return readPackageJson().then(function (packageJson) {

    // set options (extend defaults.json with package.json#font with CLI args)
    let font = extend(defaults, packageJson.font, {
          name: packageJson.name
        })
      , fontHeight = font.ascent - font.descent

        // template data
      , data = {
          font: font,
          glyphs: [],
          fontHeight: fontHeight,
          fontFamily: packageJson.name,
          prefix: options.prefix || getPrefix(packageJson.name),
          hex: generateRandomHex()
        }

    console.log(`Generating font "${ font.name }"...`)

    return prepare(options.input_dir, fontHeight).then(function (glyphs) {
      return generate(font, options, extend(data, {
        glyphs: glyphs
      }))
    })

  })

}

function prepare (inputDir, fontHeight) {

  // Generate normalized glyphs
  return globPromise(`${ inputDir }\/*.svg`).then(function (files) {

    console.info(`Found ${ files.length } files in ${ inputDir }`)

    return all(files.map(function (file) {

      // get unicode and glyph name from file name
      let name = file.match(rgxName)[0]
        , unicode = file.match(rgxUnicode)[0]

      // check for unicode
      if (!unicode)
        throw new Error `Expected ${file} to be in the format 'xxxx-icon-name.svg'`

      // normalize glyphs
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

function generate (font, options, data) {

  console.log(`Lazy-creating destination directory "${options.output_dir}"...`)

  // create destination dir?
  return mkdirpPromise(options.output_dir).then(()=> {

    // load templates
    return loadTemplates().spread(function (svgTemplate, cssTemplate, sassTemplate, htmlTemplate) {

      // generate 
      let outputDir = resolve(options.output_dir)
        , svg = `${outputDir}/${font.name}.svg`
        , ttf = `${outputDir}/${font.name}.ttf`
        , woff = `${outputDir}/${font.name}.woff`
        , eot = `${outputDir}/${font.name}.eot`
        , tasks = {
            'Generated SVG font': ()=> writeFilePromise(svg, svgTemplate(data)),
            'Generated TTF, WOFF, and EOT fonts': ()=> {
              // these must be executed in sequence
              return execPromise(resolve(__dirname, `${svg2ttfBin} ${svg} ${ttf}`))
              .then(()=> execPromise(resolve(__dirname, `${ttf2woffBin} ${ttf} ${woff}`)))
              .then(()=> execPromise(resolve(__dirname, `${ttf2eotBin} ${ttf} ${eot}`)))
            },
            'Generated CSS': ()=> writeFilePromise(`${outputDir}/font.css`, cssTemplate(data)),
            'Generated SASS': ()=> writeFilePromise(`${outputDir}/font.scss`, sassTemplate(data)),
            'Generated HTML spec': ()=> writeFilePromise(`${outputDir}/font.html`, htmlTemplate(data)),
          }

      return all(
        map(
          tasks,
          (task, message) => task().then(()=> console.log(message))
        )
      )
      .then(()=> {
        console.log('shooting...');
        return shoot(`${outputDir}/font.html`, `${outputDir}/screenie.jpg`)
      })
      .then(()=> console.log('Done!'))

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
    d: `${ compoundPathFromPaths(paths) } ${ compoundPathFromPolygons(polygons) }`
  }

}





/*
 * Utilities
 */

function normalizePath (path) {

  path = resolve(normalize(path))

  // add trailing slashes (wish we could use #endsWith :[)
  if (path.slice(-1) != '/')
    path += '/'

  return path

}

function loadTemplates () {
  return all([
    loadTemplate('../templates/font.svg'),
    loadTemplate('../templates/font.css'),
    loadTemplate('../templates/font.scss'),
    loadTemplate('../templates/font.html')
  ])
}

function getPrefix (name) {
  return name.match(rgxAcronym).join('')
}

function execPromise (command) {

  let deferred = defer()

  exec(command, function (err, stdout, stderr) {

    return err ? deferred.reject(err) : deferred.resolve(stdout)

  })

  return deferred.promise

}

function globPromise (path, options) {

  let deferred = defer()

  glob(path, options, function (err, files) {

    return err ? deferred.reject(err) : deferred.resolve(files)

  })

  return deferred.promise

}

function mkdirpPromise (path) {

  let deferred = defer()

  mkdirp(path, function (err) {

    return err ? deferred.reject(err) : deferred.resolve()

  })

  return deferred.promise

}

function readFilePromise (filename) {

  let deferred = defer()

  readFile(filename, function (err, contents) {

    return err ? deferred.reject(err) : deferred.resolve(contents)

  })

  return deferred.promise

}

function writeFilePromise (filename, data, charset = 'utf8') {

  let deferred = defer()

  writeFile(filename, data, charset, function (err) {

    return err ? deferred.reject(err) : deferred.resolve()

  })

  return deferred.promise

}


function readPackageJson () {

  return readFilePromise(resolve('./package.json'))
    .then(JSON.parse)

}