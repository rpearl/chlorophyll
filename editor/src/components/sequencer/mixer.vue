<template>
<div class="grid-container">
    <div class="clips panel">
        <draggable class="draggable" v-model="currentClips" :options="currentClipOptions">
            <template v-for="(item, index) in currentClips">
                <clip :key="item.id" :clip="item" :run-state="runState" />
            </template>
        </draggable>
    </div>
    <div class="patterns panel">
        <div class="flat-list">
            <ul>
              <draggable
               v-model="pattern_list"
               :options="patternListOptions"
               :clone="createClip">
              <li v-for="pattern in pattern_list" :key="pattern.id">
                <div />
                {{pattern.name}}
              </li>
              </draggable>
            </ul>
        </div>
    </div>
  <div class="topbar panel inline">
    <div class="control-row">
      <button class="square highlighted material-icons" @click="togglePlay">
        {{ runText }}
      </button>
    </div>
  </div>
</div>
</template>

<script>
import * as THREE from 'three';
import {bindFramebufferInfo} from 'twgl.js';
import draggable from 'vuedraggable';
import viewports from 'chl/viewport';
import store, {newgid} from 'chl/vue/store';

import Mixer from '@/common/patterns/mixer';
import { currentModel } from 'chl/model';

import { mappingUtilsMixin } from 'chl/mapping';
import { patternUtilsMixin } from 'chl/patterns';
import { mapGetters } from 'vuex';
import {RunState} from 'chl/patterns/preview';

import Clip from '@/components/sequencer/clip';

export default {
    name: 'mixer',
    store,
    components: { draggable, Clip },
    mixins: [mappingUtilsMixin, patternUtilsMixin],
    data() {
        return {
            runState: RunState.Stopped,
            mixer: null,
            currentClips: [],
        };
    },
    computed: {
        ...mapGetters('pattern', [
            'pattern_list',
        ]),
        ...mapGetters('mapping', [
            'mapping_list',
        ]),
        ...mapGetters('pixels', [
            'group_list',
        ]),
        currentClipOptions() {
            return {
                group: 'clips',
                sort: true,
                handle: '.drag',
            };
        },
        patternListOptions() {
            return {
                sort: false,
                group: {
                    name: 'clips',
                    pull: 'clone',
                    put: false,
                    revertClone: true,
                },
                ghostClass: 'clip-item',
            };
        },
        outputTexture() {
            return new THREE.Texture();
        },
        step() {
            const mixer = this.mixer;
            const {renderer} = viewports.getViewport('main');
            return () => {
                if (!this.running) {
                    return;
                }
                const texture = mixer.step();
                const properties = renderer.properties.get(this.outputTexture);
                properties.__webglTexture = texture;
                properties.__webglInit = true;
                this.glReset();
                currentModel.setFromTexture(this.outputTexture);
                //const times = this.mixer.getTimesByClipId();
                //for (const clip of this.currentClips) {
                //    clip.time = times[clip.id];
                //}
            }
        },
        runText() {
            return this.running ? 'pause' : 'play_arrow';
        },
        running() {
            return this.runState === RunState.Running;
        },
    },
    watch: {
        currentClips: {
            handler(clipList) {
                this.mixer.updateClips(this.currentClips);
            },
        },
    },
    mounted() {
        const {renderer} = viewports.getViewport('main');
        const gl = renderer.getContext();
        this.mixer = new Mixer(gl, currentModel);
        this.mixer.on('clip-ended', this.endClip);
    },
    methods: {
        endClip(endedClip) {
            this.currentClips = this.currentClips.filter(clip => clip.id !== endedClip.id);
        },
        createClip(pattern) {
            const group = this.group_list[0];
            const availableMappings = this.mappingsByType[pattern.mapping_type] || [];
            const mapping = availableMappings.length > 0 ? availableMappings[0] : null;
            const id = newgid();

            return {
                id,
                pattern,
                group,
                mapping,
                time: 0,
                duration: 60,
                fadeInTime: 10,
                fadeOutTime: 10,
                opacity: 1,
                blendMode: 1,
            };
        },
        togglePlay() {
            if (this.running) {
                this.pause();
            } else {
                this.play();
            }
        },
        play() {
            this.runState = RunState.Running;
            currentModel.display_only = true;
            this.run();
        },
        run() {
            this.step();
            if (this.running) {
                this.request_id = window.requestAnimationFrame(() => this.run());
            }
        },
        pause() {
            this.runState = RunState.Paused;
            if (this.request_id !== null) {
                window.cancelAnimationFrame(this.request_id);
            }
            this.request_id = null;
        },
        stop() {
            if (this.runState === RunState.Stopped) {
                return;
            }
            currentModel.display_only = false;
            this.pause();
            this.runState = RunState.Stopped;
            window.requestAnimationFrame(() => {
                this.glReset();
            });
        },
        glReset() {
            const {renderer} = viewports.getViewport('main');
            const gl = renderer.getContext();
            bindFramebufferInfo(gl, null);
            renderer.state.reset();
        },
    },
};
</script>

<style scoped lang="scss">
@import "~@/style/aesthetic.scss";
.grid-container {
    display: grid;
    grid-template-columns: 1fr 220px;
    grid-template-rows: 26px 1fr;
    grid-template-areas: "topbar patterns" "clips patterns";
    position: absolute;
    height: 100%;
    width: 100%;
    overflow: hidden;
}

.draggable {
    min-height: 100%;
    height: min-content;
}

.clips {
    border: 1px solid red;
    grid-area: clips;
    overflow: auto;
    height: auto;
}

.patterns {
    grid-area: patterns;
    height: auto;
    overflow: auto;
    position: relative;

    .flat-list {
        height: calc(100% - 10px);
    }
}
.topbar {
    grid-area: topbar;

    .topline-text {
        height: 26px;
        display: flex;
        align-items: center;
    }

}
</style>
