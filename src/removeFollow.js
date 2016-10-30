console.log('Loading remove follow event');
var AWS = require('aws-sdk');

var dynamodb = new AWS.DynamoDB();
var cognitoidentity = new AWS.CognitoIdentity();
var s3 = new AWS.S3();

var tableName = "dripthat";

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

    if (!res.IdentityId)
        context.succeed("missing IdentityId");

    if (!res.idToken)
        context.succeed("missing idToken");

    if (!res.userId)
        context.succeed("missing userId");

    if (res.IdentityId == res.userId)
        context.succeed("you cannot follow yourself.");

    var params = {
        RequestItems: { /* required */
            'dripthat_user': {
                Keys: [ /* required */ {
                        IdentityId: { /* AttributeValue */
                            S: res.IdentityId
                        },
                    }, {
                        IdentityId: { /* AttributeValue */
                            S: res.userId
                        },
                    },
                    /* more items */
                ],
                ConsistentRead: false,
                ProjectionExpression: 'idToken, expDate'
            },
        },
        ReturnConsumedCapacity: 'NONE'
    };
    dynamodb.batchGetItem(params, function(err, data) {
        if (err) context.fail(err); // an error occurred
        else {
            if (!data.Responses.dripthat_follow)
                context.succeed("");

            if (!data.Responses.dripthat_user)
                context.succeed("no user found");

            if (!data.Responses.dripthat_user.length < 2)
                context.succeed("user not found");

            if (data.Responses.dripthat_user[0].idToken && data.Responses.dripthat_user[0].idToken.S != res.idToken || nowT < data.Responses.dripthat_user[0].expDate.N)
                context.succeed("bad idToken");

            if (data.Responses && data.Responses.dripthat_user[0]) {
                var params = {
                    RequestItems: { /* required */
                        'dripthat_follow': [{
                            DeleteRequest: {
                                Item: { /* required */
                                    IdentityId: { /* AttributeValue */
                                        S: res.IdentityId
                                    },
                                    userId: { /* AttributeValue */
                                        S: res.userId
                                    }
                                }
                            },
                        }, ]
                    },
                    ReturnConsumedCapacity: 'NONE',
                    ReturnItemCollectionMetrics: 'NONE'
                };
                dynamodb.batchWriteItem(params, function(err, data) {
                    if (err) context.fail(err); // an error occurred
                    else context.succeed(''); // successful response
                });
            } else {
                context.fail('No Responses');
            }
        }
    });
};
