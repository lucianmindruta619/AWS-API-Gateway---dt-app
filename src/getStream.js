var AWS = require('aws-sdk');

var dynamodb = new AWS.DynamoDB();
var cognitoidentity = new AWS.CognitoIdentity();
var s3 = new AWS.S3();

function getStream(IdentityId, beforeThan, fn) {
    /*
    var params = {
        TableName: 'dripthat_drip',
        ConsistentRead: false,
        ExpressionAttributeValues: {
            ":beforeThan": makeNumber(beforeThan)
        },
        FilterExpression: 'createdAt < :beforeThan',
        IndexName: 'createdAt-index',
        Limit: 100,
        ReturnConsumedCapacity: 'NONE',
        Select: 'ALL_ATTRIBUTES',
    };
    dynamodb.scan(params, fn);
    */
    console.log("called getStream");
    var params = {
        TableName: 'dripthat_drip',
        ConsistentRead: false,
        ExclusiveStartKey: {
            IdentityId: { /* AttributeValue */
                S: IdentityId
            },
            createdAt: { /* AttributeValue */
                N: beforeThan
            },
        },
        ExpressionAttributeValues: {
            ':IdentityId': { /* AttributeValue */
                S: IdentityId,
            },
            /* anotherKey: ... */
        },
        KeyConditionExpression: "IdentityId = :IdentityId",
        Limit: 25,
        ReturnConsumedCapacity: 'NONE',
        ScanIndexForward: true,
        Select: 'ALL_ATTRIBUTES'
    };
    dynamodb.query(params, fn);
}

exports.handler = function(event, context) {
    var res = event;
    var nowT = (new Date().getTime().toString());

    if (!res.beforeThan)
        res.beforeThan = nowT;

    if (!res.idToken)
        context.succeed("missing idToken");

    if (!res.userId)
        res.userId = res.IdentityId;

    var params = {
        Key: { /* required */
            IdentityId: { /* AttributeValue */
                S: res.IdentityId,
            }
        },
        TableName: 'dripthat_user',
        ProjectionExpression: 'idToken, ExpDate',
        ReturnConsumedCapacity: 'NONE'
    };
    dynamodb.getItem(params, function(err, user_data) {
        if (err) context.fail(err); // an error occurred
        else {
            console.log(user_data);

            if (user_data.Item && user_data.Item.idToken) {

                if (user_data.Item.idToken.S != res.idToken) {
                    context.succeed("wrong idToken");
                }

                getStream(res.userId, res.beforeThan, function(err, data) {
                    if (err) {
                        context.fail(err);
                    } else {

                        if(data.Count==0)
                            context.succeed("no drips found");
                        console.log(data);

                        var profilesToGet = new Array();
                        var identityIndex = new Array();

                        var dripsToGet = new Array();
                        var dripIndex = new Array();
                        for (var entry in data.Items) {
                            if (data.Items[entry].media && data.Items[entry].media.L) {
                                for (var media in data.Items[entry].media.L) {
                                    if (data.Items[entry].media.L[media]) {
                                        data.Items[entry].media.L[media].M.url = makeString('http://media.dripthat.com/' + data.Items[entry].media.L[media].M.key.S);
                                    }
                                }
                                data.Items[entry].media = data.Items[entry].media.L;
                            }
                            data.Items[entry].dripId = {
                                'S': data.Items[entry].createdAt.N
                            }
                            if (identityIndex.indexOf(data.Items[entry].IdentityId.S) == -1) {
                                identityIndex.push(data.Items[entry].IdentityId.S);
                                profilesToGet.push({
                                    IdentityId: { /* AttributeValue */
                                        S: data.Items[entry].IdentityId.S
                                    },
                                });
                            }
                            if (dripIndex.indexOf(data.Items[entry].IdentityId.S + '_' + data.Items[entry].createdAt.N) == -1) {
                                dripIndex.push(data.Items[entry].IdentityId.S + '_' + data.Items[entry].createdAt.N);
                                dripsToGet.push({
                                    dripGuid: { /* AttributeValue */
                                        S: data.Items[entry].IdentityId.S + '_' + data.Items[entry].createdAt.N
                                    },
                                    IdentityId: { /* AttributeValue */
                                        S: res.IdentityId
                                    },
                                });
                            }
                        }
                        // run a batchGet param thing from here.

                        var params = {
                            RequestItems: { /* required */
                                'dripthat_user': {
                                    Keys: profilesToGet,
                                    ConsistentRead: false,
                                    ProjectionExpression: 'userName, IdentityId, createdAt, profileImage'
                                },
                                'dripthat_purchase': {
                                    Keys: dripsToGet,
                                    ConsistentRead: false,
                                },
                                /* anotherKey: ... */
                            },
                            ReturnConsumedCapacity: 'TOTAL'
                        };

                        dynamodb.batchGetItem(params, function(err, user_data) {
                            if (err) context.fail(err); // an error occurred
                            else {
                                for (var each in data.Items) {
                                    for (var profile in user_data.Responses.dripthat_user) {
                                        if (user_data.Responses.dripthat_user[profile].IdentityId.S == data.Items[each].IdentityId.S) {
                                            data.Items[each].profile = user_data.Responses.dripthat_user[profile];
                                        } else {
                                            data.Items[each].profile = {};
                                        }
                                    }
                                    for (var purchase in user_data.Responses.dripthat_purchase) {
                                        if (user_data.Responses.dripthat_purchase[purchase].dripGuid.S == data.Items[entry].IdentityId.S + '_' + data.Items[entry].createdAt.N) {
                                            data.Items[each].purchased = true;
                                        }
                                    }
                                    if (!data.Items[each].purchased) {
                                        data.Items[each].purchased = false;
                                    }
                                }
                                context.succeed(data.Items); // successful response
                            }
                        });
                    }
                });
            } else {
                context.succeed("invalid Stream request");
            }
        }
    });
};
