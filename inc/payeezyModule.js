// Dripthat API Credentials
var apikey = 'I6MUthDGhULAn2nUMxBDTlSupD84tg9e';
var apisecret = '27d6bf85410502f619b8925edb56c28c6c96c1295be5290c502cda9189bb28ee';
var merchant_token = 'fdoa-a480ce8951daa73262734cf102641994c1e55e7cdf4c02b6';

var payeezy = require('payeezy')(apikey, apisecret, merchant_token);
payeezy.version = "v1";


// Sandbox Environment - Replace this value for Live Environment "api.payeezy.com"
payeezy.host = "api-cert.payeezy.com";

exports.handler = function(event, context) {
    if (event.type == "generateToken") {

        if (event.test == true) {
            event.payload = {
                type: "VISA",
                cardholder_name: "Tom Eck",
                card_number: "4788250000028291",
                exp_date: "1030",
                cvv: "123"
            };
        }

        generateToken(event.payload, function(error, response) {
            if (error) {
                context.fail('Get Token for Card Failed\n' + JSON.stringify(error));
            }
            if (response) {
                context.succeed('FD-Token is generated Successfully, Token Value: ' + JSON.stringify(response.token, null, 4));
            }
        });
    } else if (event.type == "tokenAuthorize") {
        tokenBasedAuthorizeTransaction(event.payload, function(error, response) {
            if (error) {
                context.fail('Authorize Token Failed\n' + JSON.stringify(error));
            }
            if (response) {
                context.succeed('Authorize Token -  Success.\nTransaction Tag: ' + response.transaction_tag);
            }
        });
    } else if (event.type == "tokenPurchase") {
        tokenBasedPurchaseTransaction(event.payload, function(error, response) {
            if (error) {
                context.fail('Authorize Token Failed\n' + JSON.stringify(error));
            }
            if (response) {
                context.succeed('Authorize Token -  Success.\nTransaction Tag: ' + response.transaction_tag);
            }
        });
    } else {
        context.succeed("invalid type");
    }
};


function generateToken(req, fn) {
    console.log('*******************************************\nCreating FD-Token for a Credit Card\n************************************')

    payeezy.tokens.getToken({
        type: "FDToken",
        credit_card: req,
        auth: "false",
        ta_token: "NOIW"
    }, fn);
}

function tokenBasedAuthorizeTransaction(req, fn) {

    console.log('*******************************************\n Authorize using FD - Token \n************************************')

    payeezy.transaction.tokenAuthorize({
        merchant_ref: "Simple FD Token Authorize",
        method: "token",
        amount: req.amount,
        currency_code: req.currency,
        token: {
            token_type: "FDToken",
            token_data: req.token
        }
    }, fn);
}

function tokenBasedPurchaseTransaction(req, fn) {

    console.log('*******************************************\n Purchase using FD - Token \n************************************')

    payeezy.transaction.tokenPurchase({
        merchant_ref: "Simple FD Token Authorize",
        method: "token",
        amount: req.amount,
        currency_code: req.currency,
        token: {
            token_type: "FDToken",
            token_data: req.token
        }
    }, fn);
}
