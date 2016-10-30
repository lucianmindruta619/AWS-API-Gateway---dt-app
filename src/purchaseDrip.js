var AWS = require("aws-sdk");

var dynamodb = new AWS.DynamoDB();

exports.handler = function(event, context) {

    var res = event;

    var nowT = (new Date().getTime().toString());

    if (!res.IdentityId)
        context.succeed("missing IdentityId");

    if (!res.idToken)
        context.succeed("missing idToken");

    if (!res.userId)
        context.succeed("missing userId");

    if (!res.dripId)
        context.succeed("missing dripId");

    if (res.IdentityId == res.userId)
        context.succeed("cannot buy your own drips");

    var params = {
        RequestItems: {
            'dripthat_user': {
                Keys: [ /* required */ {
                        IdentityId: { /* AttributeValue */
                            S: res.IdentityId
                        },
                    },
                    /* more items */
                ],
                ConsistentRead: false,
                ProjectionExpression: 'userName, IdentityId, createdAt, profileImage, idToken, expDate'
            },
            'dripthat_userCount': {
                Keys: [ /* required */ {
                    IdentityId: { /* AttributeValue */
                        S: res.IdentityId
                    },
                }, ],
                ConsistentRead: false,
                /*ProjectionExpression: 'Credits, Earnings, Purchased, Captured' */
                /* This gets them all*/
            },
            'dripthat_drip': {
                Keys: [ /* required */ {
                    IdentityId: { /* AttributeValue */
                        S: res.userId
                    },
                    createdAt: { /* AttributeValue */
                        N: res.dripId
                    },
                }, ],
                ConsistentRead: false,
                ProjectionExpression: 'price'
            },
            'dripthat_purchase': {
                Keys: [ /* required */ {
                    IdentityId: { /* AttributeValue */
                        S: res.IdentityId
                    },
                    dripGuid: { /* AttributeValue */
                        S: res.userId + '_' + res.dripId
                    },
                }, ],
                ConsistentRead: false,
            }
        },
        ReturnConsumedCapacity: 'TOTAL'
    };

    dynamodb.batchGetItem(params, function(err, data) {
        if (err) {
            context.fail(err); // an error occurred
        } else {

            if (data.Responses.dripthat_purchase && data.Responses.dripthat_purchase[0])
                context.succeed("drip already purchased");

            if (data.Responses.dripthat_drip.length < 1)
                context.succeed("no drip found.");

            if (!data.Responses.dripthat_drip[0])
                context.succeed("no drip found.");

            if (data.Responses.dripthat_user.length < 1)
                context.succeed("no user found.");

            if (!data.Responses.dripthat_user[0])
                context.succeed("no user found.");

            if (data.Responses.dripthat_user[0] && !data.Responses.dripthat_user[0].idToken)
                context.succeed("no idToken found.");

            if (data.Responses.dripthat_user[0].idToken.S != res.idToken)
                context.succeed("idToken mismatch");

            if (data.Responses.dripthat_user[0].expDate && nowT > data.Responses.dripthat_user[0].expDate.N)
                context.succeed("expired idToken");

            console.log(data.Responses.dripthat_user[0]);
            console.log(nowT);

            if (!data.Responses.dripthat_userCount || !data.Responses.dripthat_userCount[0]) {
                data.Responses.dripthat_userCount = [];

                data.Responses.dripthat_userCount.push({
                    purchaseCount: {
                        N: 0
                    },
                    Credits: {
                        N: 0
                    }
                });
            }

            if (!data.Responses.dripthat_credits)
                res.credits = 0;
            else {
                res.credits = data.Responses.dripthat_credits[0].Credits.N;
            }

            if ( data.Responses.dripthat_drip[0].price && res.credits - data.Responses.dripthat_drip[0].price.N < 0)
                context.succeed("not enough credits.");
            else if(data.Responses.dripthat_drip[0].price)
                res.credits = res.credits - data.Responses.dripthat_drip[0].price.N;

            console.log(JSON.stringify(data));

            if (data.Responses && data.Responses.dripthat_user[0]) {
                var params = {
                    RequestItems: { /* required */
                        'dripthat_purchase': [{
                            PutRequest: {
                                Item: { /* required */
                                    IdentityId: { /* AttributeValue */
                                        S: res.IdentityId
                                    },
                                    dripGuid: { /* AttributeValue */
                                        S: String(res.userId + '_' + res.dripId)
                                    },
                                    createdAt: { /* AttributeValue */
                                        N: String(nowT)
                                    },
                                }
                            },
                        }, ],
                        'dripthat_userCount': [{
                            PutRequest: {
                                Item: { /* required */
                                    IdentityId: { /* AttributeValue */
                                        S: res.IdentityId
                                    },
                                    purchasedCount: { /* AttributeValue */
                                        N: String(data.Responses.dripthat_userCount[0].purchasedCount.N + 1)
                                    },
                                    Credits: { /* AttributeValue */
                                        N: String(res.credits + (data.Responses.dripthat_drip[0].price.N * 5))
                                    },
                                }
                            },
                        }, ],
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
};
