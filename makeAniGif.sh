#!/bin/bash
cd `dirname $0`/frames
# the frames' camera take an ellipse path
magick \
	'download (0).png' -delay 10 \
	'download (1).png' -delay 100 \
	'download (2).png' -delay 10 \
	'download (3).png' -delay 5 \
	'download (4).png' -delay 5 \
	'download (5).png' -delay 5 \
	'download (6).png' -delay 5 \
	'download (7).png' -delay 5 \
	'download (8).png' -delay 5 \
	'download (9).png' -delay 5 \
	'download (10).png' -delay 5 \
	'download (11).png' -delay 5 \
	'download (12).png' -delay 5 \
	'download (13).png' -delay 5 \
	'download (14).png' -delay 5 \
	'download (15).png' -delay 5 \
	'download (16).png' -delay 5 \
	'download (17).png' -delay 5 \
	'download (18).png' -delay 10 \
	'download (19).png' -delay 100 \
	'download (20).png' -delay 10 \
	'download (21).png' -delay 5 \
	'download (22).png' -delay 5 \
	'download (23).png' -delay 5 \
	'download (24).png' -delay 5 \
	'download (25).png' -delay 5 \
	'download (26).png' -delay 5 \
	'download (27).png' -delay 5 \
	'download (28).png' -delay 5 \
	'download (29).png' -delay 5 \
	'download (30).png' -delay 5 \
	'download (31).png' -delay 5 \
	-chop 81x71 -gravity SouthEast -chop 21x31 \
	-bordercolor '#666' -border 1 \
	ani.gif
# first try, sucks: 	-crop '50%x50%+30%+40%' \
# 80 percent	-crop '80%x80%+10%+10%' \
# remove line for 100%, replace as so:
# 	-crop '80%x80%+10%+10%' \
# right before the ani.gif
#	-bordercolor '#aaa' -border 1 \
#	-shave '51x51' \
# 	-extract '198x198+51+51' \
if [ $? ]
then
	echo "frames/ani.gif created"
	ls -lt ani*
	file ani*
else
	echo "Error, see above"
fi