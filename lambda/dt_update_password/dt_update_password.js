/* global config, exports, require */
var AWS = require('aws-sdk');
var bcrypt = require('bcrypt');
var dynamodb = new AWS.DynamoDB.DocumentClient();
var cognito = new AWS.CognitoIdentity();

function cognitoIdToEmail (cognitoId, fn) {
  var params = {
    'IdentityPoolId': config.IDENTITY_POOL_ID,
    'IdentityId': cognitoId,
    'MaxResults': 1
  };
  cognito.lookupDeveloperIdentity(params, function (err, data) {
    if (err) return fn('Internal Server Error: ' + err);
    return fn(null, data.DeveloperUserIdentifierList[0]);
  });
}

function getUserFromCognitoId (cognitoId, fn) {
  cognitoIdToEmail(cognitoId, function (error, email) {
    if (error) return fn(error);
    dynamodb.get({'TableName': config.DDB_REGISTERED_TABLE,
                  'Key': {'email': email}}, function (err, user) {
      if (err) return fn('Internal Server Error: ' + err);
      return user.Item ? fn(null, user.Item) : fn('Not Found: User');
    });
  });
}

function setPassword (newPassword, user, fn) {
  bcrypt.hash(newPassword, 10, function (error, hash) {
    if (error) return fn('Internal Server Error: ' + error);
    dynamodb.update({
      'TableName': config.DDB_REGISTERED_TABLE,
      'Key': {'email': user.email},
      'AttributeUpdates': {'passwordHash':
                           {'Action': 'PUT', 'Value': hash}}
    }, function (err, data) {
      if (err) return fn('Internal Server Error: ' + err);
      return fn(null, data);
    });
  });
}

exports.handler = function (event, context) {
  var oldPassword = event.old_password;
  var newPassword = event.new_password;
  var cognitoId = event.identity.id;
  var userId = decodeURIComponent(event.userId);

  if (typeof oldPassword === 'undefined' || typeof cognitoId === 'undefined'
      || typeof newPassword === 'undefined') {
    return context.fail('Bad Request: Missing parameters');
  }

  if (userId !== cognitoId) {
    return context.fail('Forbidden: User cannot access this profile');
  }

  getUserFromCognitoId(cognitoId, function (err, user) {
    if (err) return context.fail(err);
    bcrypt.compare(oldPassword, user.passwordHash, function (h_err, res) {
      if (h_err) return context.fail(h_err);
      if (!res) return context.fail('Forbidden: Invalid old password');
      setPassword(newPassword, user, function (error) {
        if (error) context.fail(error);
        context.succeed({'updated': true});
      });
    });
  });
};
