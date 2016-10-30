console.log('Loading create comment event');
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

    if(!res.IdentityId)
        context.succeed("missing IdentityId");

    if(!res.idToken)
        context.succeed("missing idToken");

    if(!res.text || res.text.trim().length == 0)
        context.succeed("missing text");

    if(!res.dripId)
        context.succeed("missing dripId");

    if(!res.userId)
        context.succeed("missing userId");

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
            },
            'dripthat_drip': {
                Keys: [ /* required */ {
                        IdentityId: { /* AttributeValue */
                            S: res.IdentityId
                        },
                        createdAt: { /* AttributeValue */
                            N: res.dripId
                        },
                    },
                    /* more items */
                ],
                ConsistentRead: false
            }
        },
        ReturnConsumedCapacity: 'NONE'
    };
    dynamodb.batchGetItem(params, function(err, data) {
        if (err) context.fail(err); // an error occurred
        else {

            if (!data.Responses.dripthat_drip)
                context.succeed("bad dripId");

            if (!data.Responses.dripthat_drip)
                context.succeed("bad IdentityId");

            if (data.Responses.dripthat_user[0] && !data.Responses.dripthat_user[0].idToken)
                context.succeed("no idToken found.");

            if (data.Responses.dripthat_user[0].idToken.S != res.idToken)
                context.succeed("idToken mismatch");

            if (data.Responses.dripthat_user[0].expDate && nowT > data.Responses.dripthat_user[0].expDate.N)
                context.succeed("expired idToken");

            if (data.Responses && data.Responses.dripthat_user[0]) {

                var params = {
                    RequestItems: { /* required */
                        'dripthat_comments': [{
                                    PutRequest: {
                                        Item: { /* required */
                                            text: { /* AttributeValue */
                                                N: String(res.text)
                                            },
                                            IdentityId: { /* AttributeValue */
                                                S: res.IdentityId
                                            },
                                            createdAt: { /* AttributeValue */
                                                N: nowT
                                            },
                                            dripId: { /* AttributeValue */
                                                S: res.dripId
                                            }
                                        }
                                    },
                                },
                            ]
                    },
                    ReturnConsumedCapacity: 'NONE',
                    ReturnItemCollectionMetrics: 'NONE'
                };
                dynamodb.batchWriteItem(params, function(err, data) {
                    if (err) context.fail(err); // an error occurred
                    else context.succeed('created comment'); // successful response
                });

            } else {
                context.fail('No Responses');
            }
        }
    });
};
