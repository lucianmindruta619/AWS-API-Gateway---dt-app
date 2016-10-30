
/* global console, process, require */

var AWS = require('aws-sdk');
var url = require('url');
var aws4 = require('aws4');
var fs = require('fs');
var gulp = require('gulp');
var request = require('request');
var async = require('async');

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


gulp.task('test-ios-receipt', function () {
  var source = 'sandboxReceipt';

  fs.readFile(source, function (fs_err, file_contents) {
    if (fs_err) return console.log(fs_err);
    var base64str = file_contents.toString('base64');
    var params = {
      'method': 'POST',
      'uri': 'https://sandbox.itunes.apple.com/verifyReceipt',
      'body': {'receipt-data': base64str},
      'json': true
    };
    request(params, function (error, response, body) {
      if (error) return console.log(error);
      console.log('Request: ' + response.request.href);
      console.log('Response: ' + response.statusCode);
      console.log(body.receipt.in_app);
    });
  });
});


gulp.task('simulate-ios-dripcoins', function () {
  var stage_uri = process.env.DT_STAGE_URI;
  var source = 'sandboxReceipt';

  fs.readFile(source, function (fs_err, file_contents) {
    if (fs_err) return console.log(fs_err);
    var base64str = file_contents.toString('base64');
    var params = {
      'method': 'POST',
      'uri': stage_uri + '/dripcoins',
      'body': {'receipt': base64str, 'platform': 'ios'},
      'json': true
    };

    iamRequest(params, function (error, response, body) {
        if (error) return console.log(error);
        console.log('Request: ' + response.request.href);
        console.log('Response: ' + response.statusCode);
        console.log(body);
    });
  });
});

