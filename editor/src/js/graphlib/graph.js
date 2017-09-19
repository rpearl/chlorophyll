import Immutable from 'immutable';
import Util from 'chl/util';
import Const from 'chl/const';

import { newgid } from 'chl/vue/store';

let node_types = Immutable.OrderedMap();
let graphs = new Map();

export const GraphLib = {
    registerNodeType(path, constructor) {
        if (Object.getPrototypeOf(constructor) != GraphNode)
            throw new Error('All registered node types must inherit from GraphNode');

        node_types = node_types.set(path, constructor);
        constructor.type = path;
    },
    registerNodeTypes(node_list) {
        for (let [path, constructor] of node_list) {
            this.registerNodeType(path, constructor);
        }
    },
    getNodeTypes() {
        return node_types;
    },

    graphById(id) {
        return graphs.get(id);
    }
};

export default GraphLib;

export class Graph {
    constructor() {
        Util.EventDispatcher.call(this);

        this.id = newgid();
        graphs.set(this.id, this);

        this.emit = function(name, detail) {
            this.dispatchEvent(new CustomEvent(name, {
                detail: detail
            }));
            this.dispatchEvent(new CustomEvent('graph-changed'));
        };

        this.global_inputs = new Immutable.Map();
        this.global_outputs = new Immutable.Map();

        this.nodes = new Immutable.Map();

        this.edges_by_src = new Immutable.Map();
        this.edges_by_dst = new Immutable.Map();
    }

    addGlobalInput(name, type) {
        this.global_inputs = this.global_inputs.set(name,
            { name, type, data: null }
        );
        this.emit('global-input-added', { name, type });
    }

    removeGlobalInput(name) {
        this.global_inputs = this.global_inputs.delete(name);
        this.emit('global-input-removed', { name });
    }

    setGlobalInputData(name, data) {
        this.global_inputs.get(name).data = data;
    }

    getGlobalInputData(name) {
        return this.global_inputs.get(name).data;
    }

    addGlobalOutput(name, type) {
        this.global_outputs = this.global_outputs.set(name,
            { name, type, data: null }
        );
        this.emit('global-output-added', { name, type });
    }

    removeGlobalInput(name) {
        this.global_outputs = this.global_outputs.delete(name);
        this.emit('global-output-removed', { name });
    }
    setGlobalOutputData(name, data) {
        this.global_outputs.get(name).data = data;
    }
    getGlobalOutputData(name) {
        return this.global_outputs.get(name).data;
    }

    addNode(path, options = {}) {
        let Ctor = node_types.get(path);

        if (!Ctor) {
            throw Error('unknown node type' + path);
        }

        const id = newgid();
        const graph = this;
        const title = options.title || Ctor.title || path;
        const pos = options.pos || Const.Graph.DEFAULT_POSITION.concat();
        const type = path;

        let node = new Ctor({graph, id, title, pos, type});

        this.nodes = this.nodes.set(node.id, node);

        this.emit('node-added', { node });

        return node;
    }

    validConnection(src_type, dst_type) {
        if (!src_type || !dst_type)
            return true;

        if (typeof(src_type) === 'string' && typeof(dst_type) === 'string') {
            return (src_type == dst_type);
        }

        if (src_type == 'number' && dst_type.isUnit) {
            return true;
        }

        return dst_type.isUnit && src_type.isUnit;
    }

    toposort() {
        const GREY = 1;
        const BLACK = 2;

        let ordered = [];
        let stack = [];

        let visited = new Map();

        this.forEachNode((source, source_id) => {
            if (visited.has(source_id))
                return;

            stack.push([source_id, false]);

            while (stack.length > 0) {
                let [id, processed] = stack.pop();
                let node = this.getNodeById(id);
                if (!processed) {
                    let marked = visited.get(id);

                    if (marked == GREY)
                        throw Error('cycle detected');

                    if (marked == BLACK)
                        continue;
                    stack.push([id, true]);
                    visited.set(id, GREY);
                    this.forEachEdgeFromNode(node, function(edge) {
                        stack.push([edge.dst_id, false]);
                    });
                } else {
                    visited.set(id, BLACK);
                    ordered.unshift([id, node]);
                }
            }
        });
        this.nodes = Immutable.OrderedMap(ordered);
    }

    connect(src, src_slot, dst, dst_slot) {
        let src_type = src.outputs[src_slot].type;
        let dst_type = dst.inputs[dst_slot].type;

        if (!this.validConnection(src_type, dst_type))
            return false;

        let edge = {
            id: newgid(),
            src_id: src.id,
            src_slot, src_slot,
            dst_id: dst.id,
            dst_slot: dst_slot,
        };

        let old_src = this.edges_by_src;
        let old_dst = this.edges_by_dst;

        this.edges_by_src = this.edges_by_src.updateIn([src.id, src_slot],
            Immutable.Set(), (edgelist) => edgelist.add(edge));

        let prev_edge = this.edges_by_dst.getIn([dst.id, dst_slot]);

        if (prev_edge)
            this.disconnect(prev_edge, /* no_emit= */true);

        this.edges_by_dst = this.edges_by_dst.setIn([dst.id, dst_slot], edge);
        try {
            this.toposort();
            this.emit('edge-added', { edge });
            if (prev_edge)
                this.emit('edge-removed', { prev_edge });
            return edge;
        } catch (e) {
            console.log('beep...');
            console.log(e);
            // a cycle was created
            this.edges_by_src = old_src;
            this.edges_by_dst = old_dst;
            return false;
        }
    }

