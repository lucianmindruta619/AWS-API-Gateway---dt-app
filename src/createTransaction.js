console.log('Loading create user event');
var AWS = require('aws-sdk');

// DO NOT REUPLOAD WITHOUT ADDING EVERYTHING IN THE inc/ FOLDER
// UNDER PENALTY OF DEATH. 
var dynamodb = new AWS.DynamoDB();
var cognitoidentity = new AWS.CognitoIdentity();
var s3 = new AWS.S3();

var request = require('request');

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

    var optionspost = {
        host: 'https://buy.itunes.apple.com',
        path: '/verifyReceipt',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    };

    if (res.receiptData) {
        request.post(
            'https://sandbox.itunes.apple.com/verifyReceipt', {
                json: {
                    'receipt-data': unescape(res.receiptData)
                }
            },
            function(error, response, body) {
                if (!error && response.statusCode == 200) {
                    console.log(body);
                    if (body.status == 0) {

                        if (!res.IdentityId)
                            context.succeed("missing IdentityId");

                        if (!res.idToken)
                            context.succeed("missing idToken");
                        var params = {
                            RequestItems: { /* required */
                                'dripthat_user': {
                                    Keys: [ /* required */ {
                                        IdentityId: { /* AttributeValue */
                                            S: res.IdentityId
                                        },
                                    }, ],
                                    ConsistentRead: false,
                                    ProjectionExpression: 'idToken, expDate'
                                },
                                'dripthat_credits': {
                                    Keys: [ /* required */ {
                                        IdentityId: { /* AttributeValue */
                                            S: res.IdentityId
                                        },
                                    }, ],
                                    ConsistentRead: false,
                                }
                            },
                            ReturnConsumedCapacity: 'NONE'
                        };
                        dynamodb.batchGetItem(params, function(err, data) {
                            if (err) context.fail(err); // an error occurred
                            else {

                                if (!data.Responses.dripthat_userCount || !data.Responses.dripthat_userCount[0]) {
                                    data.Responses.dripthat_userCount = [];
                                    data.Responses.dripthat_userCount[0] = {
                                        purchaseCount: {
                                            N: 0
                                        },
                                        Credits: {
                                            N: 0
                                        },
                                    }
                                }

                                if (data.Responses.dripthat_user.length < 1)
                                    context.succeed("no user found.");

                                if (!data.Responses.dripthat_user[0])
                                    context.succeed("no user found.");

                                if (data.Responses.dripthat_user[0] && !data.Responses.dripthat_user[0].idToken)
                                    context.succeed("no idToken found.");

                                if (data.Responses.dripthat_user[0].idToken.S != res.idToken){
                                    console.log(data.Responses.dripthat_user[0].idToken);
                                    context.succeed("idToken mismatch");
                                }

                                if (data.Responses.dripthat_user[0].expDate && nowT > data.Responses.dripthat_user[0].expDate.N)
                                    context.succeed("expired idToken");

                                if (data.Responses.dripthat_userCount[0].purchaseCount) {
                                    res.purchaseCount = data.Responses.dripthat_userCount[0].purchaseCount.N;
                                }
                                if(!res.purchaseCount){
                                    res.purchasedCount=1;
                                
                                }

                                if (data.Responses.dripthat_userCount[0].Credits) {
                                    res.Credits = data.Responses.dripthat_userCount[0].Credits.N;
                                } else {
                                    res.Credits = 0;
                                }

                                //console.log(JSON.stringify(body.receipt.in_app[0].product_id));

                                var receiptCredits = Number(body.receipt.in_app[0].product_id.replace("com.dripthat.dripthat.0", ""));

                                console.log(receiptCredits);

                                res.Credits = res.Credits + receiptCredits;

                                if (data.Responses && data.Responses.dripthat_user[0]) {
                                    var params = {
                                        RequestItems: { /* required */
                                            'dripthat_trans': [{
                                                PutRequest: {
                                                    Item: { /* required */
                                                        IdentityId: { /* AttributeValue */
                                                            S: res.IdentityId
                                                        },
                                                        createdAt: { /* AttributeValue */
                                                            N: nowT
                                                        },
                                                        Credits: { /* AttributeValue */
                                                            N: String(receiptCredits)
                                                        },
                                                        receiptInfo: {
                                                            S: JSON.stringify(body)
                                                        }
                                                    }
                                                },
                                            }, ],
                                            'dripthat_credits': [{
                                                    PutRequest: {
                                                        Item: { /* required */
                                                            Credits: { /* AttributeValue */
                                                                N: String(res.Credits)
                                                            },
                                                            purchasedCount: { /* AttributeValue */
                                                                N: String(res.purchasedCount)
                                                            },
                                                            IdentityId: { /* AttributeValue */
                                                                S: res.IdentityId
                                                            },
                                                        }
                                                    },
                                                }, ]
                                                /* anotherKey: ... */
                                        },
                                        ReturnConsumedCapacity: 'NONE',
                                        ReturnItemCollectionMetrics: 'NONE'
                                    };

                                    console.log(JSON.stringify(params));

                                    dynamodb.batchWriteItem(params, function(err, data) {
                                        if (err) context.fail(err); // an error occurred
                                        else context.succeed('created transaction'); // successful response
                                    });

                                } else {
                                    context.fail('No Responses');
                                }
                            }
                        });
                    } else {
                        if (response)
                            console.log(response);
                        if (error)
                            console.log(error);
                        if (body.status == 21002)
                            context.fail("apple could not read receipt.");
                        else
                            context.fail("could not validate receipt.");
                    }
                }
            }
        );
    } else {
        context.succeed("missing receiptData attribute");
    }

};
