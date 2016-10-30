/* global console, process, require */
var AWS = require('aws-sdk');
var url = require('url');
var aws4 = require('aws4');
var fs = require('fs');
var gulp = require('gulp');
var request = require('request');

require('dotenv').load();

function assumeRoleWithWebIdentity (role, roleSessionName, cognitoId,
                                    duration, fn) {
  console.log(cognitoId);
  var sts = new AWS.STS();
  var params = {'RoleArn': role,
                'RoleSessionName': roleSessionName,
                'WebIdentityToken': cognitoId.Token,
                'DurationSeconds': duration};
  sts.assumeRoleWithWebIdentity(params, function (err, data) {
    if (err) return fn(err);
    console.log('Role ' + role + ' assumed!');
    console.log(data);
    writeSessionToFile({'role': role, 'cognitoId': cognitoId,
                        'roleSessionName': roleSessionName, 'sts': data});
    fn(null, data);
  });
}

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

function writeSessionToFile (session) {
  fs.writeFile(process.env.DT_SESSION_FILE,
               JSON.stringify(session, null, 2),
               function (err) {
      if (err) {
        return console.log(err);
      }
      console.log("AWS credentials stored at " + process.env.DT_SESSION_FILE);
  });
}

gulp.task('simulate-refresh', function () {
  var session = JSON.parse(fs.readFileSync(process.env.DT_SESSION_FILE));
  var role = session.role;
  var roleSessionName = session.roleSessionName;
  assumeRoleWithWebIdentity(role, roleSessionName, session.cognitoId,
                            process.env.DT_AUTH_DURATION,
                                function (sts_err) {
    if (sts_err) return console.log(sts_err, sts_err.stack);
  });
});

gulp.task('simulate-unauth', function () {
  var cognito = new AWS.CognitoIdentity();
  var param = {
    'IdentityPoolId': process.env.IDENTITY_POOL_ID
  };
  var roleSessionName = 'guest';
  var role = process.env.DT_UNAUTH_ROLE;
  cognito.getId(param, function (err, cognitoId) {
    if (err) return console.log(err);
    cognito.getOpenIdToken(cognitoId, function (error, data) {
      if (error) return console.log(error);
      assumeRoleWithWebIdentity(role, roleSessionName, data,
                                process.env.DT_AUTH_DURATION,
                                function (sts_err) {
        if (sts_err) return console.log(sts_err, sts_err.stack);
      });
    });
  });
});

gulp.task('simulate-login', function () {
  var username = process.env.DT_AUTH_USER;
  var password = process.env.DT_AUTH_PASSWORD;
  var role = process.env.DT_AUTH_ROLE;
  var options = {
    'method': 'POST',
    'uri': process.env.DT_STAGE_URI + '/sessions',
    'json': true,
    'body': {'email': username, 'password': password}
  };
  console.log('Logging in as ' + username + ':' + password + '...');
  iamRequest(options, function (error, response, body) {
      if (error) {
        console.log(error);
        return;
      }
      if (response.statusCode !== 200) {
        console.log(body);
      } else {
        if (!body.Login) {
          console.log(body);
          return;
        }
        console.log('Logged in as ' + username + ' (' + body.IdentityId + ')');
        console.log('Assuming role ' + role);
        assumeRoleWithWebIdentity(role, username, body,
                                  process.env.DT_AUTH_DURATION,
                                  function (err) {
          if (err) console.log(err, err.stack);
        });
      }
    });
});


gulp.task('simulate-signup', function () {
  var email = process.env.DT_AUTH_USER;
  var password = process.env.DT_AUTH_PASSWORD;
  console.log('Signing up...');
  iamRequest({
    'method': 'POST',
    'uri': process.env.DT_STAGE_URI + '/users',
    'json': true,
    'body': {'email': 'panos_wert3@gmail.com', 'password': password,
             'username': 'superman2'}
    }, function (error, response, body) {
      if (error) return console.log(error);
      console.log('Request: ' + response.request.href);
      console.log('Response: ' + response.statusCode);
      console.log(body);
    });
});

gulp.task('simulate-verify', function () {
  var username = process.env.DT_AUTH_USER;
  var token = 'panos';
  var stage_uri = process.env.DT_STAGE_URI;
  username = 'us-east-1:5c402aa1-1c81-4325-bffb-e98ca1f58d6f'
  console.log('Signing up...');
  iamRequest({
    'method': 'POST',
    'uri': stage_uri + '/users/' + username + '/verify',
    'json': true,
    'body': {'token': token}
    }, function (error, response, body) {
      if (error) return console.log(error);
      console.log('Request: ' + response.request.href);
      console.log('Response: ' + response.statusCode);
      console.log(body);
    });
});
