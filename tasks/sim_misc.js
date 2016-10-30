/* global Buffer, console, process, require */

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


gulp.task('simulate-channels', function () {
  var stage_uri = process.env.DT_STAGE_URI;
  var uri = stage_uri + '/channels';

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

gulp.task('simulate-qr', function () {
  var stage_uri = process.env.DT_STAGE_URI;
  var dripId = '1450479346223us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09';
  var hostname = 'http://dripthat.com';
  var output = 'qr.png';
  var uri = stage_uri + '/drips/' + dripId + '/qr' + '?hostname=' +
            encodeURIComponent(hostname);

  var params = {
    'method': 'GET',
    'uri': uri,
    'json': true
  };

  iamRequest(params, function (error, response, body) {
    if (error) return console.log(error);
    console.log('Request: ' + response.request.href);
    console.log('Response: ' + response.statusCode);
    var buf = new Buffer(body.image, 'base64');
    fs.writeFile(output, buf, function (qrErr) {
      if (qrErr) return console.log(qrErr);
      console.log("The qr was saved to '" + output + "'!");
    });
  });
});


gulp.task('simulate-search-tags', function () {
  var stage_uri = process.env.DT_STAGE_URI;

  var uri = stage_uri + '/search/tags/tag';

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


gulp.task('simulate-search-users', function () {
  var stage_uri = process.env.DT_STAGE_URI;

  var uri = stage_uri + '/search/users/test';

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


gulp.task('simulate-sns', function () {

  function publishToSNS (aMove, fn) {
    var sns = new AWS.SNS();
    var params = {
        'Message': JSON.stringify(aMove),
        'TopicArn': "arn:aws:sns:us-east-1:493526813836:dt-media"
    };
    sns.publish(params, function (err) {
      if (err) fn('Internal Server Error: SNS:' + err);
      fn(null);
    });
  }

  var message = {
    "ownerId": "us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09",
    "dripId": "1450358673763us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09",
    "srcBucket": "dt-dripmedia-upload",
    "dstBucket": "dt-dripmedia-upload",
    "srcPreviewKey":
      "us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09/preview_profile.jpg",
    "srcFullKey":
      "us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09/profile.jpg",
    "dstPreviewKey":
      "1450358673763us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09" +
      "/preview_profile.jpg",
    "dstFullKey":
      "1450358673763us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09/profile.jpg"
  };

  var message2 = {
    "ownerId": "us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09",
    "dripId": "1450358673763us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09",
    "srcBucket": "dt-dripmedia-upload",
    "dstBucket": "dt-dripmedia",
    "srcPreviewKey":
      "us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09/preview_pro.jpg",
    "srcFullKey":
      "us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09/pro.jpg",
    "dstPreviewKey":
      "1450358673763us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09" +
      "/preview_pro.jpg",
    "dstFullKey":
      "1450358673763us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09/pro.jpg"
  };
  var messages = [];
  messages.push(message);
  messages.push(message2);
  async.each(messages, publishToSNS, function (sns_err, data) {
    if (sns_err) return console.log(sns_err);
    console.log(data);
  });
});

gulp.task('simulate-env', function () {
  var stage_uri = process.env.DT_STAGE_URI;
  var uri = stage_uri + '/env';

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


function getOAuthToken (fn) {
  var env = require('../scripts/env.json');
  var oauthUri = 'https://api-ssl.bitly.com/oauth/access_token';
  var bitlyUser = env.BITLY_USER;
  var bitlyPass = env.BITLY_PASS;
  request({'method': 'post', 'uri': oauthUri, 'json': true, 'auth':
           {'user': bitlyUser, 'pass': bitlyPass}},
          function (error, response, body) {
    if (error) return fn(error);
    return fn(null, body);
  });
}

function shorten (longUrl, fn) {
  var bitlyUri = 'https://api-ssl.bitly.com';
  var domain = 'drip.in';
  getOAuthToken(function (err, token) {
    if (err) return fn(err);
    bitlyUri += '/v3/shorten?longUrl=' + encodeURIComponent(longUrl);
    bitlyUri += '&domain=' + domain;
    bitlyUri += '&access_token=' + token;
    var params = {
      'method': 'GET',
      'uri': bitlyUri,
      'json': true
    };
    request(params, function (error, response, body) {
      if (error) return console.log(error);
      if (response.statusCode !== 200) {
        return fn('Internal Server Error: ' + body.status_txt);
      }
      return fn(null, body.data.long_url, body.data.url);
    });
  });
}

gulp.task('create-bitly', function () {
  var toShorten = 'http://dripthat.com/drips/1453505281383us-east-1:' +
                  '4cb603cf-7967-4196-a2ee-29a8bd2031be';
  shorten(toShorten, function (err, longUrl, shortUrl) {
    if (err) return console.log(err);
    console.log(longUrl, shortUrl);
  });
});
