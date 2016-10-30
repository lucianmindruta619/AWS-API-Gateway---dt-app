module.exports = {
    token: function(c, res, fn) {
        var params = {
            IdentityPoolId: 'us-east-1:e143cb2c-a901-4b46-8f07-a8e1bf0e6b3b',
            Logins: { /* required */
                'login.dripthat.app': res.IdentityId
            },
            IdentityId: res.IdentityId
        };
        c.getOpenIdTokenForDeveloperIdentity(params, function(err, data) {
            if (err) {
                fn(err);
            } else {
                fn(null, data);
            }
        });
    },
    identity: function(c, fn) {
        var params = {
            "IdentityPoolId": 'us-east-1:e143cb2c-a901-4b46-8f07-a8e1bf0e6b3b',
            "Logins": {
                'login.dripthat.app': null
            }
        };
        c.getId(params, function(err, data) {
            if (err) {
                fn(err);
            } else {
                fn(null, data);
            }
        });
    }
};
