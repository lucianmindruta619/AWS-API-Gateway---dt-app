// this just returns a nicely formatted params variable.

module.exports = {
    putItem: function(res) {
        var params = {};
        params.Item = res.Item
        params.TableName = 'dripthat';
        params.ReturnConsumedCapacity = 'NONE';
        params.ReturnValues = 'ALL_OLD';
        return params;
    },
    getItem: function(res) {
        var params = {};
        params.Key = res.Key;
        params.TableName = 'dripthat';
        params.ProjectionExpression = 'attribute_exists(#glo)';
        params.ExpressionAttributeNames = {};
        params.ExpressionAttributeNames['#glo'] = 'GUID';
        params.ReturnConsumedCapacity = 'NONE';
        return params;
    },
    deleteItem: function(res) {
        var params = {};
        params.Key = {};
        params.Key.GUID = res.GUID;
        params.TableName = 'dripthat';
        params.ConditionExpression = 'attribute_not_exists(#glo)';
        params.ExpressionAttributeNames = {};
        params.ExpressionAttributeNames['#glo'] = 'GUID';
        params.ReturnConsumedCapacity = 'NONE';
        params.ReturnValues = 'UPDATED_NEW';
        return params;
    },
    queryItems: function(res) {
        var params = {};
        params.TableName = 'dripthat';

        if (res.ExclusiveStartKey)
            params.ExclusiveStartKey = res.ExclusiveStartKey;
        if (res.ExpressionAttributeNames)
            params.ExpressionAttributeNames = res.ExpressionAttributeNames;
        if (res.ExpressionAttributeValues)
            params.ExpressionAttributeValues = res.ExpressionAttributeValues;
        if (res.FilterExpression)
            params.FilterExpression = res.FilterExpression;
        if (res.KeyConditionExpression)
            params.KeyConditionExpression = res.KeyConditionExpression;

        params.ReturnConsumedCapacity = 'NONE';

        if (res.Select)
            params.Select = res.Select;
        else
            params.Select = 'ALL_ATTRIBUTES';
        if (res.ScanIndexForward)
            params.ScanIndexForward = res.ScanIndexForward;
        else
            params.ScanIndexForward = true;
        if (res.IndexName)
            params.IndexName = res.IndexName;
        return params;
    },
};
