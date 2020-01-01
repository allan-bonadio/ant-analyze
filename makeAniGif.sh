#!/bin/bash


cd `dirname $0`/frames

# the frames' camera take an oval path
magick \
	'download (0).png' -delay 5 \
	'download (1).png' -delay 5 \
	'download (2).png' -delay 5 \
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
	ani.gif


# first try, sucks: 	-crop '50%x50%+30%+40%' \
# 80 percent	-crop '80%x80%+10%+10%' \

# 	-crop '80%x80%+10%+10%' \
# right before the ani.gif



