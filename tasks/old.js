/* global  require */

var gulp = require('gulp');
var lambda = require('gulp-awslambda');
var zip = require('gulp-zip');
var foreach = require('gulp-foreach');

var opts = {
    'region': 'us-east-1'
};

require('dotenv').load();

/**
 * For uploading the first time (creating a function).
 * Subsequent updates on a function that has already been created only
 * require the name of the function (see task below).
var lambda_params = {
  FunctionName: 'testGulpAWSLambda',
  Role: commonRole
};
gulp.task('updateLambda', function() {
    return gulp.src('src/*.js')
        .pipe(foreach(function(stream, file) {
            var fileName = file.path.replace(
              "/Users/pablo/Documents/workspace/dripJS/src/", "");
            return gulp.src('src/' + fileName)
                .pipe(zip('out/' + fileName.replace(".js", ".zip")))
                //.pipe(lambda(lambda_params, opts))
                .pipe(lambda(fileName.replace(".js", ""), opts))
                .pipe(gulp.dest('out/'));
        }))
});
*/

gulp.task('updateLambdas', function () {
    return gulp.src('src/*.js')
        .pipe(foreach(function (stream, file) {
            var fileName = file.path.replace(
              "/Users/pablo/Documents/workspace/dripJS/src/", "");
            return gulp.src(['src/' + fileName, 'inc/*.js'])
                .pipe(zip(fileName.replace(".js", ".zip")))
                .pipe(lambda(fileName.replace(".js", ""), opts))
                .pipe(gulp.dest('out/'));
        }));
});

gulp.task('updateLambda', function () {
    return gulp.src('src/*.js')
        .pipe(foreach(function (filestream, file) {
            var fileName = file.path.replace(
              "/Users/pablo/Documents/workspace/dripJS/src/", "");
            return gulp.src('out/' + fileName.replace(".js", ".zip"))
                .pipe(foreach(function (stream, src_file) {
                    if (src_file.stat.ctime > file.stat.ctime) {
                        // console.log("source is older");
                        return gulp.src(['src/' + fileName, 'inc/*.js']);
                    } else {
                        // console.log("source is newer");
                        return gulp.src(['src/' + fileName, 'inc/**/**/*'])
                            .pipe(zip(fileName.replace(".js", ".zip")))
                            .pipe(lambda(fileName.replace(".js", ""), opts))
                            .pipe(gulp.dest('out/'));
                    }
                }));
        }));
});

gulp.task('default', ['updateLambda']);

