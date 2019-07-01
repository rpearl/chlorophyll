<template>
    <div class="clip" :style="style">
        <div class="handle" @mousedown.stop="beginDrag(DragType.Start, $event)"/>
        <div class="pattern" @mousedown.stop="beginDrag(DragType.Move, $event)">
            {{clip.pattern.name}}
        </div>
        <div class="handle" @mousedown.stop="beginDrag(DragType.End, $event)" />
    </div>
</template>
<script>
import _ from 'lodash';
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
    props: ['output', 'clip', 'layerIndex', 'scale'],
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
        style() {
            const start = this.scale(this.clip.startTime);
            const end = this.scale(this.clip.endTime);
            const top = 32*this.layerIndex;
            return {
                left: `${start}px`,
                width: `${end-start}px`,
                top: `${top}px`,
            };
        },
    },
    beforeDestroy() {
    },
    methods: {
        togglePlay() {
            if (!this.clip.playing) {
                this.$emit('play-clip');
            } else {
                this.$emit('pause-clip');
            }
        },
        stop() {
            this.$emit('stop-clip');
        },
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
                const dLayer = Math.round(dY / 32);
                const layerIndex = this.dragInfo.initialLayerIndex + dLayer;
                this.$emit('change-layer', layerIndex);
            }

        },

        endDrag(event) {
            this.dragInfo = null;
            this.clip.startTime = Math.round(this.clip.startTime);
            this.clip.endTime = Math.round(this.clip.endTime);
            this.$emit('end-drag');
            window.removeEventListener('mousemove', this.drag);
            window.removeEventListener('mouseup', this.endDrag);
        }
    },
};
</script>
<style scoped lang="scss">
@import './src/style/aesthetic.scss';

.clip {
    position: absolute;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: $base-blue-2;
    border: 1px solid $base-blue-1;
    border-radius: $control-border-radius;
    color: $accent-text;
}

.handle {
    width: 10px;
    cursor: col-resize;
    align-self: stretch;
}


.pattern {
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    flex-grow: 1;
    cursor: move;
}

.mapping {
    margin-right: 2em;
}

</style>
