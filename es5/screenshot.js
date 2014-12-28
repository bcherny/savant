"use strict";

exports.shoot = shoot;
var writeFile = require('fs').writeFile;
var basename = require('path').basename;
var dirname = require('path').dirname;
var resolve = require('path').resolve;
var defer = require('q').defer;
var express = require('express');

var steer = require('steer');

var screenshot = require('steer-screenshot');

function _shoot(chrome, port, srcPath, destFile) {
  var deferred = defer();

  chrome.once("open", function () {
    chrome.inspector.Page.enable(function (err) {
      if (err) return deferred.reject("error enabling", err);

      // fix occasional "Error: No page with the given url was found"
      setTimeout(function () {
        chrome.inspector.Page.navigate("http://127.0.0.1:" + port + "/" + basename(srcPath), function (err) {
          if (err) return deferred.reject("error navigating", err);

          chrome.inspector.Page.once("loadEventFired", function () {
            // fix occasional issue when icons don't render in time
            setTimeout(function () {
              // capture a screenshot @ quality=100
              screenshot(chrome, { format: "png" }, function (err, buffer, attempts) {
                if (err) return deferred.reject("error shooting", err);

                writeFile(destFile, buffer, function (err) {
                  if (err) return deferred.reject("error saving screenshot to disk", err);

                  deferred.resolve();
                });
              });
            }, 2000);
          });
        });
      }, 1000);
    });
  });

  return deferred.promise;
}

function shoot(srcPath, destFile, port) {
  if (port === undefined) port = 1234;


  // start a server
  var server = express().use("/", express["static"](dirname(srcPath))).listen(port);

  // shoot it!
  var chrome = steer({
    cache: resolve(__dirname, "cache"),
    inspectorPort: 7510,
    permissions: ["tabs"], // this module needs `tabs` permissions
    size: [1280, 1024]
  });

  chrome.on("error", function (err) {
    console.error("chrome errr!", err);
  });

  return _shoot(chrome, port, srcPath, destFile)["finally"](function () {
    chrome.close();
    server.close();
  });
}