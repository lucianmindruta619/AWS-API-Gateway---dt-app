/* global config, exports, require */

// dependencies
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();

function getUser (cognitoId, requestor, fn) {
  var projection = 'bio, username, profilePhoto, coverPhoto, website, counts' +
                   ', #name, cognitoId, updatedAt';
  if (requestor === cognitoId) projection += ', paypal, email';
  dynamodb.get({'TableName': config.DDB_USERS_TABLE,
                'ProjectionExpression': projection,
                'ExpressionAttributeNames': {'#name': 'name'},
                'Key': {'cognitoId': cognitoId}}, function (err, user) {
    if (err) return fn('Internal Server Error:' + err);
    return user.Item ? fn(null, user.Item) : fn('Not Found: User');
  });
}

exports.handler = function (event, context) {
  var userId = decodeURIComponent(event.userId);
  var requestor = event.identity.id;

  getUser(userId, requestor, function (err, user) {
    if (err) {
      return context.fail(err);
    } else {
      return context.succeed(user);
    }
  });
};
