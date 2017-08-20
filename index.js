const {spawn} = require('child_process')
const EventEmitter = require('events')
const binding = require('./build/Release/fs_admin.node')

module.exports.testMode = false;

switch (process.platform) {
  case 'darwin': {
    class WriteStream extends EventEmitter {
      constructor (childProcess) {
        super()
        this.childProcess = childProcess
        this.childProcess.on('error', (error) => this.emit('error', error))
        this.childProcess.on('exit', (exitCode) => {
          if (exitCode !== 0) {
            this.emit('error', new Error(`Authopen failed with exit code: ${exitCode}`))
          }

          this.emit('end')
        })
      }

      write (chunk, encoding, callback) {
        this.childProcess.stdin.write(chunk, encoding, callback)
      }

      end (callback) {
        this.childProcess.stdin.end()
        if (callback) this.childProcess.on('exit', callback)
      }
    }

    module.exports.createWriteStream = function (filePath) {
      let authopen;
      if (module.exports.testMode) {
        authopen = spawn('/bin/dd', ['of=' + filePath])
      } else {
        authopen = spawn('/usr/libexec/authopen', ['-extauth', '-w', '-c', filePath], {
          stdio: ['pipe', 'inherit', 'inherit']
        })
        authopen.stdin.write(binding.getAuthorizationForm())
      }
      return new WriteStream(authopen)
    }

    module.exports.symlink = function (target, filePath, callback) {
      binding.spawnAsAdmin(
        '/bin/ln',
        ['-s', target, filePath],
        module.exports.testMode,
        wrapCallback('ln', callback)
      )
    }

    module.exports.unlink = function (filePath, callback) {
      binding.spawnAsAdmin(
        '/bin/rm',
        ['-f', filePath],
        module.exports.testMode,
        wrapCallback('rm', callback)
      )
    }

    break
  }

  case 'win32': {
    module.exports.symlink = function (target, filePath, callback) {
      binding.spawnAsAdmin(
        'mklink',
        ['/j', target, filePath],
        wrapCallback('mklink', callback)
      )
    }

    module.exports.unlink = function (filePath, callback) {
      binding.spawnAsAdmin(
        'del',
        ['/F', filePath],
        wrapCallback('del', callback)
      )
    }
  }
}

function wrapCallback (commandName, callback) {
  return (exitCode) => callback(
    exitCode === 0 ?
      null :
      new Error(commandName + ' failed with exit status ' + exitCode)
  )
}