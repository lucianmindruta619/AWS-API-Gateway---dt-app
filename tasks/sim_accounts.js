/* global console, process, require */

var url = require('url');
var aws4 = require('aws4');
var fs = require('fs');
var gulp = require('gulp');
var request = require('request');

require('dotenv').load();

function iamRequest (options, callback) {
  var session = JSON.parse(fs.readFileSync(process.env.DT_SESSION_FILE));
  var creds = session.sts.Credentials;
  var parsed_url = url.parse(options.uri);
  var headers = {};
  if (typeof options.headers !== 'undefined') {
    headers = options.headers;
  }
  headers['Content-Type'] = 'application/json';
  headers['X-Amz-Security-Token'] = creds.SessionToken;

  var path = parsed_url.path.replace('@', '%40');
  var signed, to_sign;
  var body = options.body;
  if (typeof options.json !== 'undefined' && options.json) {
    body = JSON.stringify(options.body);
  }
  path = path.replace(':', '%3A');
  to_sign = {'host': parsed_url.hostname,
             'path': path,
             'headers': headers, 'method': options.method,
             'body': body};
  signed = aws4.sign(to_sign, {'accessKeyId': creds.AccessKeyId,
                               'secretAccessKey': creds.SecretAccessKey});
  options.headers = signed.headers;
  request(options, callback);
}

gulp.task('simulate-purchase', function () {
  var stage_uri = process.env.DT_STAGE_URI;
  var dripId = '1450736831420us-east-1:c5c88a1f-e464-4b12-a594-51d855fe12ce';

  var params = {
    'method': 'POST',
    'uri': stage_uri + '/drips/' + dripId + '/purchase',
    'json': true
  };

  iamRequest(params, function (error, response, body) {
    if (error) return console.log(error);
    console.log('Request: ' + response.request.href);
    console.log('Response: ' + response.statusCode);
    console.log(body);
  });
});


gulp.task('simulate-capture', function () {
  var stage_uri = process.env.DT_STAGE_URI;
  var dripId = '1451923105981us-east-1:c5c88a1f-e464-4b12-a594-51d855fe12ce';

  var params = {
    'method': 'POST',
    'uri': stage_uri + '/drips/' + dripId + '/capture',
    'json': true
  };

  iamRequest(params, function (error, response, body) {
    if (error) return console.log(error);
    console.log('Request: ' + response.request.href);
    console.log('Response: ' + response.statusCode);
    console.log(body);
  });
});
gulp.task('simulate-get-account', function () {
  var stage_uri = process.env.DT_STAGE_URI;

  var params = {
    'method': 'GET',
    'uri': stage_uri + '/accounts',
    'json': true
  };

  iamRequest(params, function (error, response, body) {
    if (error) return console.log(error);
    console.log('Request: ' + response.request.href);
    console.log('Response: ' + response.statusCode);
    console.log(body);
  });
});


gulp.task('simulate-credits', function () {
  var stage_uri = process.env.DT_STAGE_URI;

  var params = {
    'method': 'GET',
    'uri': stage_uri + '/accounts/credits',
    'json': true
  };

  iamRequest(params, function (error, response, body) {
    if (error) return console.log(error);
    console.log('Request: ' + response.request.href);
    console.log('Response: ' + response.statusCode);
    console.log(body);
  });
});


gulp.task('simulate-cashouts', function () {
  var stage_uri = process.env.DT_STAGE_URI;

  var params = {
    'method': 'GET',
    'uri': stage_uri + '/accounts/cashouts',
    'json': true
  };

  iamRequest(params, function (error, response, body) {
    if (error) return console.log(error);
    console.log('Request: ' + response.request.href);
    console.log('Response: ' + response.statusCode);
    console.log(body);
  });
});


gulp.task('simulate-iaps', function () {
  var stage_uri = process.env.DT_STAGE_URI;

  var params = {
    'method': 'GET',
    'uri': stage_uri + '/iap',
    'json': true
  };

  iamRequest(params, function (error, response, body) {
    if (error) return console.log(error);
    console.log('Request: ' + response.request.href);
    console.log('Response: ' + response.statusCode);
    console.log(body);
  });
});
