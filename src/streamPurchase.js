console.log('Loading stream vote event');
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
    var count=0;
    var drips = {};
    event.Records.forEach(function(record) {
        var drip = {};
        if (record.eventName == 'INSERT') {
            // this is a new purchase
            if (drips[record.dynamodb.Keys.dripGuid.S]) {
                drips[record.dynamodb.Keys.dripGuid.S].purchaseCount += 1;
            } else {
                drips[record.dynamodb.Keys.dripGuid.S] = {};
                drips[record.dynamodb.Keys.dripGuid.S].purchaseCount = 1;
                count++;
            }
        }
    });
    console.log(JSON.stringify(event));

    for(var drip in drips){
        var item = drip.split("_");
        if(!drips[drip].purchaseCount)
            drips[drip].purchaseCount=0;

        console.log(item);
        var params = {
            TableName: 'dripthat_drip',
            Key: { // The primary key of the item (a map of attribute name to AttributeValue)
                IdentityId: {
                    S: item[0]
                },
                createdAt: {
                    N: String(item[1])
                }
            },
            ExpressionAttributeValues: {
                ":purchaseCount": {
                    "N": String(drips[drip].purchaseCount)
                },
            },
            UpdateExpression: "ADD purchaseCount :purchaseCount",
            ReturnValues: 'UPDATED_NEW', // optional (NONE | ALL_OLD | UPDATED_OLD | ALL_NEW | UPDATED_NEW)
            ReturnConsumedCapacity: 'NONE', // optional (NONE | TOTAL | INDEXES)
            ReturnItemCollectionMetrics: 'NONE', // optional (NONE | SIZE)
        };
        dynamodb.updateItem(params, function(err, data) {
            if (err)
                console.log(err);
            delete drips[drip];
            count--;
            console.log(count);
            if(count==0)
                context.done();
        });
    };
};
