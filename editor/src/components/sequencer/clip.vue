<template>
    <li class="clip">
        <div>
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
        <div>{{ timeFormatted }}</div>
        <div class="drag clickable"><span class="material-icons">drag_handle</span></div>
    </li>
</template>
<script>
/* eslint-disable */
import Const, { ConstMixin } from 'chl/const';
import store from 'chl/vue/store';
import { mappingUtilsMixin } from 'chl/mapping';
import { mapGetters } from 'vuex';
import * as numeral from 'numeral';

export default {
    name: 'clip',
    store,
    mixins: [ConstMixin, mappingUtilsMixin],
    props: ['clip', 'runState'],
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
</style>
