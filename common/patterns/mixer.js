import EventEmitter from 'events';
import mixerFrag from '@/common/patterns/mixer.frag';
import RawPatternRunner from '@/common/patterns/runner';
import { ShaderRunner, getFloatingPointTextureOptions } from '@/common/util/shader_runner';

import * as twgl from 'twgl.js';
import * as glslify from 'glslify';

class ClipRunner {
    constructor(mixer, clip) {
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

        const {model, gl, uniforms} = mixer;
        this.id = id;
        this.gl = gl;
        this.time = 0;
        this.blendMode = blendMode;
        this.duration = duration * 60;
        this.fadeInTime = fadeInTime * 60; // frames
        this.fadeOutTime = fadeOutTime * 60;
        this.opacity = opacity;

        this.totalTime = this.duration + this.fadeInTime + this.fadeOutTime;
        debugger;

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
        this.mixer.layerRunner.step(pixels);

        return this.mixer.layerRunner.prevTexture();
    }

    fadeOut() {
        const remaining = this.totalTime - this.time;
        this.totalTime = this.time + Math.min(this.fadeOutTime, remaining);
    }

    detach() {
        this.runner.detach();
        this.mixer.emit('clip-ended', this);
    }
}

export default class Mixer extends EventEmitter {
    constructor(gl, model) {
        super();
        this.gl = gl;
        this.model = model;

        this.clips = [];
        this.clipsById = new Map();

        const uniforms = {
            texForeground: null,
            texBackground: null,
            blendMode: 1,
            opacity: 0,
        };

        const width = this.model.textureWidth;
        const height = width;

        this.layerRunner = new ShaderRunner({
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
        this.clipsById.set(clip.id, runner);
    }

    getTimesByClipId() {
        const out = {};
        for (const clip of this.clips) {
            out[clip.id] = clip.time / 60; // seconds
        }
        return out;
    }

    updateClips(allClips) {
        const clipsAfterUpdate = [];
        const removedClipIds = new Set(this.clipsById.keys());
        for (const clip of allClips) {
            let runner;
            if (!this.clipsById.has(clip.id)) {
                runner = new ClipRunner(this, clip);
                this.clipsById.set(clip.id, runner);
            } else {
                runner = this.clipsById.get(clip.id);
            }

            clipsAfterUpdate.push(runner);
            removedClipIds.delete(clip.id);
        }

        for (const clipId of removedClipIds) {
            const clip = this.clipsById.get(clipId);
            clip.fadeOut();
        }
        this.clips = clipsAfterUpdate;
    }

    step(pixels=null) {
        let background = this.initialTexture;
        for (let i = 0; i < this.clips.length - 1; i++) {
            const clip = this.clips[0];
            background = clip.step(background);
        }
        const last = this.clips[this.clips.length-1];
        let output = last.step(background, pixels);
        for (const clip of this.clips) {
            if (clip.isDone()) {
                clip.detach();
                this.clipsById.delete(clip.id);
            }
        }
        this.clips = this.clips.filter(clip => !clip.isDone());
        return output;
    }
}
