module.exports = {
    changeProfile: function(res) {
        var params = {
            TableName: 'dripthat_user',
            Key: { // The primary key of the item (a map of attribute name to AttributeValue)
                IdentityId: {
                    S: res.IdentityId
                }
            },
            ExpressionAttributeNames: {
                '#des': "description",
                '#tok': "idToken"
                    /* anotherKey: ... */
            },
            ExpressionAttributeValues: {
                ":des": {
                    "S": res.description
                },
                ":minSize": {
                    "S": String(4)
                },
                ":desSize": {
                    "S": String(res.description.length)
                },
                ":tok": {
                    "S": res.idToken
                },
                ":cat": {
                    "N": res.nowT
                }
            },
            ConditionExpression: '(:desSize > :minSize ) AND attribute_exists(IdentityId) AND (#tok = :tok) AND (:cat < expDate)',
            UpdateExpression: "SET #des = :des, lastModified = :cat",
            ReturnValues: 'UPDATED_NEW', // optional (NONE | ALL_OLD | UPDATED_OLD | ALL_NEW | UPDATED_NEW)
            ReturnConsumedCapacity: 'NONE', // optional (NONE | TOTAL | INDEXES)
            ReturnItemCollectionMetrics: 'NONE', // optional (NONE | SIZE)
        };
        return params;
    },
    updateToken: function(res) {
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
                ':expDate': {
                    'N': res.expDate
                },
                ':idToken': {
                    'S': res.idToken
                },
                ":lastModified": {
                    "N": res.nowT
                }
            },
            UpdateExpression: "SET #tok = :idToken, expDate = :expDate, lastModified = :lastModified, createdAt = :lastModified",
            ReturnValues: 'UPDATED_NEW', // optional (NONE | ALL_OLD | UPDATED_OLD | ALL_NEW | UPDATED_NEW)
            ReturnConsumedCapacity: 'NONE', // optional (NONE | TOTAL | INDEXES)
            ReturnItemCollectionMetrics: 'NONE', // optional (NONE | SIZE)
        };
        return params;
    },
    changeUsername: function(res) {
        var params = {
            TableName: 'dripthat_user',
            Key: { // The primary key of the item (a map of attribute name to AttributeValue)
                IdentityId: {
                    S: res.IdentityId
                }
            },
            ExpressionAttributeNames: {
                '#userName': "userName",
                '#tok': "idToken",
            },
            ExpressionAttributeValues: {
                ":userName": {
                    "S": res.userName
                },
                ":minSize": {
                    "S": String(1)
                },
                ":usernameSize": {
                    "S": String(res.userName.length)
                },
                ":tok": {
                    "S": res.idToken
                },
                ":cat": {
                    "N": res.nowT
                }
            },
            ConditionExpression: '(:usernameSize > :minSize) AND (#tok = :tok) AND (:cat < expDate)',
            UpdateExpression: "SET #userName = :userName, lastModified = :cat",
            ReturnValues: 'UPDATED_NEW', // optional (NONE | ALL_OLD | UPDATED_OLD | ALL_NEW | UPDATED_NEW)
            ReturnConsumedCapacity: 'NONE', // optional (NONE | TOTAL | INDEXES)
            ReturnItemCollectionMetrics: 'NONE', // optional (NONE | SIZE)
        };
        return params;
    },
    addCard: function(res) {
        var params = {
            TableName: 'dripthat_user',
            Key: { // The primary key of the item (a map of attribute name to AttributeValue)
                IdentityId: {
                    S: res.IdentityId
                }
            },
            ExpressionAttributeNames: {
                '#tok': "idToken",
                '#CC': "creditCard"
            },
            ExpressionAttributeValues: {
                ":tok": {
                    "S": res.idToken
                },
                ":cat": {
                    "N": res.nowT
                },
                ":creditCard": {
                    "M": {
                        'type': {
                            'S': res.creditCard.type
                        },
                        'cardholder_name': {
                            'S': res.creditCard.cardholder_name
                        },
                        'exp_date': {
                            'S': res.creditCard.exp_date
                        },
                        'value': {
                            'S': res.creditCard.value
                        }
                    }
                }
            },
            ConditionExpression: 'attribute_exists(IdentityId) AND (#tok = :tok) AND (:cat < expDate)',
            UpdateExpression: "SET #CC = :creditCard, lastModified = :cat",
            ReturnValues: 'UPDATED_NEW', // optional (NONE | ALL_OLD | UPDATED_OLD | ALL_NEW | UPDATED_NEW)
            ReturnConsumedCapacity: 'NONE', // optional (NONE | TOTAL | INDEXES)
            ReturnItemCollectionMetrics: 'NONE', // optional (NONE | SIZE)
        };
        return params;
    },
};
// This basically returns the params needed to modify User data in dripthat_user.
