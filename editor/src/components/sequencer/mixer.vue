<template>
<div class="grid-container">
    <div class="panel">
        <draggable class="draggable" v-model="currentClips" :options="currentClipOptions">
        </draggable>
    </div>
    <div class="patterns panel">
        <div class="flat-list">
            <ul>
              <draggable
               v-model="pattern_list"
               :options="patternlistOptions"
               :clone="createClip">
              <li v-for="pattern in pattern_list" :key="pattern.id">
                <div />
                {{pattern.name}}
              </li>
              </draggable>
            </ul>
        </div>
    </div>
</div>
</template>

<script>
import draggable from 'vuedraggable';
import viewports from 'chl/viewport';

import { mappingUtilsMixin } from 'chl/mapping';
import { patternUtilsMixin } from 'chl/patterns';
import { mapGetters } from 'vuex';

export default {
    name: 'mixer',
    store,
    components: { draggable },
    mixins: [mappingUtilsMixin, patternUtilsMixin],
    data() {
        return {
            runstate: RunState.Stopped,
            mixer: null,
            currentclips: [],
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
    },
    watch: {
        currentClips: {
            handler(clipList) {
                this.mixer.updateClipList(clipList),
            },
            deep: true,
        },
    },
    mounted() {
        const {renderer} = viewports.getViewport('main');
        this.mixer = new Mixer(currentModel, renderer.getContext());
    },
    methods() {
        createClip(pattern_id) {
            const group = null;
            const availableMappings = this.mappingsByType[pattern.mapping_type] || [];

            const mapping_id = availableMappings.length > 0 ? availableMappings[0] : null;
            const id = this.newgid();

            const pattern = this.getPattern(pattern_id);
            const mapping = this.getMapping(mapping_id);

            return {
                pattern,
                group,
                mapping,
                duration: 60*60,
                fadeInTime: 60*10,
                fadeOutTime: 60*10,
                opacity: 1,
                blendMode: 1,
            },
        },
    },
};
</script>
