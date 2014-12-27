const gulp = require('gulp')
    , util = require('gulp-util')

gulp.task('transpile', function () {

  return gulp
    .src('./es6/*.js')
    .pipe(require('gulp-6to5')({
      modules: 'common'
    }))
    .on('error', error)
    .pipe(gulp.dest('./es5/'))

})

gulp.task('default', function () {

  gulp.watch('./es6/*.js', ['transpile'])

})

function error (err) {
  util.log(util.colors.red('Error'), err.message)
  this.end()
}