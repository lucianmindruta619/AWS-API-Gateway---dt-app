/* global config, exports, require */
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();

function getDrip (dripId, ownerId, fn) {
  var createdAt = Number(dripId.slice(0, 13));
  var dripOwnerId = dripId.slice(13);
  if (dripOwnerId !== ownerId) return fn('User cannot access this drip');
  dynamodb.get({'TableName': config.DDB_DRIPS_TABLE,
                'Key': {'ownerId': ownerId, 'createdAt': createdAt}},
               function (err, drip) {
      if (err) return fn('Internal Server Error: ' + err);
      return drip.Item ? fn(null, drip.Item) : fn('Not Found: Drip');
  });
}

function updateDrip (drip, fn) {
  dynamodb.update({
    'TableName': config.DDB_DRIPS_TABLE,
    'Key': {'ownerId': drip.ownerId, 'createdAt': drip.createdAt},
    'AttributeUpdates': {
      'tags': {'Action': 'PUT', 'Value': drip.tags}
    }
  }, function (err, data) {
    if (err) return fn('Internal Server Error: ' + err);
    return fn(null, data);
  });
}

exports.handler = function (event, context) {
  var tags = event.tags;
  var dripId = decodeURIComponent(event.dripId);
  var ownerId = event.identity.id;
  if (typeof tags === 'undefined' || typeof dripId === 'undefined' ||
      typeof ownerId === 'undefined') {
    return context.fail('Bad Request: Missing parameters');
  }
  getDrip(dripId, ownerId, function (err, drip) {
    if (err) return context.fail(err);
    drip.tags = tags;
    updateDrip(drip, function (error) {
      if (error) return context.fail(error);
      context.succeed({"updated": drip});
    });
  });
};
