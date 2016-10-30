var AWS = require('aws-sdk');

var dynamodb = new AWS.DynamoDB();
var cognitoidentity = new AWS.CognitoIdentity();
var s3 = new AWS.S3();

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

    if (res.IdentityId == res.ToId) {
        context.fail("no.");
    }

    if(!res.price)
        res.price = 0;

    if(res.paywallLocation == 0)
        context.fail("cannot set paywallLocation = 0");

    if(!res.paywallLocation)
        res.paywallLocation = -1;

    if(res.price!=0 && res.paywallLocation==-1)
        context.succeed("need to set paywallLocation if you're selling the post");

    var newDrip = {};

    newDrip.createdAt = makeNumber(nowT);

    if(!res.media){
        context.fail("no media");
    }

    if (!res.description)
        res.description = "";// basically because the description can be 

    if(res.description && res.description.length>254)
        res.description=res.description.substring(0, 254);

    if (!res.title)
        context.fail("missing title");


    if(res.title.length>120)
        res.title=res.title.substring(0, 120);

    if(!res.dTags || !res.dTags[0])
        res.dTags = [];  

    newDrip.description = makeString(res.description);

    if (res.media && res.media.length !== 0) {
        newDrip.media = {
            "L": []
        };
        res.media.forEach(function(file) {
            var attach = {
                "M": {
                    duration: makeNumber(file.duration),
                    key: makeString(file.key)
                }
            };
            newDrip.media.L.push(attach);
        });
    }

    newDrip.total_count = {
        "N": res.media.length.toString()
    };

    if (res.in_addition_to) {
        newDrip.in_addition_to = makeNumber(res.in_addition_to);
    }

    var drip = {
        'M': newDrip
    };

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
            console.log(JSON.stringify(data));
            console.log(data.Responses.dripthat_user[0].length);

            if (!data.Responses.dripthat_user[0].idToken)
                context.succeed("no user found");

            if (data.Responses.dripthat_user[0] && !data.Responses.dripthat_user[0].idToken)
                context.succeed("no idToken found.");

            if (data.Responses.dripthat_user[0].idToken.S != res.idToken)
                context.succeed("idToken mismatch");

            if (data.Responses.dripthat_user[0].expDate && nowT > data.Responses.dripthat_user[0].expDate.N)
                context.succeed("expired idToken");

            if (data.Responses && data.Responses.dripthat_user) {
                var params = {
                    RequestItems: { /* required */
                        'dripthat_drip': [{
                            PutRequest: {
                                Item: { /* required */
                                    description: { /* AttributeValue */
                                        S: res.description
                                    },
                                    title: { /* AttributeValue */
                                        S: res.title
                                    },
                                    media: newDrip.media,
                                    createdAt: { /* AttributeValue */
                                        N: nowT
                                    },
                                    price: { /* AttributeValue */
                                        N: String(res.price)
                                    },
                                    paywallLocation: { /* AttributeValue */
                                        N: String(res.paywallLocation)
                                    },
                                    mediaCount: { /* AttributeValue */
                                        N: String(res.media.length)
                                    },
                                    IdentityId: { /* AttributeValue */
                                        S: res.IdentityId
                                    },
                                    dTags: { /* AttributeValue */
                                        SS: res.dTags
                                    }
                                }
                            },
                        }, ]
                    },
                    ReturnConsumedCapacity: 'NONE',
                    ReturnItemCollectionMetrics: 'NONE'
                };
                dynamodb.batchWriteItem(params, function(err, bw_data) {
                    if (err){
                        console.log(err);
                         context.fail('error creating drip'); // an error occurred
                    }
                    else context.succeed('successfully created drip'); // successful response
                });

            } else {
                context.fail('no responses');
            }
        }
    });
};
