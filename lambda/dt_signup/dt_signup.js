/* global config, env, exports, require */
var AWS = require('aws-sdk');
AWS.config.region = config.REGION;
var bcrypt = require('bcrypt');
var crypto = require('crypto');
var request = require('request');
var dynamodb = new AWS.DynamoDB.DocumentClient();
var cognito = new AWS.CognitoIdentity();


function assertNoUser (cognitoId, fn) {
  dynamodb.get({'TableName': config.DDB_USERS_TABLE,
                'Key': {'cognitoId': cognitoId}}, function (err, user) {
    if (err) return fn('Internal Server Error:' + err);
    return user.Item ? fn('Forbidden: User ' + cognitoId + ' exists') : fn();
  });
}

function assertNoRegistration (email, fn) {
  dynamodb.get({'TableName': config.DDB_REGISTERED_TABLE,
                'Key': {'email': email}}, function (err, user) {
    if (err) return fn('Internal Server Error:' + err);
    return user.Item ? fn('Forbidden: User ' + email + ' exists') : fn();
  });
}

function assertNoUsername (username, fn) {
  dynamodb.get({'TableName': config.DDB_USERNAMES_TABLE,
                'Key': {'username': username}}, function (err, user) {
    if (err) return fn('Internal Server Error:' + err);
    return user.Item ? fn('Forbidden: User ' + username + ' exists') : fn();
  });
}

function getCognitoId (email, fn) {
  var param = {
    'IdentityPoolId': config.IDENTITY_POOL_ID,
    'Logins': {} // To have provider name in a variable
  };
  param.Logins[config.DEVELOPER_PROVIDER_NAME] = email;
  cognito.getOpenIdTokenForDeveloperIdentity(param,
    function (err, data) {
      if (err) return fn('Internal Server Error: ' + err); // an error occurred
      else fn(null, data.IdentityId, data.Token); // successful response
    });
}

function validate (email, username, clearPassword, fn) {
  var len = 128;
  bcrypt.hash(clearPassword, 10, function (error, hash) {
    if (error) return fn('Internal Server Error: ' + error);
    crypto.randomBytes(len, function (err, token) {
      if (err) return fn('Internal Server Error: ' + err);
      getCognitoId(email, function (cognito_error, cognitoId) {
        if (cognito_error) return fn(cognito_error);
        assertNoRegistration(email, function (rErr) {
          if (rErr) return fn(rErr);
          assertNoUser(cognitoId, function (uErr) {
            if (uErr) return fn(uErr);
            assertNoUsername(username, function (unErr) {
              if (unErr) return fn(unErr);
              var data, now = new Date().getTime();
              token = token.toString('hex');
              data = {'cognitoId': cognitoId,
                      'email': email,
                      'passwordHash': hash,
                      'username': username,
                      'verified': false,
                      'verifyToken': token,
                      'createdAt': now
              };
              return fn(null, data);
            });
          });
        });
      });
    });
  });
}

function storeUser (cognitoId, email, username, fn) {
  var now = new Date().getTime(), usr_data;
  usr_data = {'cognitoId': cognitoId,
              'email': email,
              'username': username,
              'name': null,
              'bio': null,
              'profilePhoto':
                'https://s3.amazonaws.com/dt-profilepics/default.jpg',
              'coverPhoto':
                'https://s3.amazonaws.com/dt-coverpics/default.jpg',
              'website': null,
              'dob': null,
              'cell': null,
              'sex': null,
              'paypal': null,
              'createdAt': now,
              'updatedAt': now,
              'account': {'sales': 0, 'purchases': 0,
                          'revenue': {'dripcoins': 0, 'dollarCents': 0},
                          'balance': {'dripcoins': 500, 'dollarCents': 0}},
              'counts': {'createdDrips': 0,
                        'purchasedDrips': 0,
                        'publishedDrips': 0,
                        'upVotes': 0,
                        'downVotes': 0}
  };
  dynamodb.put({
    'TableName': config.DDB_USERS_TABLE,
    'Item': usr_data,
    'ConditionExpression': 'attribute_not_exists (cognitoId)'
  }, function (err) {
    if (err) {
      if (err.code === 'ConditionalCheckFailedException') {
        return fn('Forbidden: User exists');
      }
      return fn('Internal Server Error: ' + err);
    }
    return fn(null, usr_data);
  });
}


