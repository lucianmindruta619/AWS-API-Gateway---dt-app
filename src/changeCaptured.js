console.log('Loading create capture event');
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

    if (!res.dripId)
        context.succeed("missing dripId");

    if (!res.userId)
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
                            S: res.userId
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

            if (!data.Responses.dripthat_user)
                context.succeed("bad IdentityId");

            if (data.Responses.dripthat_user[0].idToken && data.Responses.dripthat_user[0].idToken.S != res.idToken || nowT < data.Responses.dripthat_user[0].expDate.N)
                context.succeed("bad idToken");

            if (!data.Responses.dripthat_drip)
                context.succeed("bad userId/dripId");

            if (data.Responses && data.Responses.dripthat_user[0]) {
                var params = {
                    RequestItems: { /* required */
                        'dripthat_captured': [{
                            PutRequest: {
                                Item: { /* required */
                                    GUID: { /* AttributeValue */
                                        S: res.IdentityId + '_' + res.userId + '_' + res.dripId
                                    },
                                    createdAt: { /* AttributeValue */
                                        N: nowT
                                    },
                                }
                            },
                        }, ]
                    },
                    ReturnConsumedCapacity: 'NONE',
                    ReturnItemCollectionMetrics: 'NONE'
                };
                dynamodb.batchWriteItem(params, function(err, data) {
                    if (err) context.fail(err); // an error occurred
                    else {
                        var params = {
                            TableName: 'dripthat_user',
                            Key: { // The primary key of the item (a map of attribute name to AttributeValue)
                                IdentityId: {
                                    S: res.IdentityId
                                }
                            },
                            UpdateExpression: "capturedCount ADD 1",
                            ReturnValues: 'UPDATED_NEW', // optional (NONE | ALL_OLD | UPDATED_OLD | ALL_NEW | UPDATED_NEW)
                            ReturnConsumedCapacity: 'NONE', // optional (NONE | TOTAL | INDEXES)
                            ReturnItemCollectionMetrics: 'NONE', // optional (NONE | SIZE)
                        };
                        dynamodb.updateItem(params, function(err, data) {
                            if(err)
                                console.log(err);
                            context.succeed('captured drip'); // successful response
                        });
                        //context.succeed('casted vote');
                    }
                });
            } else {
                context.fail('No Responses');
            }
        }
    });
};
