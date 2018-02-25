var chalk = require('chalk')
var spawn = require('child_process').spawn
var path = require('path')
var EventEmitter = require('events').EventEmitter
var inherits = require('util').inherits
var Split = require('split2')
var createTestServer = require('./setup')
var AbstractBrowser = require('./abstract-browser')

function getPhantom () {
  try {
    return require('phantomjs-prebuilt')
  } catch (e1) {
    try {
      // fall back to older package
      return require('phantomjs')
    } catch (e2) {
      // warn users to install phantomjs-prebuilt if they have neither installed
      throw e1
    }
  }
}

function PhantomBrowser (opt) {
  if (!(this instanceof PhantomBrowser)) {
    return new PhantomBrowser(opt)
  }

  AbstractBrowser.call(this, opt, {
    browser: 'phantom',
    version: null // TODO
  })
}

inherits(PhantomBrowser, AbstractBrowser)

PhantomBrowser.prototype.start = function () {
  var self = this

  var phantomjs = getPhantom()

  var binpath = phantomjs.path

  self.controller = createTestServer(self._opt, function (err, url) {
    if (err) {
      return self.shutdown(err)
    }

    self.debug('url %s', url)

    var reporter = new EventEmitter()

    reporter.on('console', function (msg) {
      console.log.apply(console, msg.args)
    })

    reporter.on('test', function (test) {
      console.log(chalk`starting {white ${test.name}}`)
    })

    reporter.on('test_end', function (test) {
      if (!test.passed) {
        console.log(chalk`failed {red ${test.name}}`)
        return self.stats.failed++
      }

      console.log('passed:', test.name.green)
      self.stats.passed++
    })

    reporter.on('assertion', function (assertion) {
      console.log(chalk`{red Error: ${assertion.message}}`)
      assertion.frames.forEach(function (frame) {
        console.log(chalk`{gray ${frame.func} ${frame.filename}:${frame.line}}`)
      })
      console.log()
    })

    reporter.on('done', function () {
      reporter.removeAllListeners()
    })

    self.emit('init', url)
    self.emit('start', reporter)

    var debugArgs = [
      self._opt.phantomRemoteDebuggerPort ? '--remote-debugger-port=' + self._opt.phantomRemoteDebuggerPort : '',
      self._opt.phantomRemoteDebuggerAutorun ? '--remote-debugger-autorun=true' : ''
    ].filter(Boolean)

    var args = debugArgs.concat([path.join(__dirname, 'phantom-run.js'), url])
    var cp = spawn(binpath, args)

    var split = Split()
    split.on('data', function (line) {
      var msg
      try {
        msg = JSON.parse(line)
      } catch (err) {
        self.emit('error', new Error('failed to parse json: ' + line))
        return
      }

      self.debug('msg: %j', msg)

      if (msg.type === 'exception') {
        self.emit('error', new Error(msg.message))
      } else {
        reporter.emit(msg.type, msg)
      }
    })

    cp.stdout.setEncoding('utf8')
    cp.stdout.pipe(split)

    cp.stderr.on('data', function (data) {
      console.log(chalk`phantom stderr: {red ${data}}`)
    })

    cp.on('close', function (code) {
      self.shutdown()
    })
  })
}

module.exports = PhantomBrowser