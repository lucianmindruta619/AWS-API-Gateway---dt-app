#!/bin/bash

# Check if the Amazon API Gateway Importer is in the PATH
found=$(which aws-api-import.sh)
if [ -z "$found" ]; then
  echo "Please install the Amazon API Gateway Importer under your PATH: https://github.com/awslabs/aws-apigateway-importer"
  exit 1
fi

# Check if jq is in the PATH
found=$(which jq)
if [ -z "$found" ]; then
  echo "Please install jq under your PATH: http://stedolan.github.io/jq/"
  exit 1
fi


if [ -z "$1" ]
  then
    echo "No stage name supplied"
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

if [ -d "tmp" ]; then
  rm -rf tmp/*
else
  mkdir tmp
fi

cd scripts

STAGE_NAME=$1

cd ../


VARIABLES=$(jq -s '.[0] * .[1]' scripts/config.json scripts/env.json)

echo 'Retrieving stage info...'
DEPLOYMENT=$(aws apigateway get-stage --rest-api-id $API_ID --region $REGION --stage-name $STAGE_NAME --query 'deploymentId' --output text)

if [ -z "$DEPLOYMENT" ]; then
  echo Stage does not exist
  exit 1
else
  echo 'Deleting old stage...'
  aws apigateway delete-stage --rest-api-id $API_ID --region $REGION --stage-name $STAGE_NAME
  echo 'Creating new stage...'
  aws apigateway create-stage --rest-api-id $API_ID --region $REGION --stage-name $STAGE_NAME --deployment-id $DEPLOYMENT --variables "$VARIABLES"
fi
