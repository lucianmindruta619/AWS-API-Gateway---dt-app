var AWS = require('aws-sdk');

var accessKeyId = "AKIAISJOPX5RLW5PS25Q";
var secretAccessKey = "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";

AWS.config.update({
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey
});

var dynamodb = new AWS.DynamoDB();
var cognitoidentity = new AWS.CognitoIdentity();

var s3 = new AWS.S3();

exports.handler = function(event, context) {
    var checker = event;

    var req = {};

    req.params = {};
    var theDate = new Date().getTime().toString();

    if (!checker.mediaType) {
        context.succeed("missing mediaType");
    }

    if (checker.mediaType == "image/jpeg") {
        checker.mediaFile = "jpg";
    } else if (checker.mediaType == "image/gif") {
        checker.mediaFile = "gif";
    } else if (checker.mediaType == "video/mp4") {
        checker.mediaFile = "mp4";
    } else{
        context.succeed("invalid mime type");
    }

    var kkey = String(checker.IdentityId.replace(":","_") + "/" + theDate + "/media." + checker.mediaFile);

    var param = {
        ACL:"public-read",
        Bucket: 'media.dripthat.com',
        Key: kkey,
        ContentType: checker.mediaType,
        Body: (new Buffer(checker.media, 'base64'))
    };

    s3.upload(param, function(err, s3_data) {
        if (err) {
            context.fail(err);
        } else {
            // successful response
            context.succeed({
                "key": {
                    'S' : kkey
                }
            });
        }
    });
};