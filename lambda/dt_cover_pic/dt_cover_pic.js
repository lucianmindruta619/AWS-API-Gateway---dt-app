/* global console, config, exports, require */
// dependencies
var AWS = require('aws-sdk');
var dynamodb = new AWS.DynamoDB.DocumentClient();

// get reference to S3 client
var s3 = new AWS.S3();

function getUser (cognitoId, fn) {
  dynamodb.get({'TableName': config.DDB_USERS_TABLE,
                'Key': {'cognitoId': cognitoId}}, function (err, user) {
    if (err) return fn(err);
    return user.Item ? fn(null, user.Item) : fn('User not found');
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


function movePic (user, srcBucket, srcKey, dstBucket, dstKey, imageType,
                       fn) {
  moveFile(srcBucket, srcKey, dstBucket, dstKey, function (err) {
    var photoUrl;
    if (err) {
      return fn('Unable to copy ' + srcBucket + '/' + srcKey +
                ' and upload to ' + dstBucket + '/' + dstKey +
                ' due to an error: ' + err);
    } else {
      console.log('Successfully copied ' + srcBucket + '/' + srcKey +
                 ' and uploaded to ' + dstBucket + '/' + dstKey);
      photoUrl = 'https://' + dstBucket + '.s3.amazonaws.com/' + dstKey;
      var now = new Date().getTime();
      dynamodb.update({
        'TableName': config.DDB_USERS_TABLE,
        'Key': {'cognitoId': user.cognitoId},
        'AttributeUpdates': {
          'updatedAt': {'Action': 'PUT', 'Value': now},
          'coverPhoto': {
            'Action': 'PUT',
            'Value': photoUrl}}
      }, function (db_err) {
        if (db_err) return fn(db_err);
        return fn();
      });
    }
  });
}


exports.handler = function (event, context) {
  // Read options from the event.
  var userId;
  var srcBucket = event.Records[0].s3.bucket.name;
  // Object key may have spaces or unicode non-ASCII characters.
  var srcKey =
    decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
  var dstBucket = srcBucket.slice(0, -7); // remove the '-upload' suffix
  var dstKey = srcKey;
  var typeMatch = srcKey.match(/\.([^.]*)$/);
  var imageType;

  // Sanity check: validate that source and destination are different buckets.
  if (srcBucket === dstBucket) {
      return context.fail(
        "Destination bucket must not match source bucket.");
  }

  // Infer the image type.
  if (!typeMatch) {
      return context.fail('unable to infer image type for key ' + srcKey);
  }
  imageType = typeMatch[1];
  if (imageType !== "jpg" && imageType !== "png") {
      return context.fail('skipping non-image ' + srcKey);
  }
  userId = srcKey.slice(0, -imageType.length - 1);
  getUser(userId, function (user_err, user) {
    if (user_err) context.fail('Cannot find user: ' + userId);
    movePic(user, srcBucket, srcKey, dstBucket, dstKey, imageType,
                 function (err) {
      if (err) context.fail(err);
      context.succeed();
    });
  });
};