function storeUsername (username, cognitoId, fn) {
  dynamodb.put({
    'TableName': config.DDB_USERNAMES_TABLE,
    'Item': {'username': username, 'cognitoId': cognitoId},
    'ConditionExpression': 'attribute_not_exists (username)'
  }, function (err) {
    if (err) {
      if (err.code === 'ConditionalCheckFailedException') {
        return fn('Forbidden: Username ' + username + ' exists');
      }
      return fn('Internal Server Error: ' + err);
    }
    return fn();
  });
}

function deleteAll (user, fn) {
  dynamodb.delete({'TableName': config.DDB_REGISTERED_TABLE,
                   'Key': {'email': user.email}}, function (err) {
    if (err) { return fn('Internal Server Error: ' + err);}
    dynamodb.delete({'TableName': config.DDB_USERNAMES_TABLE,
                     'Key': {'username': user.username}},
                    function (uname_err) {
      if (uname_err) return fn(uname_err);
      dynamodb.delete({'TableName': config.DDB_USERS_TABLE,
                       'Key': {'cognitoId': user.cognitoId}},
                      function (c_err) {
        if (c_err) return fn(c_err);
        return fn(null);
      });
    });
  });
}

function storeAll (user, fn) {
  dynamodb.put({
    'TableName': config.DDB_REGISTERED_TABLE,
    'Item': user,
    'ConditionExpression': 'attribute_not_exists (email)'
  }, function (err) {
    if (err) {
      if (err.code === 'ConditionalCheckFailedException') {
        return fn('Forbidden: User ' + user.email + ' exists');
      }
      return fn('Internal Server Error: ' + err);
    }
    var shouldCleanup = true;
    storeUsername(user.username, user.cognitoId, function (uname_err) {
      if (uname_err) return fn(uname_err, shouldCleanup);
      storeUser(user.cognitoId, user.email, user.username,
                function (c_err, usr_data) {
        if (c_err) return fn(c_err, shouldCleanup);
        return fn(null, shouldCleanup, usr_data);
      });
    });
  });
}

function sendToCustomerIO (data, fn) {
  var options = {
    'method': 'PUT', 'json': true,
    'uri': 'https://track.customer.io/api/v1/customers/' + data.email,
    'body': data,
    'auth': {
        'username': env.CUSTOMERIO_USER,
        'password': env.CUSTOMERIO_PASSWORD
    }
  };

  request(options, function (cio_error, response, body) {
    if (cio_error) return fn('Internal Server Error: ' +
                             JSON.stringify(cio_error));
    if (response.statusCode !== 200) {
      return fn('Internal Server Error: ' + body);
    }
    fn();
  });
}

function getToken (email, fn) {
  var param = {
    'IdentityPoolId': config.IDENTITY_POOL_ID,
    'Logins': {} // To have provider name in a variable
  };
  param.Logins[config.DEVELOPER_PROVIDER_NAME] = email;
  cognito.getOpenIdTokenForDeveloperIdentity(param,
    function (err, data) {
      if (err) return fn('Internal Server Error: ' + err); // an error occurred
      else fn(null, data.IdentityId, data.Token); // successful response
    });
}

exports.handler = function (event, context) {
  var email = event.email;
  var clearPassword = event.password;
  var username = event.username;
  if (typeof email === 'undefined' || typeof clearPassword === 'undefined'
      || typeof username === 'undefined') {
    return context.fail('Bad Request: Missing parameters');
  }
  validate(email, username, clearPassword, function (err, user) {
    if (err) return context.fail(err);
    storeAll(user, function (error, shouldCleanup, usr_data) {
      var data;
      if (error) {
        if (shouldCleanup) {
          deleteAll(user, function (dErr) {
            if (dErr) return context.fail(dErr);
            return context.fail(error);
          });
        } else {
          return context.fail(error);
        }
      } else {
        data = {'email': user.email, 'username': user.username,
                'cognitoId': usr_data.cognitoId,
                'createdAt': usr_data.createdAt,
                'name': user.name, 'verifyToken': user.verifyToken};

        sendToCustomerIO(data, function (cio_error) {
          if (cio_error) return context.fail(cio_error);
          delete user.hash;
          delete user.passwordHash;
          delete user.verifyToken;
          getToken(email, function (tErr, identityId, token) {
            if (tErr) return context.fail(tErr);
            context.succeed({'user': user, 'IdentityId': identityId,
                             'Token': token});
          });
        });
      }
    });
  });
};
