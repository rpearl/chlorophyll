import mixerFrag from '@/common/patterns/mixer.frag';
import RawPatternRunner from '@/common/patterns/runner';
import { ShaderRunner, getFloatingPointTextureOptions } from '@/common/util/shader_runner';

import * as twgl from 'twgl.js';
import * as glslify from 'glslify';

class ClipRunner {
    constructor(compositor, clip) {
        const {
            id,
            pattern,
            group,
            mapping,
            duration,
            fadeInTime,
            fadeOutTime,
            opacity,
            blendMode,
        } = clip;

        const {model, gl, mixer, uniforms} = compositor;
        this.id = id;
        this.gl = gl;
        this.time = 0;
        this.blendMode = blendMode;
        this.duration = duration;
        this.fadeInTime = fadeInTime;
        this.fadeOutTime = fadeOutTime;
        this.opacity = opacity;

        this.totalTime = duration + fadeInTime + fadeOutTime;

        this.mixer = mixer;
        this.uniforms = uniforms;

        this.runner = new RawPatternRunner(gl, model, pattern, group, mapping);
    }

    isDone() {
        return this.time >= this.totalTime;
    }

    getOpacity() {
        if (this.isDone()) {
            return 0;
        }
        const remaining = this.totalTime - this.time;
        let pct = this.opacity;
        if (this.time < this.fadeInTime) {
            pct *= (this.time / this.fadeInTime);
        } else if (remaining < this.fadeOutTime) {
            pct *= (remaining / this.fadeOutTime);
        }

        return pct;
    }

    step(background, pixels=null) {
        const texture = this.runner.step(this.time);
        this.time++;
        this.uniforms.texBackground = background;
        this.uniforms.texForeground = texture;
        this.uniforms.blendMode = this.blendMode;
        this.uniforms.opacity = this.getOpacity();
        console.log(this.getOpacity());

        this.mixer.step(pixels);

        return this.mixer.prevTexture();
    }

    detach() {
        this.runner.detach();
    }
}

export default class Compositor extends EventEmitter {
    constructor(gl, model) {
        this.gl = gl;
        this.model = model;

        this.clips = [];

        const uniforms = {
            texForeground: null,
            texBackground: null,
            blendMode: 1,
            opacity: 0,
        };

        const width = this.model.textureWidth;
        const height = width;

        this.mixer = new ShaderRunner({
            gl,
            width,
            height,
            numTargets: 3,
            fragmentShader: glslify.compile(mixerFrag),
            uniforms,
        });

        const blackArray = new Float32Array(width * width * 4);
        const textureOptions = {
            src: blackArray,
            ...getFloatingPointTextureOptions(gl, width, height),
        };

        this.initalTexture = twgl.createTexture(gl, textureOptions);

        this.uniforms = uniforms;
    }

    addClip(clip) {
        const runner = new ClipRunner(this, clip);
        this.clips.push(runner);
    }

    updateClips(allClips) {
        const oldClipIds = new Set(this.clips.map(clip => clip.id));
        const newClipIds = new Set();

        const newClips = [];

        for (const clip of allClips) {
            // if in new, but not old
            if (!oldClipIds.has(clip.id)) {
                const runner = new ClipRunner(this, clip);
                newClips.push(runner);
                newClipIds.add(clip.id);
            }
        }

        for (const clip of this.clips) {
            // in old, but not new
            if (!newClipIds.has(clip.id)) {
                clip.detach();
            }
        }
        this.clips = newClips;
    }

    step(pixels=null) {
        let background = this.initialTexture;
        for (let i = 0; i < this.clips.length - 1; i++) {
            const clip = this.clips[0];
            background = clip.step(background);
        }
        const last = this.clips[this.clips.length-1];
        let output = last.step(background, pixels);
        for (const clip of clips) {
            if (clip.isDone()) {
                clip.detach();
            }
        }
        this.clips = this.clips.filter(clip => !clip.isDone());
        return output;
    }
}
