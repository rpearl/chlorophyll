<template>
  <div id="group-config" class="panel">
    <section>
      <h1>Group settings: {{ name }} </h1>
      <div class="controls">
        <div class="control-row">
          <label>name</label>
          <input type="text" class="control"
                 v-model.lazy.trim="name">
        </div>
        <div class="control-row">
          <label>color</label>
          <colorpicker-input v-model="color" />
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import { newgid } from 'chl/vue/store';
import { mappingUtilsMixin } from 'chl/mapping';
import { UniqueNameMixin } from 'chl/util';

import ColorpickerInput from '@/components/widgets/colorpicker';

export default {
    name: 'group-config',
    props: ['group'],
    mixins: [mappingUtilsMixin, UniqueNameMixin('Mapping', 'mapping/mapping_list')],
    components: { ColorpickerInput },
    data() {
        return {
            create_mapping_type: 'projection',
        };
    },
    computed: {
        name: {
            get() {
                return this.group.name;
            },
            set(val) {
                this.$store.commit('pixels/set_name', {
                    id: this.group.id,
                    name: val
                });
            }
        },
        color: {
            get() {
                return this.group.color;
            },
            set(color) {
                this.$store.commit('pixels/set_color', {
                    id: this.group.id,
                    color,
                });
            }
        }
    },
    methods: {
        newMapping(group) {
            const id = newgid();
            const name = this.uniqueMappingName();
            this.$store.commit('mapping/create_mapping', {
                id,
                name,
                group: this.group.id,
                type: this.create_mapping_type,
            });
            this.$emit('new_mapping', id);
        }
    }
};
</script>

<style scoped>
</style>
