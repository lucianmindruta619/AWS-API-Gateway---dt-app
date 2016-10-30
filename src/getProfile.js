var AWS = require('aws-sdk');

var dynamodb = new AWS.DynamoDB();
var cognitoidentity = new AWS.CognitoIdentity();
var s3 = new AWS.S3();
var cognitosync = new AWS.CognitoSync();

exports.handler = function(event, context) {

    var res = event;

    var nowT = (new Date().getTime().toString());

    if(!res.userId && res.IdentityId)
        res.userId=res.IdentityId;
    else if(!res.userId && !res.IdentityId)
        context.succeed("missing IdentityId/userId to retrieve");

    var params = {
        RequestItems: { /* required */
            'dripthat_user': {
                Keys: [ /* required */ {
                        IdentityId: { /* AttributeValue */
                            S: res.userId
                        },
                    },
                    /* more items */
                ],
                ConsistentRead: false,
                ProjectionExpression: 'profileImage, userName, displayName, createdAt'
            }
        },
        ReturnConsumedCapacity: 'NONE'
    };
    dynamodb.batchGetItem(params, function(err, data) {
        if (err) context.fail(err); // an error occurred
        else {
            if (data.Responses && data.Responses.dripthat_user) {
                context.succeed(data.Responses.dripthat_user[0]);
            } else {
                context.fail('No Responses');
            }
        }
    });
}