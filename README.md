# Dripthat Backend

## Table of contents

- [Setup](#setup)
- [Using the services client-side](#using-the-services-client-side)
- [Deploying](#deploying)
- [Testing Lambdas](#testing-lambdas)
- [Backend Details](#backend-details)
- [Data Storage](#data-storage)


# Setup

* Download the repository
* Install `aws-cli` and `jq`
* Install `nvm` and through it install `node` version `v0.10.36` (the same aws use)
* cd into the repo directory and issue `npm install`
* for any lambda you want to use cd into `./lambda/foo/` and issue `npm install`


# Using the services client-side


### Authentication

Authentication is done by calling Cognito. Either as a guest or after signing in, an **OpenID token** is assigned to the user. This should be stored locally along with the user's session object.

* For a guest user (JS but similar for other supported platforms)

```js
var param = {'IdentityPoolId': IDENTITY_POOL_ID};
cognito.getId(param, function (err, cognitoId) {
  cognito.getOpenIdToken(cognitoId, function (error, data) {
    console.log(data.token);
  }
}
```

* After signing in

```js
var options = {'method': 'POST', 'json': true, 'uri': DT_STAGE_URI + '/sessions',
    		   'body': {'email': username, 'password': password}};
request(options, function (error, response, body) {
  if (response.statusCode === 200) {
    console.log(body.token);
  }
}
```
* When logging out, use the guest workflow again

### Authorization

In order to make requests to AWS (either S3 or API Gateway) you need to have an IAM role assigned (a role that describes the user's permissions). This role is defined by **aws credentials**. You get *temporary*, limited permissions credentials by exchanging the OpenID token from Cognito through STS `assumeRoleWithWebIdentity`:

```js
var params = {'RoleArn': role,
			  'RoleSessionName': sessionname,
              'WebIdentityToken': token,
              'DurationSeconds': duration};
sts.assumeRoleWithWebIdentity(params, function (err, data) {
    console.log(data.Credentials);
});
```

* As a guest you ask for role `cognito_dt_unauth_role` and sessionname `guest`
* As logged in you ask for role `cognito_dt_auth_role` and `sessionname = email`
* You provide the OpenId token given by Cognito in the authentication step
* You provide a duration for which these credentials will be valid

After this step, you have a valid set of credentials, with which you can access all permitted AWS services:

```js
var AWS = require('aws-sdk');
AWS.config.update({'accessKeyId': data.Credentials.AccessKeyId,
                   'secretAccessKey': data.Credentials.SecretAccessKey,
                   'sessionToken': data.Credentials.SessionToken});
s3 = new AWS.S3();
s3.putObject({'Bucket': bucketname,
              'Key': target,
              'Body': file_contents
})

```

#### Using the SDK

* Log in AWS console
* [Generate the SDK](http://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-generate-sdk.html)
* **REVIEW** generated SDK (sometimes it contains errors)
* Use the SDK along with the authorization flow to consume the API

#### Manually

* Create a request
* Sign it using [this signing process](http://docs.aws.amazon.com/general/latest/gr/signature-version-4.html)



# Deploying

### Configuration

Before deploying, install AWS CLI, and set your developer credentials at `~/.aws/credentials`. Moreover, review the `./scripts/config.json` file and check that it contains correct information. Finally, if your lambda uses CustomerIO or MySQL, edit `./scripts/env.json` and insert the following *secret* info:

```js
{
  "CUSTOMERIO_USER": "...",
  "CUSTOMERIO_PASSWORD": "...",
  "MYSQL_NAME": "...",
  "MYSQL_USER": "...",
  "MYSQL_PASS": "..."
}
```

### API Gateway

For every resource, there exists a yaml file describing all the API Gateway options such as authorization, lambda invocation, integration responses, CORS, etc. Each yaml file is a part of a big swagger file that is imported to API Gateway.

Edit the `./api_gateway/res_[resource_path].yaml` file (swagger syntax) and deploy:

```
./scripts/deploy_api.sh STAGE_NAME
```

### Lambdas and IAM roles

When deploying, you need to upload a lambda function/module and a respective IAM role (describing the access policy). In order to deploy `dt_foo`, make sure that the lambda and iam role for `dt_foo` exist and issue:

```
./scripts/deploy_lambda.sh dt_foo
```


#### Lambdas

Lambdas reside under `./lambdas` and can either be a single JS file (`dt_foo.js`) or a JS module (`dt_foo/`). For lambdas that have dependencies, the module is the correct way to go. The folder structure for a lambda module is:

```
dt_foo/
  dt_foo.js
  packages.json
  node_models/
```

#### IAM Roles

IAM roles reside at `./iam`. They are named under the respective lambda name, i.e. `dt_foo.json`


# Testing Lambdas

## Gulp tasks

Live testing can be done through gulp tasks. The gulp file `./tasks/lambda_simulations.js` includes many tasks for invoking the deployed lambdas.

### Configuration

`dotenv` is used, so you need to create a file `./.env` with some *secret* info. These should **not** be uploaded to the repository. If you do not know where to find this info, contact the backend maintainer.

```
DT_AUTH_ROLE=arn:aws:iam::493526813836:role/cognito_dt_auth_role
DT_UNAUTH_ROLE=arn:aws:iam::493526813836:role/cognito_dt_unauth_role
DT_AUTH_USER=...
DT_AUTH_PASSWORD=...
DT_AUTH_DURATION=3600
DT_SESSION_FILE=session.tmp
DT_STAGE_URI=https://n188zfgouj.execute-api.us-east-1.amazonaws.com/dev
IDENTITY_POOL_ID=us-east-1:4af9f534-7cd3-4b16-bf9e-255bfe2f0e2a
CUSTOMERIO_USER=...
CUSTOMERIO_PASSWORD=...
DB_NAME=...
DB_USER=...
DB_PASS=...
DB_HOST=...
DB_PORT=...
```


### Invocation

```
gulp simulate-foo
```

**CAUTION:** These are descructive steps and **will** actually execute the deployed lambdas.

### Unit tests
No unit tests exist yet, but one can test his lambda as any other javascript module. I.e. one can create mocha tests inside `./lambdas/dt_foo/test/test.js`



# Backend details

## Authentication/Authorization

### Login Provider
- Our login provider is `login.dripthat.dripthat` and its records are stored in DynamoDB `dt_registered`

### Authentication
All users, both guests and logged in, are uniquely identified by Cognito. The Cognito workflow is described [here](http://docs.aws.amazon.com/cognito/devguide/identity/concepts/authentication-flow/) in detail.

### Authorization

##### API Gateway authorization
Two roles can access the API Gateway, `cognito_dt_auth_role` and `cognito_dt_unauth_role`, which represent logged in users and guests respectively. For each role, we assign an access policy that defines which endpoints they can access. I.e. `cognito_dt_unauth_role` can access `GET /v1/users` but not `PATCH /v1/users`.

##### Lambda authorization
Each lambda function is executed under a certain IAM role that defines what resources a lambda can access. I.e. `dt_get_user` is executed under the role `dt_get_user` that allows retrieving a user from DynamoDB.


# Data Storage


### Users / Drips
- Users/Drips are stored on DynamoDB `dt_users`, `dt_drips`

### Searches
- Searchable fields are fed into Cloudsearch by lambdas on each DynamoDB update
- Search views use Cloudsearch to return data cursors

### Purchases / Withdrawals
- Purchases and withdrawals are logged into the MySQL database `dripthat`
- Purchases and withdrawals are denormalized onto Users/Drips
