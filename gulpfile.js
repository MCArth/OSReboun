const gulp = require('gulp');
const uglify = require('gulp-uglify');
const babel = require('gulp-babel');
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');

function buildServer() {
    return gulp.src("src/server/**/*.js")
        .pipe(uglify)
        .pipe(gulp.dest("bin/server"))
}

// File paths
const files = { 
    client: 'src/clientjs/js/app.js'
}

function buildClient() {
    let input = browserify(
            files.client,
            {
                insertGlobalVars: true,
            }
        ).bundle()
        .pipe(source(files.client))
        .pipe(buffer());
    return input
        .pipe(babel({
            presets: ['@babel/env']
        }))
        .pipe(uglify())
        .pipe(gulp.dest('src/client/bin'));
}

var build = gulp.series(buildClient);
exports.default = build;