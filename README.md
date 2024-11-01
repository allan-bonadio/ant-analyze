# ant-analyze
A website for mathematical visualization.
## Running & Building
All of these are from the root level ant-analyze directory.
To run React server for development
	npm install
	npm start
To build the production version:
	./deploy.sh
see [README.react.md](README.react.md) for more such info.
## Coordinate Systems
*science coords:* the ideal numbers used as the ranges and domains of the variables in the demo.  2d: Convert to pixel coords with Svg2D.xScale() and .yScale()  3d: Convert to cell coords with Webgl3D.xScale(), .yScale() and .zScale(), or .scaleXYZ1() for vectors. The real and imaginary parts of the indep var become the x and y coordinate. The complex result of the function becomes the z and lightness coordinates.
*cell coords:* The xy plane is broken into 'cells' with vertices at the corners. So if you have 5 cells by 8 cells, that's 6 vertices by 9 vertices. Cell coords start at 0, 0 and only go positive. The buffer's arrays are filled with cell coordinate numbers. Integer values are cell boundaries, and typically the only values we use for vertices. The size of the cell space rectangle comes from WebGL3d's TARGET_CELLS and the domains; may change in the future. There are no cells along the Z axis: whole range mapped to 0...1.
*clip coords:* The gl drawing space is actually -1...1 inclusive for x y and z. Convert from cell coords using the matrices generated by createMatrices(). This is done in the vertex shader with projectionMatrix and modelViewMatrix. modelViewMatrix includes the rotations from longitude and latitude.
*pixel coords:* If your canvas is 700 x 500, these coords traverse from 0...700,  and 0...500 . This is done by the graphics engine itself.
Cell and clip coords don't exist for 2d; the scales convert from science coords to pixel coords.
## Files
* LICENSE - the usual
* README.md - this file
* README.react.md - original create-react-app readme file
* build - built version from last time you built it
* node_modules - the usual dependencies
* package.json - the usual
* public/ - the usual, see below
* src/ - sources, .js and .css and .test.js
* upload.sh - deploys to website portfolio
* zipup.sh - archives sources
### public:
* favicon.png - the icon for the app
* favicon.psd - open with pshop if you have a version that runs
* index.html - the usual
* manifest.json - the usual
### src:
* 3d/ - extra sources for 3d lead by blanketPlot.js
* App.css - most css for the app at large, see other .css files
* _App.js_ - - top level remembers which scene to show and shows whichever
* App.test.js - the usual.  far behind.
* BlurbBox.css -
* BlurbBox.js - the small text box explaining everything with the nav bar inside
* NavBar.js - the little panel of buttons to choose which graph to see
* Svg2D.css -
* _Svg2D.js_ - all 2d plots drawn in SVG in this <svg component
* Svg2D.test.js -
* Webgl3D.css -
* _Webgl3D.js_ - all 3d plots drawn in WebGL on a <canvas component, along with 3d dir
* Webgl3D.test.js - way way behind
* config.js - Lists all the scenes and their parameters; a few more things
* graphicEvents.js - handles all mouse, touch, gesture and resize events
* index.css - the usual
* index.js - the usual
### src/3d:
* blanketPlot.js - main WebGL code draws surface plot along with these other files
* AxisTics.js - calculates and maintains axis tic positions, and paints the tics in GL and the labels in HTML
* axisBars.js - paints the twelve edges of the rectangle domain+range
* blanketTriangles.js - paints the 3d surface itself; all made of triangles
* vertexBuffer.js - stores the values to draw for 3d
* generateBlanket.js - generates the values to draw for 3d


