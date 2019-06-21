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
        </div>
        <div class="duration">
                <masked-input
                  class="control duration-input"
                  type="text"
                  @focus="focusDuration"
                  @blur="blurDuration"
                  :mask="[/\d/, /\d/, ':', /\d/, /\d/, ]"
                  :keep-char-positions="true"
                  placeholder="mm:ss"
                  v-model="duration" />
        </div>
        <div v-if="timeRemainingFormatted !== null">{{ timeRemainingFormatted }}</div>
        <div class="drag clickable"><span class="material-icons">drag_handle</span></div>
    </li>
</template>
<script>
/* eslint-disable */
import Const, { ConstMixin } from 'chl/const';
import store from 'chl/vue/store';
import { mappingUtilsMixin } from 'chl/mapping';
import {RunState} from 'chl/patterns/preview';
import MaskedInput from 'vue-text-mask';
import { mapGetters } from 'vuex';
import * as numeral from 'numeral';

export default {
    name: 'clip',
    store,
    mixins: [ConstMixin, mappingUtilsMixin],
    props: ['clip', 'runState'],
    components: { MaskedInput },
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
        minutes() {
            return Math.floor(this.clip.duration / 60);
        },
        seconds() {
            return this.clip.duration % 60;
        },
        duration: {
            get() {
                if (this.durationForEditing !== null) {
                    return this.durationForEditing;
                }
                const minutes = numeral(this.minutes).format('00');
                const seconds = numeral(this.seconds).format('00');
                const ret = `${minutes}:${seconds}`;
                return ret;
            },
            set(val) {
                if (this.durationForEditing !== null) {
                    this.durationForEditing = val;
                }
            }
        },
        totalTime() {
            const {duration, fadeInTime, fadeOutTime} = this.clip;
            return duration + fadeInTime + fadeOutTime;
        },
        timeRemaining() {
            return this.totalTime - this.clip.time;
        },
        timeRemainingFormatted() {
            if (this.runState === RunState.Stopped) {
                return null;
            }

            const minutes = Math.floor(this.timeRemaining / 60);
            const seconds = this.timeRemaining % 60;

            const minFormat = numeral(minutes).format('00');
            const secFormat = numeral(seconds).format('00.0');
            const ret = `${minFormat}:${secFormat}`;
            return ret;
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
        focusDuration() {
            this.durationForEditing = this.duration;
        },
        blurDuration() {
            const duration = numeral(this.durationForEditing).value();
            this.durationForEditing = null;
            this.updateItem({duration});
        },
    },
};
</script>
<style scoped lang="scss">
@import './src/style/aesthetic.scss';
</style>
