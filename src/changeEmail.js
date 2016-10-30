var AWS = require('aws-sdk');

var dynamodb = new AWS.DynamoDB();
var cognitoidentity = new AWS.CognitoIdentity();
var sqs = new AWS.SQS();

var ses = new AWS.SES();

function sendVerificationEmail(email, token, fn) {
    var subject = 'Ayo this be d.Rip in the haus';
    var verificationLink = 'http://app.dripthat.com/verify' + '?email=' + encodeURIComponent(email) + '&verify=' + token;
    ses.sendEmail({
        Source: 'mail@dripthat.com',
        Destination: {
            ToAddresses: [
                email
            ]
        },
        Message: {
            Subject: {
                Data: subject
            },
            Body: {
                Html: {
                    Data: '<html><head>'
                    + '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />'
                    + '<title>' + subject + '</title>'
                    + '</head><body>'
                    + 'Please <a href="' + verificationLink + '">click here to verify your email address</a> or copy & paste the following link in a browser:'
                    + '<br><br>'
                    + '<a href="' + verificationLink + '">' + verificationLink + '</a>'
                    + '</body></html>'
                }
            }
        }
    }, fn);
}

exports.handler = function(event, context) {
    var res = event;

    var req = {};
    var nowT = (new Date().getTime().toString());
    // to change the userName. Scan all IdentityId's for userName & if it never finds it, create it.
    var params = {
        TableName: 'dripthat_user',
        ScanFilter: { // optional (map of attribute name to Condition)
            'emailAddress': {
                ComparisonOperator: 'EQ', // (EQ | NE | IN | LE | LT | GE | GT | BETWEEN | 
                //  NOT_NULL | NULL | CONTAINS | NOT_CONTAINS | BEGINS_WITH)
                AttributeValueList: [{
                    S: res.emailAddress
                }, ],
            },
            // more conditions ...
        },
        Select: 'ALL_ATTRIBUTES', // optional (ALL_ATTRIBUTES | ALL_PROJECTED_ATTRIBUTES | 
        ReturnConsumedCapacity: 'NONE', // optional (NONE | TOTAL | INDEXES)
    };
    dynamodb.scan(params, function(err, data) {
        if (err) {
            context.fail(err);
        } else {
                var params = {
                    TableName: 'dripthat_user',
                    Key: { // The primary key of the item (a map of attribute name to AttributeValue)
                        IdentityId: {
                            S: res.IdentityId
                        }
                    },
                    ExpressionAttributeNames: {
                        '#emailAddress': "emailAddress",
                        '#tok': "idToken",
                        /* anotherKey: ... */
                    },
                    ExpressionAttributeValues: {
                        ":emailAddress": {
                            "S": res.emailAddress
                        },
                        ":minSize": {
                            "S": String(3)
                        },
                        ":emailSize": {
                            "S": String(res.emailAddress.length)
                        },
                    ":tok": {
                        "S": res.idToken
                    },
                    ":cat": {
                        "N": nowT
                    },
                    ":eVerified": {
                        "M": {
                            verified: {
                                BOOL: false
                            },
                            eToken: {
                                S: nowT
                            }
                        }
                    }
                    },
                    ConditionExpression: '(:emailSize > :minSize) OR (#tok = :tok) OR (:cat < expDate) OR NOT (:emailAddress = #emailAddress)',
                    UpdateExpression: "SET #emailAddress = :emailAddress, emailAddressVerification = :eVerified",
                    ReturnValues: 'UPDATED_NEW', // optional (NONE | ALL_OLD | UPDATED_OLD | ALL_NEW | UPDATED_NEW)
                    ReturnConsumedCapacity: 'NONE', // optional (NONE | TOTAL | INDEXES)
                    ReturnItemCollectionMetrics: 'NONE', // optional (NONE | SIZE)
                };
                dynamodb.updateItem(params, function(err, data) {
                    if (err) {
                        context.fail(err);
                    } else {
                        sendVerificationEmail(data.Attributes.emailAddress.S, data.Attributes.emailAddressVerification.M.eToken.S, function(err, email_data) {
                        if (err) {
                            context.fail('Error in sendVerificationEmail: ' + err);
                        } else {
                            context.succeed('changed email');
                        }
                        
                    });
                    }
                });
        }
    });

};