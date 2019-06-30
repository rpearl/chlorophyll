<template>
  <div class="grid-container">
    <div class="clips panel" ref="clips">
      <template v-for="(output, index) in currentOutputs">
        <div class="output">
            <div class="grouplist">
                {{ output.groups[0].name }}
            </div>
            <template v-for="(layer, index) in output.layers">
                <div class="layer"
                     @dragover="patternDragged"
                     @drop="patternDropped(output, index, $event)"
                 >
                    <template v-for="(item, index) in layer.clips">
                      <clip
                        :key="item.id"
                        :clip="item"
                        :scale="scale"
                        @play-clip="playClip(item)"
                        @pause-clip="pauseClip(item)"
                        @stop-clip="stopClip(item)"
                        />
                    </template>
                </div>
            </template>
            <div class="layer ghost"
                 @dragover="patternDragged"
                 @drop="patternDroppedOnGhost(output, $event)"
            />
        </div>
      </template>
    </div>
    <div class="patterns panel">
      <div class="flat-list">
        <ul>
            <li v-for="pattern in pattern_list" :key="pattern.id">
              <div draggable="true" @dragstart="dragPattern(pattern, $event)">{{pattern.name}}</div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import * as d3 from 'd3';
import _ from 'lodash';
import * as THREE from 'three';
import {bindFramebufferInfo} from 'twgl.js';
import draggable from 'vuedraggable';
import viewports from 'chl/viewport';
import store, {newgid} from 'chl/vue/store';

import Mixer from '@/common/patterns/mixer';
import { currentModel } from 'chl/model';

import Util from 'chl/util';
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
            width: 0,
            mixer: null,
            currentOutputs: [],
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
        outputTexture() {
            return new THREE.Texture();
        },
        scale() {
            return d3.scaleLinear().domain([0, 60*60]).range([0, this.width]);
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
                this.updateTimes();
            }
        },

        currentClips() {
            const nestedClips = this.currentOutputs.map(output => {
                return output.layers.map(layer => layer.clips);
            });
            return _.flattenDeep(nestedClips);
        },

        playingClips() {
            return this.currentClips.filter(clip => clip.playing);
        },

        running() {
            return this.playingClips.length > 0;
        },
    },
    watch: {
        currentClips: {
            handler(clipList) {
                this.mixer.updateClips(this.currentClips);
            },
        },
        running() {
            if (this.running) {
                console.log('running');
                this.run();
            }
            currentModel.display_only = this.running;
        },
    },
    mounted() {
        window.addEventListener('resize', this.resize);
        this.resize();

        const {renderer} = viewports.getViewport('main');
        const gl = renderer.getContext();
        this.mixer = new Mixer(gl, currentModel);

        const initialOutputGroups = [this.group_list[0]];
        this.addOutput(initialOutputGroups)
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.resize);
    },
    methods: {
        addOutput(groups) {
            this.currentOutputs.push({
                groups,
                layers: [],
            });
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
                playing: false,
            };
        },
        playClip(clip) {
            clip.playing = true;
            this.mixer.playClip(clip.id);
        },

        stopClip(clip) {
            clip.playing = false;
            this.mixer.stopClip(clip.id);
            this.updateTimes();
        },

        pauseClip(clip) {
            clip.playing = false;
            this.mixer.pauseClip(clip.id);
        },

        run() {
            this.step();
            if (this.running) {
                this.request_id = window.requestAnimationFrame(() => this.run());
            }
        },
        glReset() {
            const {renderer} = viewports.getViewport('main');
            const gl = renderer.getContext();
            bindFramebufferInfo(gl, null);
            renderer.state.reset();
        },
        updateTimes() {
            const times = this.mixer.getTimesByClipId();
            for (const clip of this.currentClips) {
                clip.time = times[clip.id];
            }
        },
        dragPattern(pattern, event) {
            console.log('dragPattern', pattern);
            event.dataTransfer.setData('text/plain', pattern.id);
            event.dataTransfer.dragEffect = 'link';
        },
        patternDragged(event) {
            event.preventDefault();
        },
        _createClipFromDrop(event) {
            const patternId = event.dataTransfer.getData('text');
            const pattern = this.getPattern(patternId);
            const clip = this.createClip(pattern);

            const {pageX, pageY} = event;
            const coords = Util.relativeCoords(this.$refs.clips, pageX, pageY);
            const startTime = Math.floor(this.scale.invert(coords.x));
            const endTime = startTime + 60*60;
            clip.startTime = startTime;
            clip.endTime = endTime;
            return clip;
        },
        patternDropped(output, index, event) {
            const clip = this._createClipFromDrop(event);
            output.layers[index].clips.push(clip);
        },
        patternDroppedOnGhost(output, event) {
            const clip = this._createClipFromDrop(event);
            const layer = {
                blendingMode: 1,
                clips: [clip],
            };
            output.layers.push(layer);
        },
        resize() {
            this.width = this.$refs.clips.clientWidth;
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

.output {
    display: flex;
    flex-direction: column;
    min-height: 5em;

    .grouplist {
        flex: 0 0;
    }
    .draggable {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }
}

.layer {
    min-height: 5em;
    border: 1px solid red;
    position: relative;
    .ghost {
        border: 1px solid green;
    }
}

.clips {
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
