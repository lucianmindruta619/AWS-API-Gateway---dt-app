/* global console, config, exports, require */
// dependencies
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();

// get reference to S3 client
var s3 = new AWS.S3();

function getDrip (dripId, fn) {
  var createdAt = Number(dripId.slice(0, 13));
  var ownerId = dripId.slice(13);
  dynamodb.get({'TableName': config.DDB_DRIPS_TABLE,
                'Key': {'ownerId': ownerId, 'createdAt': createdAt}},
               function (err, drip) {
      if (err) return fn('Internal Server Error:' + err);
      return drip.Item ? fn(null, drip.Item) : fn('Not Found: Drip');
  });
}

function updateDrip (drip, fn) {
  dynamodb.update({
    'TableName': config.DDB_DRIPS_TABLE,
    'Key': {'ownerId': drip.ownerId, 'createdAt': drip.createdAt},
    'AttributeUpdates': {
      'media': {'Action': 'PUT', 'Value': drip.media}
    }
  }, function (err, data) {
    if (err) return fn('Internal Server Error: ' + err);
    return fn(null, data);
  });
}

function moveFile (srcBucket, srcKey, dstBucket, dstKey, fn) {
  var message = "copying '" + srcKey + "' from '" + srcBucket +
                "' to '" + dstBucket + "/" + dstKey + "'";
  var params = {
    'Bucket': dstBucket,
    'Key': dstKey,
    'CopySource': encodeURIComponent(srcBucket + '/' + srcKey),
    'MetadataDirective': 'COPY',
    'ACL': 'public-read'
  };
  s3.copyObject(params, function (err) {
      if (err) {
        console.log('Error ' + message, err, err.stack); // an error occurred
        return fn('Error ' + message);
      }
      fn();
  });
}

function moveMedia (toMove, fn) {
  moveFile(toMove.srcBucket, toMove.srcPreviewKey, toMove.dstBucket,
            toMove.dstPreviewKey, function (err) {
    if (err) return fn(err);
    moveFile(toMove.srcBucket, toMove.srcFullKey, toMove.dstBucket,
              toMove.dstFullKey, function (pErr) {
      if (pErr) return fn(pErr);
      return fn();
    });
  });
}

exports.handler = function (event, context) {
  var toMove = JSON.parse(event.Records[0].Sns.Message);

  getDrip(toMove.dripId, function (dErr, drip) {
    if (dErr) context.fail(dErr);
    moveMedia(toMove, function (mErr) {
      if (mErr) context.fail(mErr);

      drip.media.forEach(function (media) {
        if (media.full_url === toMove.full_url) {
          media.processed = true;
        }
      });

      updateDrip(drip, function (uErr) {
        if (uErr) context.fail(uErr);
        context.succeed();
      });
    });
  });
};
