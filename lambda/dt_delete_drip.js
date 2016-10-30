/* global config, exports, require */
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();


function updateUser (cognitoId, fn) {
  dynamodb.get({'TableName': config.DDB_USERS_TABLE,
                'Key': {'cognitoId': cognitoId}}, function (err, user) {
    if (err) return fn('Internal Server Error:' + err);
    if (!user.Item) return fn('Not Found: User');
    user.Item.counts.publishedDrips -= 1;
    dynamodb.update({
      'TableName': config.DDB_USERS_TABLE,
      'Key': {'cognitoId': cognitoId},
      'AttributeUpdates': {
        'counts': {'Action': 'PUT', 'Value': user.Item.counts}
      }
    }, function (uErr, data) {
      if (uErr) return fn('Internal Server Error: ' + err);
      return fn(null, data);
    });
  });
}

function getDrip (dripId, ownerId, fn) {
  var createdAt = Number(dripId.slice(0, 13));
  var dripownerId = dripId.slice(13);
  if (dripownerId !== ownerId) return fn('User cannot access this drip');
  dynamodb.get({'TableName': config.DDB_DRIPS_TABLE,
                'Key': {'ownerId': ownerId, 'createdAt': createdAt}},
               function (err, drip) {
      if (err) return fn('Internal Server Error: ' + err);
      return drip.Item ? fn(null, drip.Item) : fn('Not Found: Drip');
  });
}

function deleteDrip (drip, fn) {
  var now = new Date().getTime();
  var cognitoId = drip.ownerId;
  drip.deletedAt = now;
  dynamodb.update({
    'TableName': config.DDB_DRIPS_TABLE,
    'Key': {'ownerId': drip.ownerId, 'createdAt': drip.createdAt},
    'AttributeUpdates': {
      'deletedAt': {'Action': 'PUT', 'Value': now}
    }
  }, function (dErr, data) {
    if (dErr) return fn('Internal Server Error: ' + dErr);
    updateUser(cognitoId, function (uErr) {
      if (uErr) return fn(uErr);
      return fn(null, data);
    });
  });
}

exports.handler = function (event, context) {
  var dripId = decodeURIComponent(event.dripId);
  var ownerId = event.identity.id;
  if (typeof ownerId === 'undefined' || typeof dripId === 'undefined')
    return context.fail('Bad Request: Missing parameters');
  getDrip(dripId, ownerId, function (err, drip) {
    if (err) return context.fail(err);
    deleteDrip(drip, function (error) {
      if (error) return context.fail(error);
      context.succeed({"deleted": drip});
    });
  });
};
