import { writeFile } from 'fs'
import { basename, dirname, resolve } from 'path'
import { defer } from 'q'
import * as express from 'express'
import * as steer from 'steer'
import * as screenshot from 'steer-screenshot'

function _shoot (chrome, port, srcPath, destFile) {

  let deferred = defer()

  chrome.once('open', function () {
    chrome.inspector.Page.enable(function (err) {

      if (err) return deferred.reject('error enabling', err)

      // fix occasional "Error: No page with the given url was found"
      setTimeout(() => {

        chrome.inspector.Page.navigate(`http://127.0.0.1:${port}/${basename(srcPath)}`, function (err) {

          if (err) return deferred.reject('error navigating', err)

            chrome.inspector.Page.once('loadEventFired', function () {

              // fix occasional issue when icons don't render in time
              setTimeout(() => {

                // capture a screenshot @ quality=100
                screenshot(chrome, { format: 'png' }, function (err, buffer, attempts) {

                  if (err) return deferred.reject('error shooting', err)

                  writeFile(destFile, buffer, function (err) {

                    if (err) return deferred.reject('error saving screenshot to disk', err)

                    deferred.resolve()

                  })
                })

              }, 2000)

            })

        })

      }, 1000)

    })
  })

  return deferred.promise

}

export function shoot (srcPath, destFile, port = 1234) {

  // start a server
  let server = express()
  .use('/', express.static(dirname(srcPath)))
  .listen(port)

  // shoot it!
  let chrome = steer({
    cache: resolve(__dirname, 'cache'),
    inspectorPort: 7510,
    permissions: ['tabs'], // this module needs `tabs` permissions
    size: [1280, 1024]
  })

  chrome.on('error', function (err) {
    console.error('chrome errr!', err)
  })

  return _shoot(chrome, port, srcPath, destFile).finally(()=> {
    chrome.close()
    server.close()
  })

}