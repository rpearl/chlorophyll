<template>
    <g :transform="transform">
        <rect
            x="0"
            y="0"
            :width="width"
            :height="height"
            ry="4"
            class="clip"
            />
        <foreignObject x="10" :y="0" :width="width-20" :height="height">
        <div class="pattern-name">
            <div>
                {{ clip.pattern.name }}
            </div>
        </div>
        </foreignObject>

        <rect
            x="0"
            y="0"
            width="10"
            :height="height"
            class="drag-handle"
            @mousedown.stop="beginDrag(DragType.Start, $event)"/>
        <rect
            x="10"
            y="0"
            :width="width-20"
            :height="height"
            class="pattern"
            @mousedown.stop="beginDrag(DragType.Move, $event)" />
        <rect
            :x="width-10"
            y="0"
            width="10"
            :height="height"
            class="drag-handle"
            @mousedown.stop="beginDrag(DragType.End, $event)"/>
    </g>
</template>
<script>
import _ from 'lodash';
import Util from 'chl/util';
import Const, { ConstMixin } from 'chl/const';
import store from 'chl/vue/store';
import { mappingUtilsMixin } from 'chl/mapping';
import { mapGetters } from 'vuex';
import * as numeral from 'numeral';
const DragType = {
    Start: 1,
    End: 2,
    Move: 3,
};

export default {
    name: 'clip',
    store,
    mixins: [ConstMixin, mappingUtilsMixin],
    props: ['clip', 'layerIndex', 'scale', 'snap'],
    data() {
        return {
            dragInfo: null,
        }
    },
    watch: {
    },
    computed: {
        ...mapGetters('pixels', [
            'group_list',
        ]),
        DragType() {
            return DragType;
        },
        startTime() {
            return this.clip.startTime;
        },
        availableMappings() {
            return this.mappingsByType[this.clip.pattern.mapping_type];
        },
        timeInSeconds() {
            return this.clip.time / 60;
        },
        timeFormatted() {
            const minutes = Math.floor(this.timeInSeconds / 60);
            const seconds = this.timeInSeconds % 60;

            const minFormat = numeral(minutes).format('00');
            const secFormat = numeral(seconds).format('00.0');
            const ret = `${minFormat}:${secFormat}`;
            return ret;
        },
        runText() {
            return this.clip.playing ? 'pause' : 'play_arrow';
        },
        mappingId: {
            get() {
                return this.clip.mapping !== null ? this.clip.mapping.id : null;
            },
            set(mappingId) {
                this.updateItem({mapping: mappingId});
            },
        },
        transform() {
            const x = this.scale(this.clip.startTime);
            const y = 32*this.layerIndex + Const.timeline_track_padding;
            return `translate(${x}, ${y})`;
        },
        maxTextWidth() {
            return this.width - 40;
        },
        width() {
            return this.scale(this.clip.endTime) - this.scale(this.clip.startTime);
        },
        height() {
            return Const.timeline_track_height - 2*Const.timeline_track_padding;
        },
    },
    beforeDestroy() {
    },
    methods: {
        beginDrag(type, event) {
            const {x, y} = this.$parent.coords(event.pageX, event.pageY);
            this.dragInfo = {
                x,
                y,
                type,
                initialStart: this.clip.startTime,
                initialEnd: this.clip.endTime,
                initialLayerIndex: this.layerIndex,
            };
            window.addEventListener('mousemove', this.drag);
            window.addEventListener('mouseup', this.endDrag);
        },
        drag(event) {
            const {x, y} = this.$parent.coords(event.pageX, event.pageY);
            const dX = x - this.dragInfo.x;
            const dY = y - this.dragInfo.y;

            const dTime = this.scale.invert(dX);

            const {type, initialStart, initialEnd, initialLayerIndex} = this.dragInfo;

            if (_.includes([DragType.Start, DragType.Move], type)) {
                this.clip.startTime = initialStart + dTime;
            }

            if (_.includes([DragType.End, DragType.Move], type)) {
                this.clip.endTime = initialEnd + dTime;
            }

            if (type === DragType.Move) {
                const dLayer = Math.round(dY / Const.timeline_track_height);
                const layerIndex = this.dragInfo.initialLayerIndex + dLayer;
                this.$emit('change-layer', layerIndex);
            }

        },

        endDrag(event) {
            this.dragInfo = null;
            this.clip.startTime = Util.roundToInterval(this.clip.startTime, this.snap);
            this.clip.endTime = Util.roundToInterval(this.clip.endTime, this.snap);
            this.$emit('end-drag');
            window.removeEventListener('mousemove', this.drag);
            window.removeEventListener('mouseup', this.endDrag);
        }
    },
};
</script>
<style scoped lang="scss">
@import './src/style/aesthetic.scss';

.drag-handle {
    cursor: col-resize;
    fill: none;
}


.pattern {
    cursor: move;
    fill: none;
}

.clip {
    fill: $control-highlight;
    stroke: $control-highlight-border;
}

.mapping {
    margin-right: 2em;
}

.pattern-name {
    display: flex;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    align-items: center;
    color: $accent-text;

    height: 100%;
}

</style>
