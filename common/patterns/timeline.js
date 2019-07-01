import mixerFrag from '@/common/patterns/mixer.frag';
import RawPatternRunner from '@/common/patterns/runner';
import { ShaderRunner, getFloatingPointTextureOptions } from '@/common/util/shader_runner';
import _ from 'lodash';

import * as twgl from 'twgl.js';
import * as glslify from 'glslify';

export default class Timeline {
    constructor(gl, model) {
        this.gl = gl;
        this.model = model;

        this.time = 0;

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
        this.clipsByStartTime = {};

        this.uniforms = uniforms;
    }

    getOrCreateClip({id, pattern, group, mapping, startTime, endTime}) {
        if (this.clipsById.has(id)) {
            const clip = this.clipsById.get(id);
            return clip;
        }
        const {gl, model} = this;
        const runner = new RawPatternRunner(gl, model, pattern, group, mapping);
        const clip = {
            id,
            runner,
            pattern,
            group,
            mapping,
            startTime,
            endTime,
            time: 0,
            opacity: 0,
            blendMode: 1,
            playing: false,
        };
        this.clipsById.set(id, clip);
        return clip;
    }

    updateClips(clipInfos) {
        const clipsAfterUpdate = [];
        const removedClipIds = new Set(this.clipsById.keys());
        for (const clipInfo of clipInfos) {
            const clip = this.getOrCreateClip(clipInfo);
            clip.layerIndex = clipInfo.layerIndex;
            clip.startTime = clipInfo.startTime;
            clip.endTime = clipInfo.endTime;

            if (this.time >= clip.startTime && this.time <= clip.endTime) {
                clip.playing = true;
            }
            clipsAfterUpdate.push(clip);
            removedClipIds.delete(clip.id);
        }

        for (const clipId of removedClipIds) {
            const clip = this.clipsById.get(clipId);
            this.clipsById.delete(clipId);
            clip.runner.detach();
        }
        this.clips = _.sortBy(clipsAfterUpdate, clip => clip.layerIndex);
        this.clipsByStartTime = _.groupBy(this.clips, clip => clip.startTime);
    }

    stop() {
        for (const clip of this.clips) {
            const {pattern, group, mapping} = clip;
            const {gl, model} = this;
            clip.runner.detach();
            clip.runner = new RawPatternRunner(gl, model, pattern, group, mapping);
            clip.time = 0;
            clip.playing = false;
        }
        this.time = 0;
    }

    step(pixels=null) {
        const startingClips = this.clipsByStartTime[this.time] || [];
        for (const clip of startingClips) {
            clip.playing = true;
        }

        let activeLayers = [];

        for (const clip of this.clips) {
            if (clip.endTime <= this.time) {
                clip.playing = false;
            }
            if (!clip.playing) {
                continue;
            }
            const texture = clip.runner.step(clip.time);
            clip.time++;
            const {blendMode, opacity} = clip;
            activeLayers.push({texture, blendMode, opacity});
        }

        let background = this.initialTexture;
        for (let i = 0; i < activeLayers.length; i++) {
            const {texture, blendMode, opacity} = activeLayers[i];
            this.uniforms.texBackground = background;
            this.uniforms.texForeground = texture;
            this.uniforms.blendMode = blendMode;
            this.uniforms.opacity = 1;
            const usePixels = (i === activeLayers.length-1);
            this.mixer.step(usePixels ? pixels : null);
            background = this.mixer.prevTexture();
        }
        this.time++;
        return background;
    }
}
