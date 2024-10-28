// configuration settings for the step widget, in particular the scenes
/* eslint-disable eqeqeq, no-throw-literal  */
console.log('process.env.NODE_ENV', process.env.NODE_ENV);

export let config = {
	// put on our best behavior, take down scaffolding
	production: process.env.NODE_ENV == 'production',
	//production: true,
	// set true to generate ani gif frames (don't ask me how it works)
	aniGifFrames: false,
	scenes: [
		{
			title: "Simple Sine Wave",
			formula: "sin(<var>x</var>), cos(<var>x</var>)",
			blurb: "The familiar Sine function crosses zero at integer multiples of 2π.  "+
			"The angle is measured in radians, which is the angle you get when "+
			"you crawl 1 radius length along the outside edge of a circle.",
			graphics: '2D',
			sheets: [{
					func: x => Math.sin(x),
					nPoints: 100,
					color: '#8cf',
				}, {
					func: x => Math.cos(x),
					nPoints: 100,
					color: '#cf8',
				}
			],
			xMin: -4,
			xMax: 4,
		},
		{
			title: "sin(<var>x</var>) / <var>x</var>",
			formula: "sin(<var>x</var>) / <var>x</var>",
			blurb: "This is one of the most popular functions for graphing.  "+
				"It actually has a singularity at x = 0, but it's a removable singularity.  "+
				"The limit as x goes to zero is 1 because sin(x) is roughly equal "+
				"to x near x = 0 .  As long as the graph doesn't try to evaluate at "+
				"exactly zero, it'll look fine.",
			graphics: '2D',
			sheets: [{
				func: x => Math.sin(x) / x,
				nPoints: 200,  // must be even to avoid singularity
				color: '#8fc',
			}],
			xMin: -20,
			xMax: 20,
		},
		{
			title: "Sine of Reciprocal",
			formula: "sin(1/<var>x</var>)",
			blurb: "Because the reciprocal goes to infinity as you approach zero, "+
				"the sine wave fluctuates wildly.  There is an essential singularity "+
				"at x = 0; the value at zero is ambiguous, anywhere over -1 ... 1, "+
				"and even beyond, if you approach from different angles over the "+
				"complex plane.  The graph is almost impossible to draw near "+
				"zero for that reason.",
			graphics: '2D',
			sheets: [{
				func: x => Math.sin(1/x),
				nPoints: 1000,  // needs more cuz of the tight curves
				color: '#c8f',
			}],
			xMin: -2,
			xMax: 2,
		},

		{
			title: "Sine over Complex Plane",
			formula: "sin(<var>x</var> + <var>iy<var>)",
			blurb: "In the imaginary directions, the trig functions become "+
				"hyperbolic functions, which end up rising or falling exponentially."+
				"You can see the familiar sine wave if you look along the real axis.",
			graphics: '3D',
			sheets: [{
				// sin(x+iy) = sin(x) cosh(y) + i cos(x) sinh(y)
				func: (x, y) => ({
					re: Math.sin(x) * Math.cosh(y),
					im: Math.cos(x) * Math.sinh(y),
				}),
				complex: true,
			}],
			xMin: -5.1,
			xMax: 5.1,
			yMin: -2,
			yMax: 2,
		},

		{
			title: "Cosine over Complex Plane",
			formula: "cos(<var>x</var> + <var>iy<var>)",
			blurb: "Just like the sine, but moved by ¼ cycle.",
			graphics: '3D',
			sheets: [{
				// sin(x+iy) = sin(x) cosh(y) + i cos(x) sinh(y)
				func: (x, y) => ({
					re: Math.cos(x) * Math.cosh(y),
					im: Math.sin(x) * Math.sinh(y),
				}),
				complex: true,
			}],
			xMin: -5.1,
			xMax: 5.1,
			yMin: -2,
			yMax: 2,
		},

		{
			title: "Square Root over Complex Plane",
			formula: "<img src=darkSquareRoot.png style='height:1.3em; margin: -3px 0 -5px 0;'>",
			blurb: "Square root has two values, just like for reals.  Each is negative of the other.  For instance, square root of 4 is both 2 and -2.  The sheets come together because sqrt(-1) is i or -i, with no real component, and other negative reals  work the same.",
			graphics: '3D',
			sheets: [{
				// sqrt(x+iy) = sin(x) cosh(y) + i cos(x) sinh(y)
				// polar functions are done with fromPolar() and toPolar()
				func: ({r, θ}) => ({
					r: Math.sqrt(r),
					θ: θ / 2,
				}),
				complex: true,
				polar: true,
			},
			{
				// sin(x+iy) = sin(x) cosh(y) + i cos(x) sinh(y)
				func: ({r, θ}) => ({
					r: Math.sqrt(r),
					θ: θ / 2 + Math.PI,
				}),
				polar: true,
				complex: true,
			}],
			xMin: -3.1,
			xMax: 3.1,
			yMin: -3.1,
			yMax: 3.1
		},

		{
			title: "Cube Root over Complex Plane",
			formula: "<img src=darkCubeRoot.png style='height:1.3em; margin: -3px 0 -5px 0;'>",
			blurb: "Cube root has three values, spaced equally along a circle centered at zero.  For instance, cube root of 8 is 2 at polar angles 0°, 120° and 240°.  The sheets depicted are actually one surface as you can see by following the colors; each sheet has to go over a discontinuity that isn't there in real life.  The discontinuity depends on whether your standard is 0...2π or -π...π",
			graphics: '3D',
			sheets: [{
				// sqrt(x+iy) = sin(x) cosh(y) + i cos(x) sinh(y)
				// polar functions are done with fromPolar() and toPolar()
				func: ({r, θ}) => ({
					r: Math.cbrt(r),
					θ: θ / 3,
				}),
				complex: true,
				polar: true,
			},
			{
				// sin(x+iy) = sin(x) cosh(y) + i cos(x) sinh(y)
				func: ({r, θ}) => ({
					r: Math.cbrt(r),
					θ: θ / 3 + 2 * Math.PI / 3,
				}),
				complex: true,
				polar: true,
			},
			{
				// sin(x+iy) = sin(x) cosh(y) + i cos(x) sinh(y)
				func: ({r, θ}) => ({
					r: Math.cbrt(r),
					θ: θ / 3 + 4 * Math.PI / 3,
				}),
				polar: true,
				complex: true,
			}],
			xMin: -3.1,
			xMax: 3.1,
			yMin: -3.1,
			yMax: 3.1
		},

		{
			title: "Natural Logarithm over Complex Plane",
			formula: "log(<var>x</var> + <var>iy<var>)",
			blurb: "Logarithm is actually multi-valued, over complex numbers.  You can add or subtract 2π i, or integer multiples, from any value of the logarithm to get equvalent other values.  The results actually spiral in the imaginary direction.  The dividing line between two layers, here, is along the negative real axis.  Near zero, of course, the logarithm shoots down to – ∞.",
			graphics: '3D',
			sheets: [{
				// log(x+iy) = log(sqrt(x^2 + y^2)) + i (cos y / sin x + 2πk) where k is any integer
				func: (x, y) => ({
					re: Math.log(x*x + y*y) * .5,  // log(sqrt(x^2 + y^2))
					im: Math.atan2(y, x),
				}),
				complex: true,
			}],
			xMin: -3.1,
			xMax: 3.1,
			yMin: -3.1,
			yMax: 3.1,
		},

	],
};
export default config;
