/* global config, exports, require */
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();
var _ = require('lodash');
var async = require('async');

function updateUser (cognitoId, fn) {
  dynamodb.get({'TableName': config.DDB_USERS_TABLE,
                'Key': {'cognitoId': cognitoId}}, function (err, user) {
    if (err) return fn('Internal Server Error:' + err);
    if (!user.Item) return fn('Not Found: User');
    user.Item.counts.publishedDrips += 1;
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
  var dripOwnerId = dripId.slice(13);
  if (dripOwnerId !== ownerId) return fn('User cannot access this drip');
  dynamodb.get({'TableName': config.DDB_DRIPS_TABLE,
                'Key': {'ownerId': ownerId, 'createdAt': createdAt}},
               function (err, drip) {
      if (err) return fn('Internal Server Error:' + err);
      return drip.Item ? fn(null, drip.Item) : fn('Not Found: Drip');
  });
}

function updateDrip (drip, fn) {
  var now = new Date().getTime();
  dynamodb.update({
    'TableName': config.DDB_DRIPS_TABLE,
    'Key': {'ownerId': drip.ownerId, 'createdAt': drip.createdAt},
    'AttributeUpdates': {
      'media': {'Action': 'PUT', 'Value': drip.media},
      'counts': {'Action': 'PUT', 'Value': drip.counts},
      'publishedAt': {'Action': 'PUT', 'Value': now}
    }
  }, function (err, data) {
    if (err) return fn('Internal Server Error: ' + err);
    updateUser(drip.ownerId, function (uErr) {
      if (uErr) return fn(uErr);
      return fn(null, data);
    });
  });
}

function moveDescriptor (item, re, ownerId, dripId) {
  var srcBucket = 'dt-dripmedia-upload';
  var key_re = new RegExp("^https://[^/]*/(.*)$");
  var srcPreviewKey = item.preview_url.match(key_re)[1];
  var srcFullKey = item.full_url.match(key_re)[1];
  var dstBucket = 'dt-dripmedia';
  var domain = item.full_url.match(re)[1];
  var full_filename = item.full_url.match(re)[2];
  var preview_filename = item.preview_url.match(re)[2];
  var targetURI = 'https://' + dstBucket + domain + '/' + dripId + '/';
  return {
    'move': {
      'ownerId': ownerId,
      'dripId': dripId,
      'srcBucket': srcBucket,
      'dstBucket': dstBucket,
      'srcPreviewKey': srcPreviewKey,
      'srcFullKey': srcFullKey,
      'dstPreviewKey': dripId + '/' + preview_filename,
      'dstFullKey': dripId + '/' + full_filename,
      'preview_url': targetURI + preview_filename,
      'full_url': targetURI + full_filename
    },
    'target': {
      'preview_url': targetURI + preview_filename,
      'full_url': targetURI + full_filename,
      'locked': item.locked,
      'processed': false
    },
    'source': item
  };
}

function publishToSNS (aMove, fn) {
  var sns = new AWS.SNS();
  var params = {
      'Message': JSON.stringify(aMove),
      'TopicArn': config.SNS_MEDIA_TOPIC
  };
  sns.publish(params, function (err) {
    if (err) fn('Internal Server Error: SNS:' + err);
    fn(null);
  });
}

exports.handler = function (event, context) {
  var media = event.media;
  var dripId = decodeURIComponent(event.dripId);
  var ownerId = event.identity.id;

  if (typeof media === 'undefined' || typeof dripId === 'undefined' ||
      typeof ownerId === 'undefined') {
    return context.fail('Bad Request: Missing parameters');
  }

  if (media.constructor !== Array) {
    return context.fail('Bad Request: Media should be an array');
  }

  var toMove = [];
  var re = new RegExp("^https://dt-dripmedia-upload([^/]*)/" + ownerId +
                      "/(.*)$");

  media.forEach(function (item) {
    if (!(item.hasOwnProperty('preview_url') &&
          item.hasOwnProperty('full_url') &&
          item.hasOwnProperty('locked'))) {
      return context.fail('Bad Request: Missing media parameters');
    }

    if (!re.test(item.preview_url)) {
      return context.fail('Forbidden: Invalid source bucket');
    }
    if (!re.test(item.full_url)) {
      return context.fail('Forbidden: Invalid source bucket');
    }
    toMove.push(moveDescriptor(item, re, ownerId, dripId));
  });


  getDrip(dripId, ownerId, function (err, drip) {
    if (err) return context.fail(err);
    var toAdd = _.map(toMove, function (item) {
      return item.target;
    });

    drip.media = toAdd;
    drip.counts.mediasAttached = drip.media.length;
    updateDrip(drip, function (error) {
      if (error) return context.fail(error);
      async.each(_.pluck(toMove, 'move'), publishToSNS, function (sns_err) {
        if (sns_err) return context.fail(sns_err);
        context.succeed({"updated": drip});
      });
    });
  });
};