    disconnect(edge, no_emit=false) {
        this.edges_by_src = this.edges_by_src.updateIn([edge.src_id, edge.src_slot],
            Immutable.Set(), (edgelist) => edgelist.delete(edge));

        this.edges_by_dst = this.edges_by_dst.deleteIn([edge.dst_id, edge.dst_slot]);
        if (!no_emit)
            this.emit('edge-removed', { edge });
    }

    getNodeByInput(dst, dst_slot) {
        let edge = this.edges_by_dst.getIn([dst.id, dst_slot]);

        if (!edge)
            return null;

        let node = this.nodes.get(edge.src_id);

        return {
            node: node,
            slot: edge.src_slot
        };
    }

    getNodeById(node_id) {
        return this.nodes.get(node_id);
    }

    runStep() {
        this.nodes.forEach(function(node, id) {
            node.clearOutgoingData();
            node.onExecute();
        });
    }

    forEachNode(f) {
        return this.nodes.forEach(f);
    }

    forEachEdgeToNode(node, f) {
        let edges_by_slot = this.edges_by_dst.get(node.id);

        if (edges_by_slot !== undefined)
            edges_by_slot.forEach(f);
    }

    numEdgesToNode(node) {
        let edges_by_slot = this.edges_by_dst.get(node.id);
        if (edges_by_slot !== undefined) {
            return edges_by_slot.count();
        } else {
            return 0;
        }
    }

    forEachEdgeFromNode(node, f) {
        let edges_by_slot = this.edges_by_src.get(node.id);

        if (edges_by_slot)
            edges_by_slot.forEach((slot) => slot.forEach(f));
    }

    numEdgesFromNode(node) {
        let total = 0;
        let edges_by_slot = this.edges_by_src.get(node.id);

        if (edges_by_slot)
            edges_by_slot.forEach((slot) => total += slot.count());
        return total;
    }

    forEachEdgeFromSlot(node, slot, f) {
        this.edges_by_src.getIn([node.id, slot], Immutable.List()).forEach(f);
    }

    numEdgesAtSlot(node, slot, is_input) {
        if (is_input)
            return this.hasIncomingEdge(node, slot) ? 1 : 0;

        let edgelist = this.edges_by_src.getIn([node.id, slot]);
        return edgelist ? edgelist.count() : 0;
    }

    hasIncomingEdge(node, slot) {
        return this.getIncomingEdge(node, slot) !== undefined;
    }

    getIncomingEdge(node, slot) {
        return this.edges_by_dst.getIn([node.id, slot]);
    }

    forEachEdge(f) {
        return this.forEachNode((node) => this.forEachEdgeFromNode(node, f));
    }
}


const DEFAULT_CONFIG = {
    color: '#999',
    bgcolor: '#444',
    boxcolor: '#aef',
    removable: true,
};

export class GraphNode {
    static input(name, type) {
        return {name, type, autoconvert: true};
    }

    static output(name, type) {
        return {name, type};
    }

    constructor({graph, id, title, pos, type},
                inputs, outputs,
                {config = {}, properties = {}} = {}) {

        this.graph = graph;
        this.id = id;
        this.title = title;
        this.pos = pos;
        this.type = type;

        this.inputs = inputs;
        this.outputs = outputs;
        this.properties = properties;
        this.config = {...DEFAULT_CONFIG, ...config};
        this.outgoing_data = [];
    }

    getOutgoingData(slot) {
        let output = this.outputs[slot];

        let outgoing = this.outgoing_data[slot];

        if (outgoing && output.type && output.type.isUnit) {
            let Ctor = output.type;
            outgoing = new Ctor(outgoing.valueOf());
        }
        return outgoing;
    }
    getInputData(slot) {
        let src = this.graph.getNodeByInput(this, slot);

        let input = this.inputs[slot];

        let data = undefined;
        if (src) {
            data = src.node.getOutgoingData(src.slot);
        }

        if (data == undefined) {
            data = this.properties[input.name];
        }

        if (data !== undefined && input.type && input.type.isUnit) {
            if (data.isUnit && input.autoconvert) {
                data = data.convertTo(input.type);
            } else {
                let Ctor = input.type;
                data = new Ctor(data);
            }
        }
        return data;
    }

    setOutputData(slot, data) {
        this.outgoing_data[slot] = data;
    }

    setPosition(x, y) {
        this.pos = [x, y];
        this.graph.emit('node-moved', {
            node: this,
            position: this.pos
        });
    }
    clearOutgoingData() {
        for (let i = 0; i < this.outgoing_data.length; i++)
            this.outgoing_data[i] = null;
    }

    numEdgesToNode() {
        return this.graph.numEdgesToNode(this);
    }

    modified() {
        this.graph.dispatchChange(new CustomEvent('node-modified', {
            detail: {
                node: this
            }
        }));
    }
    snapshot() {
        let input_settings = this.inputs.map(function(input) {
            return {autoconvert: input.autoconvert};
        });
        let data = {
            pos: this.pos,
            defaults: Util.JSON.normalized(this.properties),
            input_settings: input_settings,
            type: this.type,
            id: this.id,
            title: this.title,
        };
        return Immutable.fromJS(data);
    }

    restore(snapshot) {
        let self = this;
        this.pos = snapshot.get('pos').toJS();
        this.properties = Util.JSON.denormalized(snapshot.get('defaults').toJS());
        snapshot.get('input_settings').forEach(function(val, i) {
            self.inputs[i].autoconvert = val.autoconvert;
        });
        this.type = snapshot.get('type');
        this.id = snapshot.get('id');
        this.title = snapshot.get('title');
    }
}
