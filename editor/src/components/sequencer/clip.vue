<template>
    <div class="clip" :style="style">
        <div class="drag clickable"><span class="material-icons">drag_handle</span></div>
        <div class="pattern">
            {{clip.pattern.name}}
        </div>
        <div class="mapping">
            <select class="control" v-model="mappingId">
                <template v-for="mapping in availableMappings">
                    <option :value="mapping.id">{{ mapping.name }}</option>
                </template>
            </select>
        </div>
        <div>
          <button class="square highlighted material-icons" @click="togglePlay">
            {{ runText }}
          </button>
          <button class="square highlighted material-icons" @click="stop">
            stop
          </button>
        </div>
        <div class="time">{{ timeFormatted }}</div>
    </div>
</template>
<script>
import Const, { ConstMixin } from 'chl/const';
import store from 'chl/vue/store';
import { mappingUtilsMixin } from 'chl/mapping';
import { mapGetters } from 'vuex';
import * as numeral from 'numeral';

export default {
    name: 'clip',
    store,
    mixins: [ConstMixin, mappingUtilsMixin],
    props: ['clip', 'scale'],
    data() {
        return {
            durationForEditing: null,
        }
    },
    computed: {
        ...mapGetters('pixels', [
            'group_list',
        ]),
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
            return {
                left: `${start}px`,
                width: `${end-start}px`,
            };
        },
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
        }
    },
};
</script>
<style scoped lang="scss">
@import './src/style/aesthetic.scss';

.clip {
    position: absolute;
    height: 2em;
    display: flex;
    align-items: center;
    border: 1px solid $panel-light;
    border-radius: $control-border-radius;
}

.clickable {
    cursor: pointer;
}

.drag {
    margin-top: 2px;
}

.pattern {
    padding-left: 2em;
    padding-right: 2em;
}

.mapping {
    margin-right: 2em;
}

.time {
    text-align: right;
    flex-grow: 1;
}

</style>
