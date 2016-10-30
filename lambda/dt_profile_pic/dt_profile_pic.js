/* global console, config, exports, require */
// dependencies
var async = require('async');
var AWS = require('aws-sdk');
var gm = require('gm')
            .subClass({'imageMagick': true});
var dynamodb = new AWS.DynamoDB.DocumentClient();

// constants
var MAX_WIDTH = 250;
var MAX_HEIGHT = 250;

// get reference to S3 client
var s3 = new AWS.S3();

function getUser (cognitoId, fn) {
  dynamodb.get({'TableName': config.DDB_USERS_TABLE,
                'Key': {'cognitoId': cognitoId}}, function (err, user) {
    if (err) return fn(err);
    return user.Item ? fn(null, user.Item) : fn('User not found');
  });
}


function transformPic (user, srcBucket, srcKey, dstBucket, dstKey, imageType,
                       fn) {
  // Download the image from S3, transform,
  // and upload to a different S3 bucket.
  async.waterfall([
    function download (next) {
        // Download the image from S3 into a buffer.
        s3.getObject({'Bucket': srcBucket, 'Key': srcKey}, next);
    },
    function transform (response, next) {
      gm(response.Body).size(function (error, size) {
        var height, scalingFactor, width;
        if (error) return fn(error);
        // Infer the scaling factor to avoid
        // stretching the image unnaturally.
        scalingFactor = Math.min(MAX_WIDTH / size.width,
                                 MAX_HEIGHT / size.height);
        width = scalingFactor * size.width;
        height = scalingFactor * size.height;

        // Transform the image buffer in memory.
        this.resize(width, height)
          .toBuffer(imageType, function (err, buffer) {
            if (err) next(err);
            else next(null, response.ContentType, buffer);
          });
      });
    },
    function upload (contentType, data, next) {
      // Stream the transformed image to a different S3 bucket.
      s3.putObject({'Bucket': dstBucket, 'Key': dstKey, 'Body': data,
                    'ContentType': contentType}, next);
    }
  ], function (err) {
    var photoUrl;
    if (err) {
      return fn('Unable to resize ' + srcBucket + '/' + srcKey +
                ' and upload to ' + dstBucket + '/' + dstKey +
                ' due to an error: ' + err);
    } else {
      console.log('Successfully resized ' + srcBucket + '/' + srcKey +
                 ' and uploaded to ' + dstBucket + '/' + dstKey);
      photoUrl = 'https://' + dstBucket + '.s3.amazonaws.com/' + dstKey;
      var now = new Date().getTime();
      dynamodb.update({
        'TableName': config.DDB_USERS_TABLE,
        'Key': {'cognitoId': user.cognitoId},
        'AttributeUpdates': {
          'updatedAt': {'Action': 'PUT', 'Value': now},
          'profilePhoto': {
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
    transformPic(user, srcBucket, srcKey, dstBucket, dstKey, imageType,
                 function (err) {
      if (err) context.fail(err);
      context.succeed();
    });
  });
};
