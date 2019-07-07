<template>
  <div class="grid-container">
    <div class="topbar panel inline">
        <div class="control-row">
      <button class="square highlighted material-icons" @click="togglePlay">
        {{ runText }}
      </button>
      <button @click="onStop" class="square material-icons">stop</button>
      {{ this.timeFormatted }}
        </div>
    </div>
    <div class="clips panel" ref="clips">
      <div class="timeline-container" :style="timelineContainerStyle">
        <vue-context ref="menu">
          <template slot-scope="child" v-if="child.data">
            <li
              v-for="mode in blendingModes"
              :class="{control: true, selected: child.data.blendingMode === mode.value}"
              @click.prevent="setMode(child.data, mode.value)">
              <div>{{ mode.description }}</div><span class="material-icons">check</span>
            </li>
          </template>
        </vue-context>
        <div class="sidebar" :style="sidebarStyle">
          <div class="outputs">
            <template v-for="(layer, index) in layers">
              <div class="item" :class="sidebarLayerClass(layer)" :style="sidebarItemStyle(index*Const.timeline_track_height)" />
            </template>
            <template v-for="{output, offset} in outputLayout">
              <div class="output item" :class="sidebarOutputClass(output)" :style="sidebarItemStyle(offset)">
                <div class="label" :style="{height: `${Const.timeline_track_height}px`}">
                  <div>{{ output.groups[0].name }}</div>
                </div>
              </div>
            </template>
          </div>
          <div class="layers">
            <template v-for="(layer, index) in layers">
              <div class="item"
                   :class="sidebarLayerClass(layer)"
                   :style="sidebarItemStyle(index*Const.timeline_track_height)">
                <div class="label" :style="{height: `${Const.timeline_track_height}px`}">
                    <numeric-input :dragscale="200" style="width: 4em" :value="layer.opacity * 100" :min="0" :max="100" :precision="0" @input="val => setOpacity(layer, val)" />
                    <div class="material-icons clickable" @click.stop="openMenu($event, layer)">filter</div>
                </div>
              </div>
            </template>
          </div>
        </div>
        <div class="canvas-container" :style="canvasContainerStyle">
          <div :style="canvasStyle" ref="canvas">
            <svg class="canvas" :width="canvasWidth" :height="totalHeight">
              <g transform="translate(0, -0.5)">
                <template v-for="[pos, {opacity, classed}] in visibleTicks">
                  <line :x1="pos" :x2="pos"
                        :y1="-4"   :y2="totalHeight"
                        :style="{opacity}"
                        :class="[classed, 'tick']"
                        />
                </template>
                <template v-for="(layer, index) in layers">
                  <rect :x="0"
                        :y="index*Const.timeline_track_height"
                        :width="canvasWidth"
                        :height="Const.timeline_track_height"
                        class="layer"
                        @dragover="patternDragged"
                        @drop="patternDropped(layer.id, $event)" />
                  <line x1="0" :y1="(index+1)*Const.timeline_track_height"
                        :x2="canvasWidth" :y2="(index+1)*Const.timeline_track_height"
                        class="layer-line" />
                </template>
                <template v-for="clip in clips">
                  <clip
                    :clip="clip"
                    :scale="scale"
                    :snap="snap"
                    :layerIndex="layerIndexesById[clip.layerId]"
                    @change-layer="newLayerIndex => changeClipLayer(clip, newLayerIndex)"
                    @end-drag="endDrag(clip)" />
                </template>
              </g>
              <line v-if="time > 0"
                    :x1="linePos" y1="0"
                    :x2="linePos" :y2="totalHeight"
                    class="time" />

            </svg>
          </div>
        </div>
      </div>
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
/*

      <!--
      -->
      */
import { VueContext } from 'vue-context';
import * as d3 from 'd3';
import _ from 'lodash';
import * as THREE from 'three';
import {bindFramebufferInfo} from 'twgl.js';
import Const, { ConstMixin } from 'chl/const';
import modes from '@/common/util/blending_modes';
import viewports from 'chl/viewport';
import store, {newgid} from 'chl/vue/store';
import * as numeral from 'numeral';

import Timeline from '@/common/patterns/timeline';
import { currentModel } from 'chl/model';

import Util from 'chl/util';
import { mappingUtilsMixin } from 'chl/mapping';
import { patternUtilsMixin } from 'chl/patterns';
import { mapGetters } from 'vuex';
import {RunState} from 'chl/patterns/preview';

import Clip from '@/components/sequencer/clip';
import NumericInput from '@/components/widgets/numeric_input';


