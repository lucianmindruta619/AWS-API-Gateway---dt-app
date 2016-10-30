/* global config, exports, require */
var AWS = require('aws-sdk');
var bcrypt = require('bcrypt');
var cognito = new AWS.CognitoIdentity();
var dynamodb = new AWS.DynamoDB.DocumentClient();

function getUser (email, fn) {
  dynamodb.get({
    'TableName': config.DDB_REGISTERED_TABLE,
    'Key': {'email': email}
  }, function (err, data) {
    if (err) return fn('Internal Server Error: ' + err);
    else {
      fn(null, data.Item);
    }
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
  if (typeof email === 'undefined' || typeof clearPassword === 'undefined') {
    return context.fail('Bad Request: Missing parameters [email, password]');
  }

  getUser(email, function (err, user) {
    if (err) return context.fail(err);
    if (user) {
      bcrypt.compare(clearPassword, user.passwordHash, function (h_err, res) {
        if (h_err) return context.fail('Internal Server Error: ' + h_err);
        if (res === false) return context.succeed({'Login': false});
        getToken(email, function (error, identityId, token) {
          if (error) context.fail(err);
          context.succeed({'Login': true, 'IdentityId': identityId,
                           'Token': token});
        });
      });
    } else {
      return context.succeed({'Login': false});
    }
  });
};
