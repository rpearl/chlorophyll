<template>
  <div class="grid-container">
    <div class="topbar panel inline">
        <div class="control-row">
      <button class="square highlighted material-icons" @click="togglePlay">
        {{ runText }}
      </button>
      <button @click="stop" class="square material-icons">stop</button>
      {{ this.time }}
        </div>
    </div>
    <div class="clips panel" ref="clips">
      <template v-for="(output, index) in outputs">
        <div class="output">
          <div class="grouplist">
            {{ output.groups[0].name }}
          </div>
          <div class="target">
            <template v-for="layer in output.layers">
              <div class="layer"
                   @dragover="patternDragged"
                   @drop="patternDropped(output, layerId, $event)"
                   />
            </template>
            <div v-if="output.pendingLayer"
               class="layer"
               @dragover="patternDragged"
               @drop="patternDropped(output, layerId, $event)"
            />
            <div class="layer ghost"
                 @dragover="patternDragged"
                 @drop="patternDroppedOnGhost(output, $event)"
                 />
            <template v-for="clip in output.clips">
              <clip
                :clip="clip"
                :output="output"
                :scale="scale"
                :layerIndex="layerIndexesById[clip.layerId]"
                @change-layer="newLayerIndex => changeClipLayer(output, clip, newLayerIndex)"
                @end-drag="endDrag(output, clip)"
                />
            </template>
          </div>
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

