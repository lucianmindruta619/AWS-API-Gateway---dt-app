/* global console, process, require */

var AWS = require('aws-sdk');
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


gulp.task('simulate-feed', function () {
  var stage_uri = process.env.DT_STAGE_URI;

  var uri = stage_uri + '/feed';

  uri += '?lastKey=';

  var params = {
    'method': 'GET',
    'uri': uri,
    'json': true
  };

  iamRequest(params, function (error, response, body) {
    if (error) return console.log(error);
    console.log('Request: ' + response.request.href);
    console.log('Response: ' + response.statusCode);
    console.log(body);
  });
});


gulp.task('simulate-drips-owned', function () {
  var stage_uri = process.env.DT_STAGE_URI;

  var uri = stage_uri + '/drips';

  by = 'us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09';
  lastKey = '1450477507897us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09';
  uri += '?collection=owned&by=' + by + '&lastKey=' + lastKey;
  uri += '?collection=owned&by=' + by ;

  var params = {
    'method': 'GET',
    'uri': uri,
    'json': true
  };

  iamRequest(params, function (error, response, body) {
    if (error) return console.log(error);
    console.log('Request: ' + response.request.href);
    console.log('Response: ' + response.statusCode);
    console.log(body);
  });
});


gulp.task('simulate-drips-purchased', function () {
  var stage_uri = process.env.DT_STAGE_URI;

  var uri = stage_uri + '/drips';

  uri += '?collection=purchased&lastKey=2';

  var params = {
    'method': 'GET',
    'uri': uri,
    'json': true
  };

  iamRequest(params, function (error, response, body) {
    if (error) return console.log(error);
    console.log('Request: ' + response.request.href);
    console.log('Response: ' + response.statusCode);
    console.log(body);
  });
});
