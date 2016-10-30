/* global config, exports, require */
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();

function getUser (cognitoId, fn) {
  var projection = 'email';
  dynamodb.get({'TableName': config.DDB_USERS_TABLE,
                'ProjectionExpression': projection,
                'Key': {'cognitoId': cognitoId}}, function (err, user) {
    if (err) return fn('Internal Server Error:' + err);
    return user.Item ? fn(null, user.Item) : fn('Not Found: User');
  });
}


function getRegistered (userId, fn) {
	dynamodb.get({
		'TableName': config.DDB_REGISTERED_TABLE,
		'Key': {'email': userId}
	}, function (err, data) {
		if (err) return fn('Internal Server Error: ' + err);
		else if ('Item' in data) {
      fn(null, data.Item.verified, data.Item.verifyToken);
		} else {
				fn(null, null); // User not found
		}
	});
}

function setVerified (email, fn) {
	dynamodb.update({
			'TableName': config.DDB_REGISTERED_TABLE,
			'Key': {'email': email},
			'AttributeUpdates': {
				'verified': {'Action': 'PUT', 'Value': true},
				'verifyToken': {'Action': 'DELETE'}
			}
		},
		function (err, data) {
      if (err) return fn('Internal Server Error: ' + err);
      return fn(null, data);
    });
}

exports.handler = function (event, context) {
  var cognitoId = decodeURIComponent(event.userId);
	var verifyToken = event.token;

  getUser(cognitoId, function (uErr, user) {
    if (uErr) return context.fail(uErr);
    var email = user.email;
    getRegistered(email, function (err, verified, correctToken) {
      if (err) return	context.fail('Error in getRegistered: ' + err);
      if (verified) return context.succeed({'verified': true});
      if (verifyToken === correctToken) {
        // User verified
        setVerified(email, function (error) {
          if (error) return context.fail(error);
          context.succeed({'verified': true});
        });
      } else {
        // Wrong token, not verified
        context.fail('Forbidden: invalid token');
      }
    });
  });
};