import Timeline from '@/common/patterns/timeline';
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
            timeline: null,
            runstate: RunState.Stopped,
            outputs: [],
            time: 0,
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
            return d3.scaleLinear().domain([0, 5*60*60]).range([0, this.width]);
        },
        runText() {
            return this.running ? 'pause' : 'play_arrow';
        },
        running() {
            return this.runstate === RunState.Running;
        },
        stopped() {
            return this.runstate === RunState.Stopped;
        },
        step() {
            const timeline = this.timeline;
            const {renderer} = viewports.getViewport('main');
            return () => {
                if (!this.running) {
                    return;
                }
                this.time++;
                const texture = timeline.step();
                const properties = renderer.properties.get(this.outputTexture);
                properties.__webglTexture = texture;
                properties.__webglInit = true;
                this.glReset();
                currentModel.setFromTexture(this.outputTexture);
            }
        },

        currentClips() {
            return _.flatten(this.outputs.map(output => output.clips.map(clip => {
                const layerIndex = this.layerIndexesById[clip.layerId];
                const layer = output.layers[layerIndex];
                return {
                    ...clip,
                    layerIndex,
                    blendingMode: layer.blendingMode,
                    group: output.groups[0],
                };
            })));
        },

        layerIndexesById() {
            const layerIndexesById = {};
            for (const output of this.outputs) {
                for (let i = 0; i < output.layers.length; i++) {
                    const layer = output.layers[i];
                    layerIndexesById[layer.id] = i;
                }
                if (output.pendingLayer) {
                    layerIndexesById[output.pendingLayer.id] = output.layers.length;
                }
            }
            return layerIndexesById;
        },
    },
    watch: {
        currentClips: {
            handler(clipList) {
                this.timeline.updateClips(this.currentClips);
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
        this.timeline = new Timeline(gl, currentModel);

        const initialOutputGroups = [this.group_list[0]];
        this.addOutput(initialOutputGroups)
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.resize);
    },
    methods: {
        addOutput(groups) {
            const id = newgid();
            this.outputs.push({
                id,
                groups,
                layers: [],
                clips: [],
                pendingLayer: null,
            });
        },
        createClip(pattern, layerId) {
            const group = this.group_list[0];
            const availableMappings = this.mappingsByType[pattern.mapping_type] || [];
            const mapping = availableMappings.length > 0 ? availableMappings[0] : null;
            const id = newgid();

            return {
                id,
                pattern,
                group,
                mapping,
                layerId,
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
        dragPattern(pattern, event) {
            event.dataTransfer.setData('text/plain', pattern.id);
            event.dataTransfer.dragEffect = 'link';
        },
        patternDragged(event) {
            event.preventDefault();
        },
        coords(pageX, pageY) {
            return Util.relativeCoords(this.$refs.clips, pageX, pageY);
        },
        _createClipFromDrop(event, layerId) {
            const patternId = event.dataTransfer.getData('text');
            const pattern = this.getPattern(patternId);
            const clip = this.createClip(pattern, layerId);

            const {pageX, pageY} = event;
            const coords = this.coords(pageX, pageY);
            const startTime = Math.floor(this.scale.invert(coords.x));
            const endTime = startTime + 60*60;
            clip.startTime = startTime;
            clip.endTime = endTime;
            return clip;
        },
        patternDropped(output, layerId, event) {
            const clip = this._createClipFromDrop(event, layerId);
            output.clips.push(clip);
            this.resolveOverlaps(output, clip);
        },

        addLayer(output, layerIndex, blendingMode, clips) {
            const id = newgid();
            const layer = {
                id,
                blendingMode,
            };
            for (const clip of clips) {
                clip.layerId = id;
            }
            output.layers.splice(layerIndex, 0, layer);
        },

        addToPendingLayer(output, blendingMode, clip) {
            if (!output.pendingLayer) {
                output.pendingLayer = {
                    id: newgid(),
                    blendingMode,
                };
            }
            clip.layerId = output.pendingLayer.id;
        },

        patternDroppedOnGhost(output, event) {
            const clip = this._createClipFromDrop(event);
            output.clips.push(clip);
            this.addLayer(output, output.layers.length, 1, [clip]);
        },
        resize() {
            this.width = this.$refs.clips.clientWidth;
        },

        changeClipLayer(output, clip, newLayerIndex) {
            const targetLayerIndex = _.clamp(newLayerIndex, 0, output.layers.length);
            const layerIndex = this.layerIndexesById[clip.layerId];
            if (targetLayerIndex === layerIndex) {
                return;
            }
            const layer = output.layers[layerIndex];
            if (targetLayerIndex === output.layers.length) {
                this.addToPendingLayer(output, layer.blendingMode, clip);
            } else {
                const newLayer = output.layers[targetLayerIndex];
                if (output.pendingLayer && clip.layerId === output.pendingLayer.id) {
                    output.pendingLayer = null;
                }
                clip.layerId = newLayer.id;
                this.resolveOverlaps(output, clip);
            }
        },

        endDrag(output, clip) {
            if (output.pendingLayer && clip.layerId === output.pendingLayer.id) {
                output.layers.push(pendingLayer);
            }
            output.pendingLayer = null;
            this.resolveOverlaps(output, clip);
        },

        resolveOverlaps(output, targetClip) {
            const layerId = targetClip.layerId;
            let overlap = false;

            for (const clip of output.clips) {
                if (clip.id === targetClip.id || clip.layerId !== layerId) {
                    continue;
                }
                const first  = _.minBy([clip, targetClip], clip => clip.startTime);
                const second = _.maxBy([clip, targetClip], clip => clip.startTime);
                // if the clip starting first ends after the second one starts, overlap
                if (first.endTime >= second.startTime) {
                    overlap = true;
                    break;
                }
            }

            if (overlap) {
                const layerIndex = this.layerIndexesById[targetClip.layerId];
                this.addLayer(output, layerIndex+1, layer.blendingMode, [targetClip]);
            }
        },

        togglePlay() {
            if (this.runstate == RunState.Running) {
                this.pause();
            } else {
                this.runstate = RunState.Running;
                this.run();
            }
        },
        start() {
            currentModel.display_only = true;
            this.run();
        },
        run() {
            this.runstate = RunState.Running;
            this.step();
            if (this.running) {
                this.request_id = window.requestAnimationFrame(this.run);
            }
        },
        pause() {
            if (this.request_id !== null) {
                window.cancelAnimationFrame(this.request_id);
            }
            this.request_id = null;
            this.runstate = RunState.Paused;
        },
        stop() {
            this.pause();
            this.runstate = RunState.Stopped;
            currentModel.display_only = false;
            this.timeline.stop();
            this.glReset();
        }
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

.target {
  position: relative;
}

.layer {
    height: 32px;

    border-left: 1px solid $control-border;
    border-right: 1px solid $control-border;
        border-bottom: 1px solid $control-border;

    &:first-of-type {
        border-top: 1px solid $control-border;
        border-top-left-radius: $control-border-radius;
        border-top-right-radius: $control-border-radius;
    }

    &:last-of-type {
        border-bottom-left-radius: $control-border-radius;
        border-bottom-right-radius: $control-border-radius;
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
