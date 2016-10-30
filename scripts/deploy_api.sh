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
MAPPING=sed

LINESTART="\ \ \ \ \ \ \ \ \ \ \ \ \ \ ,"
PREFIX="\\\\\""
SUFFIX="\\\\\""
for KEY in $KEYS; do
    eval $KEY=$(jq -r ".$KEY" scripts/config.json)
    VAL=${!KEY}
    SED="$SED -e \"s/<$KEY>/$VAL/g\""

    MKEY=$PREFIX$KEY$SUFFIX
    MVAL="$PREFIX\$stageVariables\.$KEY$SUFFIX"
    MAPPINGS="$MAPPINGS$COMMA$MKEY: $MVAL"
    COMMA=", "
done

SED_MAPPING="sed -e 's/\\\\\"\$stageVariables\\\\\"/{$MAPPINGS}/g'"

if [ -d "tmp" ]; then
  rm -rf tmp/*
else
  mkdir tmp
fi

cd scripts

STAGE_NAME=$1

cd ../

# list="sessions drips drips_dripid_capture"

touch tmp/swagger.yaml

cat api_gateway/swagger_pre.yaml >> tmp/swagger.yaml
if [ -z $list]; then
    for f in $(ls -1 api_gateway/res_*.yaml); do
        echo Processing $f
        # eval "$SED_MAPPING $f | sed 's/^/  /g' >> tmp/swagger.yaml"
        sed 's/^/  /g' $f >> tmp/swagger.yaml
    done
else
    echo 'From list'
    for res in $list; do
        f=api_gateway/res_$res.yaml
        echo Processing $f
        # eval "$SED_MAPPING $f | sed 's/^/  /g' >> tmp/swagger.yaml"
        sed 's/^/  /g' $f >> tmp/swagger.yaml
    done
fi
cat api_gateway/swagger_post.yaml >> tmp/swagger.yaml

aws-api-import.sh --region $REGION --update $API_ID --deploy $STAGE_NAME ./tmp/swagger.yaml
