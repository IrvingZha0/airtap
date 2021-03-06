var test = require('tape')
var path = require('path')
var Zuul = require('../../')
var auth = require('../auth')
var getBrowsers = require('../../lib/get-saucelabs-browsers')
var flattenBrowser = require('../../lib/flatten-browserlist')
var browsersToTest = require('airtap-browsers').pullRequest
var verify = require('./verify-common')

test('tape - sauce', function (t) {
  var config = {
    prj_dir: path.resolve(__dirname, '../fixtures/tape'),
    files: [ path.resolve(__dirname, '../fixtures/tape/test.js') ],
    username: auth.username,
    concurrency: 5,
    key: auth.key,
    sauce_connect: true,
    loopback: 'airtap.local'
  }

  var zuul = Zuul(config)

  getBrowsers(function (err, allBrowsers) {
    var browsers = flattenBrowser(browsersToTest, allBrowsers)
    browsers.forEach(zuul.browser.bind(zuul))
    verify(t, zuul, err)
  })
})
