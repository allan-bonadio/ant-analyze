// configuration settings for the step widget, in particular the scenes
/* eslint-disable eqeqeq, no-throw-literal  */

console.log('process.env.NODE_ENV', process.env.NODE_ENV);

export let config = {

	// put on our best behavior, take down scaffolding
	production: false || process.env.NODE_ENV == 'production',
	production: true,
	
	// set true to generate ani gif frames (proprietary)
	aniGifFrames: true,
	
	scenes: [
		{
			title: "Simple Sine Wave",
			formula: "sin(<v>x</v>), cos(<v>x</v>)",
			blurb: "The familiar Sine function crosses zero at integer multiples of π.  "+
			"The angle is measured in radians, which is the angle you get when "+
			"you crawl 1 radius length along the outside edge of a circle.",
			graphics: '2D',
			funcs: [{
					func: x => Math.sin(x),
					nPoints: 100,
					color: '#8cf',
				}, {
					func: x => Math.cos(x),
					nPoints: 100,
					color: '#cf8',
				}
			],
			xMin: -6,
			xMax: 6,
		},
		{
			title: "sin(<v>x</v>) / <v>x</v>",
			formula: "sin(<v>x</v>) / <v>x</v>",
			blurb: "This is one of the most popular functions for graphing.  "+
				"It actually has a singularity at x = 0, but it's a removable singularity.  "+
				"The limit as x goes to zero is 1 because sin(x) is roughly equal "+
				"to x near x = 0 .  As long as the graph doesn't try to evaluate at "+
				"exactly zero, it'll look fine.",
			graphics: '2D',
			funcs: [{
				func: x => Math.sin(x) / x,
				nPoints: 200,  // must be even to avoid singularity
				color: '#8fc',
			}],
			xMin: -20,
			xMax: 20,
		},
		{
			title: "Sine of Reciprocal",
			formula: "sin(1/<v>x</v>)",
			blurb: "Because the reciprocal goes to infinity as you approach zero, "+
				"the sine wave fluctuates wildly.  There is an essential singularity "+
				"at x = 0; the value at zero is ambiguous, anywhere over -1 ... 1, "+
				"and even beyond, if you approach from different angles over the "+
				"complex plane.  The graph is almost impossible to draw near "+
				"zero for that reason.",
			graphics: '2D',
			funcs: [{
				func: x => Math.sin(1/x),
				nPoints: 1000,  // needs more cuz of the tight curves
				color: '#c8f',
			}],
			xMin: -2,
			xMax: 2,
		},

		// sin(x+iy) 3d over complex plane
		{
			title: "Sine over Complex Plane",
			formula: "sin(<v>x</v>+<v>iy<v>)",
			blurb: "In the imaginary directions, the trig functions become "+
				"hyperbolic functions, which end up rising exponentially.",
			graphics: '3D',
			funcs: [{
				// sin(x+iy) = sin(x) cosh(y) + i cos(x) sinh(y)
				func: (x, y) => ({
					re: Math.sin(x) * Math.cosh(y),
					im: Math.cos(x) * Math.sinh(y),
				}),
				complex: true,
			}],
			xMin: -5.1,
			xMax: 5.1,
			yMin: -1.4,
			yMax: 1.4,
		},

		// log(x+iy) complex plane
		{
			title: "Natural Logarithm over Complex Plane",
			formula: "log(<v>x</v>+<v>iy<v>)",
			blurb: "Logarithm is actually multi-valued, over complex numbers.  You can add or subtract π i, or integer multiples, from any value to get other values that are also correct.  The results actually spiral in the imaginary direction.  The dividing line between two layers, here, is along the negative real axis.  Near zero, of course, the logarithm shoots down to – ∞.",
			graphics: '3D',
			funcs: [{
				// sin(x+iy) = sin(x) cosh(y) + i cos(x) sinh(y)
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
