import Range from '@/common/util/range';
import Units from '@/common/units';
import GraphLib, { GraphNode } from '@/common/graphlib';

import Frequency from './util';

let node_types = [];

function make_oscillator(name, waveform) {
    let Oscillator = class extends GraphNode {
        constructor(options) {
            const outputs = [GraphNode.output('result', Units.Percentage)];
            const inputs = [
                GraphNode.input('frequency', 'frequency'),
                GraphNode.input('amplitude', 'range'),
                GraphNode.input('phase', Units.Percentage),
            ];
            let frequency = new Frequency(1);

            const properties = {
                frequency,
                amplitude: new Range(0, 1, 0, 1),
                phase: 0,
            };

            const config = {
                visualization: 'oscillator-plotter',
            };

            super(options, inputs, outputs, { properties, config });

            // TODO: rewrite waveform plotter as vue component
        }

        waveform(frequency, amplitude, cycles, t) {
            let phased_t = t + cycles * frequency.sec;
            return waveform(frequency, amplitude, phased_t);
        }

        value(t) {
            let frequency = this.getInputData(0);
            let amplitude = this.getInputData(1);
            let cycles = this.getInputData(2);
            return this.waveform(frequency, amplitude, cycles, t);
        }

        onExecute() {
            let t = this.graph.getGlobalInputData('t') / 60;
            let out = this.value(t);
            this.setOutputData(0, out);
        }
    };

    Oscillator.title = `${name} wave`;
    node_types.push([`oscillators/${name}`, Oscillator]);
}

make_oscillator('triangle', function(frequency, amplitude, t) {
    let lower = amplitude.lower;
    let upper = amplitude.upper;

    let a = upper - lower;

    let freq = frequency.hz;
    let p = 1/(2*freq);

    function mod(n, m) {
        return ((n % m) + m) % m;
    };

    return lower + (a/p) * (p - Math.abs(mod(t, 2*p) - p) );
});

make_oscillator('square', function(frequency, amplitude, t) {
    let lower = amplitude.lower;
    let upper = amplitude.upper;

    let freq = frequency.hz;
    let p = 1/(2*freq);

    let c = t % (2*p);

    if (c < 0)
        c += 2*p;

    if (c < p) {
        return lower;
    } else {
        return upper;
    }
});

make_oscillator('saw', function(frequency, amplitude, t) {
    let lower = amplitude.lower;
    let upper = amplitude.upper;

    let p = frequency.sec;

    let cyc = (t % p);
    if (cyc < 0)
        cyc += p;

    return lower + (upper - lower)*(cyc / p);
});

make_oscillator('sine', function(frequency, amplitude, t) {
    let lower = amplitude.lower;
    let upper = amplitude.upper;

    let a = (upper - lower) / 2;

    let p = frequency.sec;

    return lower + a * (Math.sin(t*2*Math.PI/p)+1);
});

make_oscillator('cos', function(frequency, amplitude, t) {
    let lower = amplitude.lower;
    let upper = amplitude.upper;

    let a = (upper - lower) / 2;

    let p = frequency.sec;

    return lower + a * (Math.cos(t*2*Math.PI/p)+1);
});

export default function register_oscillator_nodes() {
    GraphLib.registerNodeTypes(node_types);
};
