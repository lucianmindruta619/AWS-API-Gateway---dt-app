var unmarshalItem = require('dynamodb-marshaler').unmarshalItem;

var obj = JSON.parse('[{"S":"Crop"},{"S":"Whatnot"}]');
//var obj = JSON.parse("{\"dollarCents\":{\"N\":\"0\"},\"dripcoins\":{\"N\":\"0\"},\"sales\":{\"N\":\"0\"}}");
//console.log(obj instanceof Array);

var item = {};
if (obj instanceof Array)
{
	item = [];
// List
for (var i = 0; i < obj.length; i ++)
  for (var o in obj[i]) {
    item.push(obj[i][o]);
  }
}

console.log(item);