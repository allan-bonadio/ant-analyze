#!/bin/bash

cd `dirname $0`

# of course build it first!
npm run build

# upload the build directory to my website
# sorry I couldn't get recursive to work with scp or sftp

# use something like this ofr your SFTP_LOGIN_INFO:
#   -i ../myServersSecretKey   allan@nakoda
sftp $SFTP_LOGIN_INFO   << APPLETREE

cd /var/www/ant
pwd
lcd build
lpwd

put *.*
cd static/css
lcd static/css
put *.*
cd ../js
lcd ../js
put *.*

APPLETREE

exit

# put -r build/* /usr/local/nginx/ant-analyze
# 
# 
# put build/*.* /usr/local/nginx/ant-analyze
# put -R build/static /usr/local/nginx/ant-analyze
# 
# 
# cd /usr/local/nginx/ant-analyze
# put -R build
# put -r build/static/*
# 







