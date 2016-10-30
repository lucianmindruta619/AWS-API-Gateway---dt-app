var AWS = require('aws-sdk');

var dynamodb = new AWS.DynamoDB();
var cognitoidentity = new AWS.CognitoIdentity();
var s3 = new AWS.S3();

var sns = new AWS.SNS();

function makeString(str) {
    return {
        'S': str.toString()
    };
}

function makeNumber(n) {
    return {
        'N': n.toString()
    };
}

function makeStringSet(s) {
    return {
        'SS': s
    };
}

function putString(str) {
    return {
        'Action': 'PUT',
        'Value': {
            'S': str.toString()
        }
    };
}

function putStringSet(set) {
    return {
        'Action': 'PUT',
        'Value': {
            'SS': set
        }
    };
}

function putNumber(str) {
    return {
        'Action': 'PUT',
        'Value': {
            'N': str.toString()
        }
    };
}

exports.handler = function(event, context) {

    var res = event;

    var req = {};

    var nowT = (new Date().getTime().toString());

    if (!res.deviceType)
        context.succeed("missing deviceType");

    if (!res.IdentityId)
        context.succeed("missing IdentityId");

    if (!res.idToken)
        context.succeed("missing idToken");

    if (!res.deviceToken)
        context.succeed("missing deviceToken");

    var params = {
        RequestItems: { /* required */
            'dripthat_user': {
                Keys: [ /* required */ {
                        IdentityId: { /* AttributeValue */
                            S: res.IdentityId
                        },
                    },
                    /* more items */
                ],
                ConsistentRead: false,
                ProjectionExpression: 'idToken, expDate'
            }
        },
        ReturnConsumedCapacity: 'NONE'
    };
    dynamodb.batchGetItem(params, function(err, data) {
        if (err) context.fail(err); // an error occurred
        else {

            if (!data.Responses.dripthat_user[0].idToken)
                context.succeed("no user found");

            if (data.Responses.dripthat_user[0].idToken.S != res.idToken || data.Responses.dripthat_user[0].expDate.N < nowT)
                context.succeed("bad idToken");

            if (data.Responses && data.Responses.dripthat_user) {

                var params = {
                    Name: res.IdentityId.replace(":", "_") /* required */
                };

                sns.createTopic(params, function(err, topic_data) {
                    if (err) {
                        console.log(err);
                        context.fail("error handling notification endpoint.");
                    } else {
                        var params = {
                            PlatformApplicationArn: 'arn:aws:sns:us-east-1:493526813836:app/APNS_SANDBOX/dripthat',
                            Token: res.deviceToken,
                        };
                        sns.createPlatformEndpoint(params, function(err, endpoint_data) {
                            if (err) {
                                console.log(err);
                                context.fail("something went wrong creating platform endpoint");
                            } else {
                                var params = {
                                    Protocol: 'application',
                                    TopicArn: topic_data.TopicArn,
                                    Endpoint: endpoint_data.EndpointArn
                                };
                                sns.subscribe(params, function(err, subscribe_data) {
                                    if (err) {
                                        console.log(err);
                                        context.fail(err);
                                    } else {
                                         context.succeed("successfully subscribed to push notifications");
                                    }
                                });
                            }
                        });
                    }
                });
            } else {
                context.fail('no responses');
            }
        }
    });
};
