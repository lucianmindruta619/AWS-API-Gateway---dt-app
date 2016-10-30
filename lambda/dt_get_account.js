/* global config, exports, require */

// dependencies
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();

function getAccount (cognitoId, fn) {
  dynamodb.get({'TableName': config.DDB_USERS_TABLE,
                'ProjectionExpression': 'cognitoId, username, #name, counts, ' +
                                        'account',
                'ExpressionAttributeNames': {'#name': 'name'},
                'Key': {'cognitoId': cognitoId}}, function (err, user) {
    if (err) return fn('Internal Server Error:' + err);
    return user.Item ? fn(null, user.Item) : fn('Not Found: User');
  });
}

exports.handler = function (event, context) {
  var cognitoId = decodeURIComponent(event.identity.id);

  getAccount(cognitoId, function (err, user) {
    if (err) {
      return context.fail(err);
    } else {
      return context.succeed(user);
    }
  });
};
