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

gulp.task('simulate-get-user', function () {
  var stage_uri = process.env.DT_STAGE_URI;
  var cognitoId = 'us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09';

  var uri = stage_uri + '/users/' + cognitoId;

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


gulp.task('simulate-update-user', function () {
  var stage_uri = process.env.DT_STAGE_URI;
  var cognitoId = 'us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09';

  var uri = stage_uri + '/users/' + cognitoId;

  var params = {
    'method': 'PATCH',
    'uri': uri,
    'json': true,
    'body': {'name': 'Panos', 'username': 'pmichail', 'bio': ''}
  };

  iamRequest(params, function (error, response, body) {
    if (error) return console.log(error);
    console.log('Request: ' + response.request.href);
    console.log('Response: ' + response.statusCode);
    console.log(body);
  });
});

gulp.task('simulate-update-password', function () {
  var password = process.env.DT_AUTH_PASSWORD;
  var stage_uri = process.env.DT_STAGE_URI;
  var cognitoId = 'us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09';

  var uri = stage_uri + '/users/' + cognitoId + '/password';

  var params = {
    'method': 'PATCH',
    'uri': uri,
    'json': true,
    'body': {'old_password': password, 'new_password': password}
  };

  iamRequest(params, function (error, response, body) {
    if (error) return console.log(error);
    console.log('Request: ' + response.request.href);
    console.log('Response: ' + response.statusCode);
    console.log(body);
  });
});

gulp.task('simulate-profile-pic', function () {
  var session = JSON.parse(fs.readFileSync(process.env.DT_SESSION_FILE));
  var creds = session.sts.Credentials;
  var source = 'profile.jpg';
  var bucketname = 'dt-profilepics-upload';
  var cognitoId = 'us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09';
  var s3;

  var target = cognitoId + '.jpg';

  AWS.config.loadFromPath(process.env.DT_SESSION_FILE);
  AWS.config.update({'accessKeyId': creds.AccessKeyId,
                     'secretAccessKey': creds.SecretAccessKey,
                     'sessionToken': creds.SessionToken});

  fs.readFile(source, function (fs_err, file_contents) {
    if (fs_err) return console.log(fs_err);
    s3 = new AWS.S3();
    console.log('Putting object ' + source + ' in bucket ' + bucketname);

    s3.putObject({
      'Bucket': bucketname,
      'Key': target,
      'Body': file_contents
    }, function (err, data) {
      if (err) console.log(err); // an error occurred
      else {
        console.log(data);           // successful response
      }
    });
  });
});


gulp.task('simulate-cover-pic', function () {
  var session = JSON.parse(fs.readFileSync(process.env.DT_SESSION_FILE));
  var creds = session.sts.Credentials;
  var source = 'profile.jpg';
  var bucketname = 'dt-coverpics-upload';
  var cognitoId = 'us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09';
  var s3;

  var target = cognitoId + '.jpg';

  AWS.config.loadFromPath(process.env.DT_SESSION_FILE);
  AWS.config.update({'accessKeyId': creds.AccessKeyId,
                     'secretAccessKey': creds.SecretAccessKey,
                     'sessionToken': creds.SessionToken});

  fs.readFile(source, function (fs_err, file_contents) {
    if (fs_err) return console.log(fs_err);
    s3 = new AWS.S3();
    console.log('Putting object ' + source + ' in bucket ' + bucketname);

    s3.putObject({
      'Bucket': bucketname,
      'Key': target,
      'Body': file_contents
    }, function (err, data) {
      if (err) console.log(err, err.stack); // an error occurred
      else {
        console.log(data);           // successful response
      }
    });
  });
});


gulp.task('simulate-download-profile-pic', function () {
  var session = JSON.parse(fs.readFileSync(process.env.DT_SESSION_FILE));
  var creds = session.sts.Credentials;
  var bucketname = 'dt-profilepics';
  var filename = 'us-east-1:d0b11958-cd9e-4644-8680-bcb73cdbee09.jpg';
  var s3;

  AWS.config.loadFromPath(process.env.DT_SESSION_FILE);
  AWS.config.update({'accessKeyId': creds.AccessKeyId,
                     'secretAccessKey': creds.SecretAccessKey,
                     'sessionToken': creds.SessionToken});
  s3 = new AWS.S3();

  s3.getObject({
    'Bucket': bucketname,
    'Key': filename
  }, function (err, data) {
    if (err) console.log(err); // an error occurred
    else {
      console.log(data);           // successful response
    }
  });
});
