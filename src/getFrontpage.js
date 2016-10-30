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

function getProfile(IdentityId, fn) {
    var params = {
        Key: { /* required */
            IdentityId: { /* AttributeValue */
                S: IdentityId,
            }
        },
        TableName: 'dripthat_user',
        ProjectionExpression: 'userName, createdAt, profileImage, IdentityId',
        ReturnConsumedCapacity: 'NONE'
    };
    dynamodb.getItem(params, fn);
}

function getProfiles(n, data, fn) {
    console.log(n);
    if ((n + 1) > data.length) {
        fn(null, data);
    } else {
        getProfile(data[n].IdentityId.S, function(err, u_data) {
            if (err) {
                console.log(err);
                getProfiles(n + 1, data, fn);
            } else {
                data[n].profile = u_data.Item;
                getProfiles(n + 1, data, fn);
            }
        });
    }
}

function returnProfiles(data) {
    // go through all profiles and set them as vars

}

function getStream(IdentityId, beforeThan, fn) {
    var params = {
        TableName: 'dripthat_drip',
        ConsistentRead: false,
        ExpressionAttributeValues: {
            ":beforeThan": makeNumber(beforeThan)
                /* anotherKey: ... */
        },
        FilterExpression: 'createdAt < :beforeThan',
        IndexName: 'createdAt-index',
        Limit: 100,
        ReturnConsumedCapacity: 'NONE',
        Select: 'ALL_ATTRIBUTES',
    };
    dynamodb.scan(params, fn);
}

exports.handler = function(event, context) {

    var res = event;

    var nowT = (new Date().getTime().toString());

    if (!res.beforeThan) {
        res.beforeThan = nowT
    }

    if (!res.idToken) {
        context.succeed("missing idToken");
    }

    if (!res.IdentityId) {
        context.succeed("missing IdentityId");
    }

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
                if (user_data.Item.idToken.S != res.idToken && 2 == 4) {
                    context.succeed("wrong Token");
                }
                getStream(res.IdentityId, res.beforeThan, function(err, data) {
                    if (err) {
                        context.fail(err);
                    } else {
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
                                            data.Items[each].profile = {
                                                IdentityId:{
                                                    S: data.Items[each].IdentityId.S
                                                }
                                            }
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
