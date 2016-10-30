#!/bin/bash
# Check if the AWS CLI is in the PATH
found=$(which aws)
if [ -z "$found" ]; then
  echo "Please install the AWS CLI under your PATH: http://aws.amazon.com/cli/"
  exit 1
fi

# Check if jq is in the PATH
found=$(which jq)
if [ -z "$found" ]; then
  echo "Please install jq under your PATH: http://stedolan.github.io/jq/"
  exit 1
fi

set -e

cd "$(dirname "$0")"
cd ../
make clean

arr=( $(jq 'keys[]' scripts/config.json) )
KEYS=`printf "%s\n" ${arr[@]} | tr -d '"'`
SED=sed
for KEY in $KEYS; do
    eval $KEY=$(jq -r ".$KEY" scripts/config.json)
    VAL=${!KEY}
    SED="$SED -e \"s/<$KEY>/$VAL/g\""
done

if [ -d "./iam/edit" ]; then
  rm -f ./iam/edit/*
else
  mkdir ./iam/edit
fi

if [ -z "$1" ]
  then
    echo "No lambda name supplied"
    exit -1
fi

name=$1
if [ ! -f ./iam/$name.json ]; then
    echo "IAM role '$name' not found!"
    exit -1
fi

ispackage=0
if [ ! -f ./lambda/$name.js ]; then
    if [ ! -d ./lambda/$name ]; then
        echo "Lambda '$name' not found!"
        exit -1
    else
        ispackage=1
    fi
fi

if [ -d "tmp" ]; then
  rm -rf tmp/*
else
  mkdir tmp
fi

cd tmp
if [ $ispackage -eq 0 ]; then
    echo 'Is not package'
    echo "var config = `cat ../scripts/config.json | tr '\n' '#' | sed 's/}|/};/g' | tr '#' '\n'`" > index.js
    echo "var env = `cat ../scripts/env.json | tr '\n' '#' | sed 's/}|/};/g' | tr '#' '\n'`" >> index.js
    cat ../lambda/$name.js >> index.js
else
    echo 'Is package'
    cp -r ../lambda/$name/* ./
    # find . ! -iregex "\.\/test.*$"
    echo "var config = `cat ../scripts/config.json | tr '\n' '#' | sed 's/}|/};/g' | tr '#' '\n'`" > index.js
    echo "var env = `cat ../scripts/env.json | tr '\n' '#' | sed 's/}|/};/g' | tr '#' '\n'`" >> index.js
    cat ./$name.js >> index.js
    rm $name.js
fi
zip -r $name *
cd ../

trust="trust_policy_lambda.json"
echo "Editing trust '$trust'"
cd iam
CMD="$SED $trust > edit/$trust"
eval $CMD
cd ../

echo "Editing IAM role '$name'..."
CMD="$SED ./iam/$name.json > ./iam/edit/$name.json"
eval $CMD

ROLE_EXISTS=$(aws iam list-roles --query 'Roles[?RoleName == `'$name'`].RoleName' --region $REGION --output text)
if [ -z "$ROLE_EXISTS" ]; then
  echo "Creating IAM role '$name'..."
  aws iam create-role --role-name $name --assume-role-policy-document file://iam/edit/$trust
  aws iam update-assume-role-policy --role-name $name --policy-document file://iam/edit/$trust
  aws iam put-role-policy --role-name $name --policy-name $name --policy-document file://iam/edit/$name.json
else
  echo "Updating IAM role '$name'..."
  aws iam update-assume-role-policy --role-name $name --policy-document file://iam/edit/$trust
  aws iam put-role-policy --role-name $name --policy-name $name --policy-document file://iam/edit/$name.json
fi

LAMBDA_EXISTS=$(aws lambda list-functions --query 'Functions[?FunctionName == `'$name'`].FunctionName' --region $REGION --output text)
if [ -z "$LAMBDA_EXISTS" ]; then
  echo "Creating Lambda '$name'..."
  aws lambda create-function --function-name ${name} \
      --runtime nodejs \
      --role arn:aws:iam::$AWS_ACCOUNT_ID:role/${name} \
      --handler index.handler \
      --zip-file fileb://tmp/${name}.zip \
      --region $REGION
else
  echo "Updating Lambda '$name'"
  aws lambda update-function-code --function-name ${name} \
      --zip-file fileb://tmp/${name}.zip \
      --region $REGION
fi

rm tmp/$name.zip
