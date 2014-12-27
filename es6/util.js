import { defer } from 'q'
import { readFile } from 'fs'
import { template, toArray } from 'lodash'
import { resolve } from 'path'

export {
  compoundPathFromPaths,
  compoundPathFromPolygons,
  generateRandomHex,
  loadTemplate
}

function compoundPathFromPaths (paths) {
  return toArray(paths)
    .map(path => path.getAttribute('d'))
    .join(' ')
}

function compoundPathFromPolygons (paths) {

  return `M ${
    toArray(paths)
      .map(path => path.getAttribute('points'))
      .join('z M')
  }z`

}

/**
 * Generates a random hex code for cache busting
 * @return {String} eg. "#ffffff"
 */
function generateRandomHex () {
  return Math.floor(Math.random()*16777215).toString(16)
}

/**
 * Get a lodash template object from a file
 * @param  {String} filename
 * @return {Promise<Function>} Lodash template function
 */
function loadTemplate (filename) {

  let deferred = defer()
    , resolvedFilename = resolve(__dirname, filename)
  
  readFile(resolvedFilename, (err, contents) => {

    if (err) {
      return deferred.reject(err)
    }

    deferred.resolve(template(contents))

  })

  return deferred.promise

}