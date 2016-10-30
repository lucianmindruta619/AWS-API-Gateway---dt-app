// Dripthat API Credentials
var apikey = 'I6MUthDGhULAn2nUMxBDTlSupD84tg9e';
var apisecret = '27d6bf85410502f619b8925edb56c28c6c96c1295be5290c502cda9189bb28ee';
var merchant_token = 'fdoa-a480ce8951daa73262734cf102641994c1e55e7cdf4c02b6';

var payeezy = require('payeezy')(apikey, apisecret, merchant_token);
payeezy.version = "v1";

// Sandbox Environment - Replace this value for Live Environment "api.payeezy.com"
payeezy.host = "api-cert.payeezy.com";

// 
var user = require('userUtils.js');


exports.handler = function(event, context) {


        if(!event.idToken)
            context.succeed("missing idToken");
        
        if(!event.IdentityId)
            context.succeed("missing IdentityId");

        if (event.debug) {
            delete event.debug;
            console.log("using debug information.");
            event.creditCard = {
                cardholder_name: "Tom Eck",
                card_number: "4788250000028291",
                exp_date: "1030",
                cvv: "123"
            };
        }

        var res = event;

        res.nowT = (new Date().getTime().toString());

        // else we only get the cardholder_name, card_number, exp_date, and cvv
        var cardType = res.creditCard.card_number.charAt(0);

        if(cardType == 4){
            res.creditCard.type = 'VISA';
        } else if(cardType == 5){
            res.creditCard.type = 'MC';
        } else if(cardType == 3){
            res.creditCard.type = 'AMEX';
        } else if(cardType == 6){
            res.creditCard.type = 'DISCOVER';
        }
        
        generateToken(event.creditCard, function(error, response) {
            if (error) {
                context.fail('Get Token for Card Failed\n');
            }
            if (response) {
                context.succeed(response.token);
            }
        });
};

function generateToken(req, fn) {
    payeezy.tokens.getToken({
        type: "FDToken",
        credit_card: req,
        auth: "false",
        ta_token: "NOIW"
    }, fn);
}