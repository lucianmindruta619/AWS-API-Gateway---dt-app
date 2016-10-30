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
gulp.task('simulate-create-drip', function () {
  var stage_uri = process.env.DT_STAGE_URI;
  iamRequest({
    'method': 'POST',
    'uri': stage_uri + '/drips',
    'body': JSON.stringify(
      {'title': 'Test drip', 'description': 'Test drip description'}
    )
  }, function (error, response, body) {
      if (error) return console.log(error);
      console.log('Request: ' + response.request.href);
      console.log('Response: ' + response.statusCode);
      console.log(body);
  });
});

gulp.task('simulate-delete-drip', function () {
  var stage_uri = process.env.DT_STAGE_URI;
  var dripId = '1450350120580us-east-1:378a54b0-a66a-4fdc-9d42-8c16f38fe3eb';

  var params = {
    'method': 'DELETE',
    'uri': stage_uri + '/drips/' + dripId,
    'json': true
  };

  iamRequest(params, function (error, response, body) {
      if (error) return console.log(error);
      console.log('Request: ' + response.request.href);
      console.log('Response: ' + response.statusCode);
      console.log(body);
  });
});

gulp.task('simulate-get-drip', function () {
  var stage_uri = process.env.DT_STAGE_URI;
  var dripId = '1450479346223us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09';
  var params;
  dripId = '1451427425472us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09';

  params = {
    'method': 'GET',
    'uri': stage_uri + '/drips/' + dripId,
    'json': true
  };

  iamRequest(params, function (error, response, body) {
      if (error) return console.log(error);
      console.log('Request: ' + response.request.href);
      console.log('Response: ' + response.statusCode);
      console.log(body);
  });
});

gulp.task('simulate-add-tags', function () {
  var stage_uri = process.env.DT_STAGE_URI;
  var dripId = '1450350120580us-east-1:378a54b0-a66a-4fdc-9d42-8c16f38fe3eb';

  var params = {
    'method': 'POST',
    'uri': stage_uri + '/drips/' + dripId + '/tags',
    'json': true,
    'body': {'tags': ['movies', 'music', 'film']}
  };

  iamRequest(params, function (error, response, body) {
    if (error) return console.log(error);
    console.log('Request: ' + response.request.href);
    console.log('Response: ' + response.statusCode);
    console.log(body);
  });
});


gulp.task('simulate-vote', function () {
  var stage_uri = process.env.DT_STAGE_URI;
  var dripId = '1451427425472us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09';

  var params = {
    'method': 'POST',
    'uri': stage_uri + '/drips/' + dripId + '/vote',
    'json': true,
    'body': {'like': 1}
  };

  iamRequest(params, function (error, response, body) {
    if (error) return console.log(error);
    console.log('Request: ' + response.request.href);
    console.log('Response: ' + response.statusCode);
    console.log(body);
  });
});


gulp.task('simulate-report', function () {
  var stage_uri = process.env.DT_STAGE_URI;
  var dripId = '1451427425472us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09';

  var params = {
    'method': 'POST',
    'uri': stage_uri + '/drips/' + dripId + '/vote',
    'json': true,
    'body': {'report': true}
  };

  iamRequest(params, function (error, response, body) {
    if (error) return console.log(error);
    console.log('Request: ' + response.request.href);
    console.log('Response: ' + response.statusCode);
    console.log(body);
  });
});

gulp.task('simulate-add-media', function () {
  var stage_uri = process.env.DT_STAGE_URI;
  var dripId = '1450358673763us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09';

  var fullUrl = 'https://dt-dripmedia-upload.s3.amazonaws.com/us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09/profile.jpg';
  var previewUrl = 'https://dt-dripmedia-upload.s3.amazonaws.com/us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09/preview_profile.jpg';

  var params = {
    'method': 'POST',
    'uri': stage_uri + '/drips/' + dripId + '/media',
    'json': true,
    'body': {"media": [{"preview_url": previewUrl,
                        "full_url": fullUrl,
                        "locked": true}]
      }
  };

  iamRequest(params, function (error, response, body) {
    if (error) return console.log(error);
    console.log('Request: ' + response.request.href);
    console.log('Response: ' + response.statusCode);
    console.log(body);

    params = {
      'method': 'GET',
      'uri': stage_uri + '/drips/' + dripId,
      'json': true
    };
    console.log('Getting drip...');

    iamRequest(params, function (error, response, body) {
        if (error) return console.log(error);
        console.log('Request: ' + response.request.href);
        console.log('Response: ' + response.statusCode);
        console.log(body);
    });

  });
});


gulp.task('simulate-upload-media', function () {
  var creds = JSON.parse(fs.readFileSync(process.env.DT_SESSION_FILE));
  var source = 'profile.jpg';
  var bucketname = 'dt-dripmedia-upload';
  var cognitoId = 'us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09';
  var s3;

  var fullTarget = cognitoId + '/' + source;
  var previewTarget = cognitoId + '/preview_' + source;

  AWS.config.loadFromPath(process.env.DT_SESSION_FILE);
  AWS.config.update({'accessKeyId': creds.AccessKeyId,
                     'secretAccessKey': creds.SecretAccessKey,
                     'sessionToken': creds.SessionToken});

  fs.readFile(source, function (fs_err, file_contents) {
    if (fs_err) return console.log(fs_err);
    s3 = new AWS.S3();
    console.log('Putting object ' + fullTarget + ' in bucket ' + bucketname);
    s3.putObject({
      'Bucket': bucketname,
      'Key': fullTarget,
      'Body': file_contents
    }, function (err, data) {
      if (err) return console.log(err, err.stack); // an error occurred
      console.log(data);           // successful response
      console.log('Putting object ' + previewTarget + ' in bucket ' +
                  bucketname);
      s3.putObject({
        'Bucket': bucketname,
        'Key': previewTarget,
        'Body': file_contents
      }, function (p_err) {
        if (p_err) return console.log(p_err, p_err.stack);
        var bucket = 'https://dt-dripmedia-upload.s3.amazonaws.com/';
        var full = bucket + fullTarget;
        var preview = bucket + previewTarget;
        console.log('Uploaded files:');
        console.log(full);
        console.log(preview);
      });
    });
  });
});
