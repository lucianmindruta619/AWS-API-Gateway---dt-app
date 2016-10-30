console.log('Loading create user event');
var AWS = require('aws-sdk');

var ses = new AWS.SES();
var dynamodb = new AWS.DynamoDB();
var cognitoidentity = new AWS.CognitoIdentity();

var tableName = "dripthat";

function makeString(str) {
    return {
        'S': str.toString()
    };
}

function makeBool(b) {
    return {
        'BOOL': b
    };
}

function makeNumber(n) {
    return {
        'N': n.toString()
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

function putNumber(str) {
    return {
        'Action': 'PUT',
        'Value': {
            'N': str.toString()
        }
    };
}

var accountSid = 'AC9102ca76184091633b4b5a84009c0398';
var authToken = 'aa14cd882127bc8afdfd668cd255fe58';
var fromNumber = '62321';

var https = require('https');
var queryString = require('querystring');

// Sends an SMS message using the Twilio API
// to: Phone number to send to
// body: Message body
// completedCallback(status) : Callback with status message when the function completes.
function SendSMS(to, body, completedCallback) {

    // The SMS message to send
    var message = {
        To: to,
        From: fromNumber,
        Body: body
    };

    var messageString = queryString.stringify(message);

    // Options and headers for the HTTP request   
    var options = {
        host: 'api.twilio.com',
        port: 443,
        path: '/2010-04-01/Accounts/' + accountSid + '/Messages.json',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(messageString),
            'Authorization': 'Basic ' + new Buffer(accountSid + ':' + authToken).toString('base64')
        }
    };

    // Setup the HTTP request
    var req = https.request(options, function(res) {

        res.setEncoding('utf-8');

        // Collect response data as it comes back.
        var responseString = '';
        res.on('data', function(data) {
            responseString += data;
        });

        // Log the responce received from Twilio.
        // Or could use JSON.parse(responseString) here to get at individual properties.
        res.on('end', function() {
            console.log('Twilio Response: ' + responseString);
            completedCallback('API request sent successfully.');
        });
    });

    // Handler for HTTP request errors.
    req.on('error', function(e) {
        console.error('HTTP error: ' + e.message);
        completedCallback('API request completed with error(s).');
    });

    // Send the HTTP request to the Twilio API.
    // Log the message we are sending to Twilio.
    console.log('Twilio API call: ' + messageString);
    req.write(messageString);
    req.end();
}

exports.handler = function(event, context) {
    var res = event;

    var req = {};
    var nowT = (new Date().getTime().toString());
    // to change the userName. Scan all IdentityId's for userName & if it never finds it, create it.
    var params = {
        TableName: 'dripthat_user',
        ScanFilter: { // optional (map of attribute name to Condition)
            'phoneNumber': {
                ComparisonOperator: 'EQ', // (EQ | NE | IN | LE | LT | GE | GT | BETWEEN | 
                //  NOT_NULL | NULL | CONTAINS | NOT_CONTAINS | BEGINS_WITH)
                AttributeValueList: [{
                    S: res.phoneNumber
                }, ],
            },
            // more conditions ...
        },
        Select: 'ALL_ATTRIBUTES', // optional (ALL_ATTRIBUTES | ALL_PROJECTED_ATTRIBUTES | 
        ReturnConsumedCapacity: 'NONE', // optional (NONE | TOTAL | INDEXES)
    };
    dynamodb.scan(params, function(err, scan_data) {
        if (err) {
            context.fail(err);
        } else {
            if (scan_data.Count != 0 && scan_data.Items[0].phoneNumberVerification.M.verified.BOOL) {
                context.succeed("phone Number taken");
            }
            var params = {
                TableName: 'dripthat_user',
                Key: { // The primary key of the item (a map of attribute name to AttributeValue)
                    IdentityId: {
                        S: res.IdentityId
                    }
                },
                ExpressionAttributeNames: {
                    '#tok': "idToken",
                },
                ExpressionAttributeValues: {
                    ":phoneNumber": {
                        "S": res.phoneNumber
                    },
                    ":minSize": {
                        "N": String(3)
                    },
                    ":emailSize": {
                        "N": String(res.phoneNumber.length)
                    },
                    ":tok": {
                        "S": res.idToken
                    },
                    ":cat": {
                        "N": nowT
                    },
                    ":falseBool": makeBool(false),
                    ":eVerified": {
                        "M": {
                            verified: makeBool(false),
                            eToken: makeString(nowT.substring(5, 9))
                        }
                    }
                },
                ConditionExpression: '(:emailSize > :minSize) AND (#tok = :tok) AND (:cat < expDate) AND NOT (:phoneNumber = phoneNumber) OR (attribute_exists(phoneNumberVerification.verified) AND phoneNumberVerification.verified = :falseBool)',
                UpdateExpression: "SET phoneNumber = :phoneNumber, phoneNumberVerification = :eVerified, lastModified = :cat",
                ReturnValues: 'UPDATED_NEW', // optional (NONE | ALL_OLD | UPDATED_OLD | ALL_NEW | UPDATED_NEW)
                ReturnConsumedCapacity: 'NONE', // optional (NONE | TOTAL | INDEXES)
                ReturnItemCollectionMetrics: 'NONE', // optional (NONE | SIZE)
            };
            dynamodb.updateItem(params, function(err, data) {
                if (err) {
                    context.fail(err);
                } else {
                    var text = "🏊 Welcome to dRipthat. Come on in! 🏊(pin: " + data.Attributes.phoneNumberVerification.M.eToken.S + " )";
                    SendSMS(data.Attributes.phoneNumber.S, text,
                        function(status) {
                            context.done(null, status);
                        });

                }
            });
        }
    });

};
