#!/bin/bash
# Pack up the sources for moving to another machine or system
# make sure cur dir is the one above this script
cd `dirname $0`
cd ..
zip -r ant-analyze/ant-analyze.zip  \
	ant-analyze/LICENSE \
	ant-analyze/README.md \
	ant-analyze/README.react.md \
	ant-analyze/package.json \
	ant-analyze/previewOfWebGL.png \
	ant-analyze/public/ \
	ant-analyze/src/ \
	ant-analyze/upload.sh \
	ant-analyze/zipup.sh