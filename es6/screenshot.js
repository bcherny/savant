import { writeFile } from 'fs'
import { basename, dirname, resolve } from 'path'
import { defer } from 'q'
import * as express from 'express'
import * as steer from 'steer'
import * as screenshot from 'steer-screenshot'

export function shoot (srcPath, destFile, port = 1234) {

  let deferred = defer()

  // start a server
  express()
  .use('/', express.static(dirname(srcPath)))
  .listen(port)

  console.log(`Serving "${dirname(srcPath)}" on port ${port}`)

  // shoot it!
  let chrome = steer({
    cache: resolve(__dirname, 'cache'),
    inspectorPort: 7510,
    permissions: ['tabs'] // this module needs `tabs` permissions
  });

  chrome.once('open', function () {
    chrome.inspector.Page.enable(function (err) {

      if (err) return deferred.reject('error enabling', err)

      setTimeout(()=>{

        chrome.inspector.Page.navigate(`http://127.0.0.1:${port}/${basename(srcPath)}`, function (err) {

          if (err) return deferred.reject('error navigating', err)

          chrome.inspector.Page.once('domContentEventFired', function () {

            // The second argument (100) is the JPEG quality
            screenshot(chrome, 100, function (err, buffer, attemps) {

              if (err) return deferred.reject('error shooting', err)

              console.log('Screenshot taken after ' + attemps + ' attemps')

              writeFile(destFile, buffer, function (err) {

                if (err) return deferred.reject('error saving screenshot to disk', err)
                
                console.log(`Saved screenshot to ${destFile}`)

                deferred.resolve()

              })
            })
          })
        })

      })
  
    })
  })

  return deferred.promise

}