const DISPLAY_THRESHOLD = 10;
function frame(interval) {
    return {interval, classed: 'tick-frame'};
}
function seconds(inp) {
    const interval = inp*60;
    return {interval, classed: 'tick-seconds'};
}
function minutes(inp) {
    const interval = inp*60*60;
    return {interval, classed: 'tick-minutes'};
}
const tickIntervals = [
  ...[1, 15, 30].map(frame),
  ...[1, 5, 10, 15, 30].map(seconds),
  ...[1, 5].map(minutes),
].reverse();

const MAX_SCENE_LENGTH = 60*60*60;

export default {
    name: 'timeline',
    store,
    components: { Clip, VueContext, NumericInput },
    mixins: [mappingUtilsMixin, patternUtilsMixin, ConstMixin],
    data() {
        return {
            width: 0,
            height: 0,
            timeline: null,
            runstate: RunState.Stopped,
            outputOrder: [],
            outputsById: {},
            layersById: {},
            clipsById: {},
            domain: [0, 5*60*60],
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
        blendingModes() {
            return modes;
        },
        scale() {
            return d3.scaleLinear().domain(this.domain).range([0, this.width]);
        },
        linePos() {
            return this.scale(this.time);
        },
        canvasWidth() {
            return this.scale(MAX_SCENE_LENGTH);
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
                const {texture, done} = timeline.step();
                const properties = renderer.properties.get(this.outputTexture);
                properties.__webglTexture = texture;
                properties.__webglInit = true;
                this.glReset();
                currentModel.setFromTexture(this.outputTexture);
                if (done) {
                    this.runstate = RunState.Stopped;
                }
            }
        },
        outputs() {
            return this.outputOrder.map(outputId => this.outputsById[outputId]);
        },
        layers() {
            return _.flatten(this.outputs.map(output => this.outputLayers(output)));
        },
        clipsByLayerId() {
            const clips = _.values(this.clipsById);
            return _.groupBy(clips, clip => clip.layerId);
        },
        clips() {
            return _.values(this.clipsById);
        },
        runnableClips() {
            const out = [];
            for (const output of this.outputs) {
                const clips = this.outputClips(output);
                for (const clip of clips) {
                    const layer = this.layersById[clip.layerId];
                    out.push({
                        ...clip,
                        fadeInTime: 10*60,
                        fadeOutTime: 10*60,
                        groups: output.groups,
                        blendingMode: layer.blendingMode,
                        opacity: layer.opacity,
                    });
                }
            }
            return out;

        },
        layerIndexesById() {
            const out = {};
            let i = 0;
            for (const layer of this.layers) {
                out[layer.id] = i;
                i++;
            }
            return out;
        },
        outputLayout() {
            let sum = 0;
            let outputs = [];
            for (const output of this.outputs) {
                const offset = sum;
                const height = this.outputHeight(output);
                sum += height;
                outputs.push({output, offset, height});
            }
            return outputs;
        },
        totalHeight() {
            const outputHeight = _.sumBy(this.outputLayout, layout => layout.height);
            return Math.max(this.height, outputHeight);
        },
        timelineContainerStyle() {
            return {
                height: `${this.height}px`,
            };
        },
        sidebarStyle() {
            return {
                width: '200px',
            };
        },
        canvasContainerStyle() {
            return {
                width: `${this.width - 200}px`,
                height: `${this.totalHeight}px`,
            };
        },
        canvasStyle() {
            return {
                width: `${this.canvasWidth}px`,
                height: `${this.totalHeight}px`,
            };
        },
        currentClips() {
            return [];
        },
        timeFormatted() {
            const totalSeconds = this.time / 60;
            const seconds = totalSeconds % 60;
            const minutes = Math.floor(totalSeconds / 60);
            const minutesString = numeral(minutes).format('00');
            const secondsString = numeral(seconds).format('00.0');

            return `${minutesString}:${secondsString}`;
        },

        visibleIntervals() {
            return tickIntervals.filter(({interval}) => {
                const diff = this.scale(interval);
                return diff >= DISPLAY_THRESHOLD;
            }).map(tick => ({...tick, step: Math.log2(tick.interval)}));
        },

        visibleTicks() {
            if (this.canvasWidth == 0) {
                return [];
            }
            const start = 0;
            const end = MAX_SCENE_LENGTH;
            const out = new Map();

            const visibleIntervals = this.visibleIntervals;

            const stepMin = _.last(visibleIntervals).step;
            const stepMax = _.first(visibleIntervals).step;
            for (let { interval, classed, step} of visibleIntervals) {
                let opacity = d3.easeQuadIn(Util.map(step, stepMin, stepMax, 0.15, 1));
                opacity = _.clamp(opacity, 0.15, 1);
                const istart = Math.ceil(start / interval) * interval;
                const iend = Math.floor(end / interval) * interval;
                if (opacity < 0.5) {
                    classed += ' tick-dotted';
                }
                let curTicks = d3.range(istart, iend+interval, interval).map(this.scale);
                for (let tick of curTicks) {
                    if (out.get(tick) === undefined && tick !== 0) {
                        out.set(tick, { opacity, classed });
                    }
                }
            }
            return [...out.entries()];
        },
        snap() {
            return _.last(this.visibleIntervals).interval;
        },
    },
    watch: {
        runnableClips: {
            handler(clipList) {
                this.timeline.updateClips(clipList);
            },
        },
        runstate(state) {
            switch(state) {
                case RunState.Running: {
                    this.start();
                    break;
                }
                case RunState.Paused: {
                    this.pause();
                    break;
                }
                case RunState.Stopped: {
                    this.stop();
                    break;
                }
            }
        },
    },
    mounted() {
        window.addEventListener('resize', this.resize);
        this.resize();

        const {renderer} = viewports.getViewport('main');
        const gl = renderer.getContext();
        this.timeline = new Timeline(gl, currentModel);

        const initialOutputGroups = [this.group_list[0]];
        this.addOutput(initialOutputGroups);
        this.addOutput([this.group_list[1]]);
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.resize);
    },
    methods: {
        addOutput(groups) {
            const id = newgid();
            const output = {
                id,
                groups,
                layerIds: [],
                dragPatternOffset: null,
            };
            this.$set(this.outputsById, id, output);
            this.outputOrder.push(id);
            this.addLayer(output, 0, 1, []);
        },
        createClip(pattern, layerId) {
            const availableMappings = this.mappingsByType[pattern.mapping_type] || [];
            const mapping = availableMappings.length > 0 ? availableMappings[0] : null;
            const id = newgid();

            return {
                id,
                pattern,
                mapping,
                layerId,
                time: 0,
                playing: false,
            };
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
            this.dragPatternOffset = event.offsetX;
        },
        patternDragged(event) {
            event.preventDefault();
        },
        coords(pageX, pageY) {
            return Util.relativeCoords(this.$refs.canvas, pageX, pageY);
        },
        patternDropped(layerId, event) {
            const patternId = event.dataTransfer.getData('text');
            const pattern = this.getPattern(patternId);
            const clip = this.createClip(pattern, layerId);

            const {pageX, pageY} = event;
            const coords = this.coords(pageX, pageY);
            const startTime = Util.roundToInterval(this.scale.invert(coords.x-this.dragPatternOffset), this.snap);
            const endTime = startTime + 60*60;
            clip.startTime = startTime;
            clip.endTime = endTime;
            this.dragPatternOffset = 0;
            this.$set(this.clipsById, clip.id, clip);
            this.resolveOverlaps(clip);
            this.resolveGaps();
        },
        outputLayers(output) {
            return output.layerIds.map(layerId => this.layersById[layerId]);
        },
        outputClips(output) {
            return _.flatten(output.layerIds.map(layerId => this.clipsByLayerId[layerId] || []));
        },
        addLayer(output, layerIndex, blendingMode, clips) {
            const id = newgid();
            const layer = {
                id,
                blendingMode,
                opacity: 1,
                outputId: output.id,
            };
            for (const clip of clips) {
                clip.layerId = id;
            }
            this.$set(this.layersById, id, layer);
            output.layerIds.splice(layerIndex, 0, id);
        },
        getOutputForClip(clip) {
            const layer = this.layersById[clip.layerId];
            const output = this.outputsById[layer.outputId];
            return output;
        },
        resize() {
            this.width = this.$refs.clips.clientWidth;
            this.height = this.$refs.clips.clientHeight;
        },
        changeClipLayer(clip, newLayerIndex) {
            const newLayerId = this.layers[newLayerIndex].id;
            if (clip.layerId === newLayerId) {
                return;
            }

            clip.layerId = newLayerId;
            this.resolveOverlaps(clip);
        },
        outputHeight(output) {
            const numLanes = output.layerIds.length;
            return numLanes * Const.timeline_track_height;
        },
        sidebarItemStyle(offset) {
            return {
                top: `${offset}px`,
                height: `${Const.timeline_track_height}px`,
            };
        },
        sidebarOutputClass(output) {
            return output.layerIds.length === 1 ? 'last' : '';
        },
        sidebarLayerClass(layer) {
            const output = this.outputsById[layer.outputId];
            if (_.last(output.layerIds) === layer.id) {
                return 'last';
            } else {
                return '';
            }
        },
        isLayerEmpty(layerId) {
            const layerClips = this.clipsByLayerId[layerId] || [];
            return layerClips.length === 0;
        },
        resolveGaps() {
            for (const output of this.outputs) {
                const lastId = _.last(output.layerIds);
                const lastIsEmpty = this.isLayerEmpty(lastId);

                const [empty, nonEmpty] = _.partition(output.layerIds, layerId => this.isLayerEmpty(layerId) && layerId !== lastId);

                for (const layerId of empty) {
                    this.$delete(this.layersById, layerId);
                }
                output.layerIds = nonEmpty;
                if (!lastIsEmpty) {
                    this.addLayer(output, output.layerIds.length, 1, []);
                }
            }
        },
        endDrag(clip) {
            this.resolveOverlaps(clip);
            this.resolveGaps();
        },
        resolveOverlaps(targetClip) {
            const layerId = targetClip.layerId;
            const clips = this.clipsByLayerId[layerId];
            let overlap = false;

            for (const clip of clips) {
                if (clip.id === targetClip.id) {
                    continue;
                }
                const first  = _.minBy([clip, targetClip], clip => clip.startTime);
                const second = _.maxBy([clip, targetClip], clip => clip.startTime);
                // if the clip starting first ends after the second one starts, overlap
                if (first.endTime > second.startTime) {
                    overlap = true;
                    break;
                }
            }

            if (overlap) {
                const output = this.getOutputForClip(clip);
                const layerIndex = output.layerIds.indexOf(layerId);
                const layer = this.layersById[layerId];
                this.addLayer(output, layerIndex+1, layer.blendingMode, [targetClip]);
            }
        },
        setMode(layer, mode) {
            layer.blendingMode = mode;
        },

        togglePlay() {
            if (this.runstate == RunState.Running) {
                this.runstate = RunState.Paused;
            } else {
                this.runstate = RunState.Running;
            }
        },
        start() {
            currentModel.display_only = true;
            this.run();
        },
        run() {
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
        },
        onStop() {
            this.runstate = RunState.Stopped;
        },
        stop() {
            this.pause();
            this.time = 0;
            currentModel.display_only = false;
            this.timeline.stop();
            this.glReset();
        },
        openMenu(event, layer) {
            this.$refs.menu.open(event, layer);
            this.$nextTick(() => {
                this.$refs.menu.$el.scrollTop = 0;
            });
        },
        setOpacity(layer, val) {
            layer.opacity = val / 100;
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
    height: 100%;
    width: 100%;
}

.target {
  position: relative;
}

.clips {
    grid-area: clips;
    position: relative;
    height: auto;
    display: flex;
    width: 100%;
    overflow: hidden;
}

.canvas-container {
    overflow-x: scroll;
    overflow-y: hidden;
    height: 100%;
}

.timeline-container {
    display: flex;
    overflow-y: scroll;
}

.v-context {
  background-color: $panel-bg;
  color: $panel-text;

  height: 10em;
  overflow-y: scroll;

  li {
    cursor: pointer;
    display: flex;
    align-items: center;

    div {
      flex: 1;
    }

    span {
      display: none;
    }

    &.selected {
      background-color: $accent;
      color: $accent-text;
      span {
        display: block;
        width: 2em;
      }
    }
  }

  li:hover {
    background-color: $panel-light;

    &.selected {
      background-color: $control-highlight;
    }
  }

}


.sidebar {
    display: flex;
    border-right: 1px solid $panel-dark;

    .layers {
        position: relative;
        width: 6em;
    }

    .outputs {
        position: relative;
        flex: 1;
    }

    .item {
      border-bottom: 1px dotted $panel-dark;
      box-sizing: border-box;
      position: absolute;
      width: 100%;
      .label {
        width: 100%;
        display: flex;
        align-items: center;
      }

      &.last {
        border-bottom: 1px solid $panel-darker;
      }
    }
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

.canvas {
    position: relative;
    display: block;
    text {
        fill: $panel-text;
    }

    .layer {
        stroke: none;
        fill: none;
    }
    .layer-line {
        stroke-width: 1;
        stroke: darken($panel-bg, 5%);
    }
}

.time {
    stroke: darken($base-blue-1, 10%);
    stroke-width: 1;
}

.tick {
    stroke: white;
}
.tick-dotted {
    stroke-dasharray: 8,24;
}
.tick-minutes {
    &.tick-dotted {
        stroke-dasharray: 2,1;
    }
}
</style>
