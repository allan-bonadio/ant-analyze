// configuration settings for the step widget, in particular the scenes

export let config = {
	scenes: [
		{
			title: "Simple Sine Wave",
			blurb: "The familiar Sine function crosses zero at integer multiples of π.  The angle is measured in radians, which is the angle you get when you crawl 1 radius length along the outside edge of a circle.",
			func: x => Math.sin(x),
			nPoints: 100,
			xMin: -6,
			xMax: 6,
		},
		{
			title: "sin(x) / x",
			blurb: "This is one of the most popular functions for graphing.  It actually has a singularity at x = 0, but it's a removable singularity.  The limit as x goes to zero is 1 because sin(x) is roughly equal to x near x = 0 .  As long as the graph doesn't try to evaluate at exactly zero, it'll look fine.",
			func: x => Math.sin(x) / x,
			nPoints: 200,  // must be even to avoid singularity
			xMin: -20,
			xMax: 20,
		},
		{
			title: "Sine of Reciprocal",
			blurb: "Because the reciprocal goes to infinity as you approach zero, the sine wave fluctuates wildly.  There is an essential singularity at x = 0; the value at zero is ambiguous, anywhere over -1 ... 1, and even beyond, if you approach from different angles over the complex plane.  The graph is almost impossible to draw near zero for that reason.",
			func: x => Math.sin(1/x),
			nPoints: 1000,  // needs more cuz of the tight curves
			xMin: -2,
			xMax: 2,
		},
	],
};

export default config;
