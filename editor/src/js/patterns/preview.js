import Vue from 'vue';
import Const from 'chl/const';
import { ArtnetRegistry } from '@/common/hardware/artnet';
import { PatternRunner } from 'chl/patterns/runner';
import { currentModel } from 'chl/model';
import viewports from 'chl/viewport';
import {bindFramebufferInfo} from 'twgl.js';
import Compositor from '@/common/patterns/compositor';
import * as THREE from 'three';

import * as pixelpusher from 'chl/hardware/pixelpusher';

export const RunState = {
    Stopped: 0,
    Running: 1,
    Paused: 2,
};

export const PatternPreview = Vue.component('pattern-preview', {
    props: [
        'pattern',
        'mapping',
        'group',
        'runstate',
        'pushToHardware',
        'hardwareSettings',
        'hardwareProtocol',
    ],

    data() {
        return {
            time: 0,
            request_id: null,
            fpsSampleStartTime: null,
            framesForSample: 0,
        };
    },

    computed: {
        step() {
            const width = currentModel.textureWidth;
            const pixelBuffers = [
                new Float32Array(width * width * 4),
                new Float32Array(width * width * 4),
            ];

            const { renderer } = viewports.getViewport('main');
            const gl = renderer.getContext();

            const compositor = new Compositor(gl, currentModel);
            const {pattern, group, mapping} = this;
            const clip = {
                pattern,
                group,
                mapping,
                duration: 60*60,
                fadeInTime: 60*10,
                fadeOutTime: 60*10,
                opacity: 1,
                blendMode: 1,
            };
            compositor.addClip(clip);

            const threeTexture = new THREE.Texture();

            return (time) => {
                const pixels = this.pushToHardware ? pixelBuffers[time % 2] : null;
                const texture = compositor.step(pixels); //this.runner.step(time, pixels);
                const properties = renderer.properties.get(threeTexture);
                properties.__webglTexture = texture;
                properties.__webglInit = true;
                bindFramebufferInfo(gl, null);
                renderer.state.reset();
                currentModel.setFromTexture(threeTexture);

                if (this.pushToHardware) {
                    switch (this.hardwareProtocol) {
                        case 'artnet':
                            this.artnetClient.sendFrame(pixels);
                            break;
                        case 'pixelpusher':
                            pixelpusher.pushPixels(currentModel, pixels);
                            break;
                        default:
                            break;
                    }
                }
            };
        },
        running() {
            return this.runstate == RunState.Running;
        },

        runner() {
            const {pattern, group, mapping} = this;
            return new PatternRunner(currentModel, pattern, group, mapping);
        },

        artnetClient() {
            if (this.hardwareProtocol !== 'artnet')
                return null;

            const registry = new ArtnetRegistry(currentModel, this.hardwareSettings);
            console.log(registry);
            return registry;
        },
    },

    beforeDestroy() {
        this.stop();
    },

    watch: {
        runstate(newval) {
            switch (newval) {
                case RunState.Stopped:
                    this.stop();
                    break;
                case RunState.Paused:
                    this.pause();
                    break;
                case RunState.Running:
                    this.start();
                    break;
            }
        },

        pushToHardware(newval) {
            if (!newval && this.runstate !== RunState.Stopped) {
                this.pushBlackFrame();
            }
        },
    },

    render() {},

    methods: {
        pushBlackFrame() {
            switch (this.hardwareProtocol) {
                case 'pixelpusher': {
                    pixelpusher.pushBlackFrame(currentModel);
                    break;
                }

                case 'artnet': {
                    const width = currentModel.textureWidth;
                    const pixels = new Float32Array(width * width * 4);
                    this.artnetClient.sendFrame(pixels);
                    break;
                }

                default:
                    break;
            }
        },
        countFps(timestamp) {
            this.framesForSample++;
            if (!this.fpsSampleStartTime) {
                this.fpsSampleStartTime = timestamp;
            } else {
                const d = timestamp - this.fpsSampleStartTime;
                if (d > Const.fps_sample_interval) {
                    const fps = 1000*(this.framesForSample-1) / d;
                    this.$emit('fps-sample-updated', fps);
                    this.resetFpsCounter();
                }
            }
        },
        resetFpsCounter() {
            this.fpsSampleStartTime = null;
            this.framesForSample = null;
        },
        run(timestamp) {
            this.step(this.time);
            this.countFps(timestamp);
            this.time++;
            if (this.running)
                this.request_id = window.requestAnimationFrame((timestamp) => this.run(timestamp));
        },
        start() {
            currentModel.display_only = true;
            this.run();
        },
        pause() {
            this.resetFpsCounter();
            if (this.request_id !== null) {
                window.cancelAnimationFrame(this.request_id);
            }
            this.request_id = null;
        },
        stop() {
            this.pause();
            currentModel.display_only = false;
            this.time = 0;
            if (this.pushToHardware) {
                this.pushBlackFrame();
            }
        }
    }
});
