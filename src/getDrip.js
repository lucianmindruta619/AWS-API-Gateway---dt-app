console.log('Loading create user event');
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

    var params = {
        RequestItems: { /* required */
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
                ConsistentRead: false,
                ExpressionAttributeNames: {
                    '#media': 'media',
                    /* anotherKey: ... */
                },
                ProjectionExpression: '#media, purchaseCount, title, description, mediaCount, paywallLocation, upvoteCount, voteCount, viewCount, dTags'
            },
            'dripthat_purchase': {
                Keys: [ /* required */ {
                        IdentityId: { /* AttributeValue */
                            S: res.IdentityId
                        },
                        dripGuid: { /* AttributeValue */
                            N: res.userId + '_' + res.dripId
                        },
                    },
                    /* more items */
                ],
                ConsistentRead: false,
            },
            'dripthat_user': {
                Keys: [ /* required */ {
                        IdentityId: { /* AttributeValue */
                            S: res.IdentityId
                        },
                    },
                    /* more items */
                ],
                ConsistentRead: false,
            }
        },
        ReturnConsumedCapacity: 'NONE'
    };
    dynamodb.batchGetItem(params, function(err, data) {
        if (err) context.fail(err); // an error occurred
        else {
            console.log(data);
            if (data.Responses && data.Responses.dripthat_drip) {
                var blocked = false;

                if (data.Responses.dripthat_drip[0].price.N > 0 && !data.Responses.dripthat_purchase)
                    blocked = true; // meaning it wasnt purchased.

                if (!data.Responses.dripthat_user[0].idToken)
                    context.succeed("bad IdentityId");

                if (data.Responses.dripthat_user[0].idToken.S != res.idToken || data.Responses.dripthat_user[0].expDate.N < nowT)
                    context.succeed("bad idToken");

                for (var media in data.Responses.dripthat_drip[0].media.L) {
                    if (data.Responses.dripthat_drip[0].media.L[media]) {
                        data.Responses.dripthat_drip[0].media.L[media].M.url = makeString('http://media.dripthat.com/' + data.Responses.dripthat_drip[0].media.L[media].M.key.S);
                        if (blocked)
                            delete data.Responses.dripthat_drip[0].media.L[media];
                    }
                }
                context.succeed(data.Responses.dripthat_drip[0]);
            } else {
                context.fail('No Responses');
            }
        }
    });
};
