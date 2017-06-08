/*
 * Generic Mapping class.
 *
 * Provides a common interface to list types of mapping transformations and
 * generate sets of points from them.
 */
var Mapping = function(manager, group, id, initname) {
	var self = this;

	this.group = group;
	this.model = group.model;
	this.id = id;
	this.tree_id = group.tree_id + '-map-' + id;
	var _name = initname;

	this.widget = null;
	this.configuring = false;

	/*
	 * To be provided by mapping subclasses:
	 */
	this.mapPoint = null;
	this.showConfig = null;
	this.hideConfig = null;
	// map_types describes each type of transformation the mapping supports,
	// in the form: { uniqueidentifier: { name: ..., mapPoint: ...}, ... }
	this.map_types = {};

	Object.defineProperty(this, 'name', {
		get: function() { return _name; },
		set: function(v) {
			if (v.length > Const.max_name_len) {
				v = v.slice(0, Const.max_name_len);
			}
			_name = v;
			manager.tree.updateItem(self.tree_id, {
				content: _name,
				dataset: {mapping: self}
			});
		}
	});

	Object.defineProperty(this, 'type_menu', {
		get: function() {
			var menu = {};
			for (type in self.map_types) {
				menu[self.map_types[type].name] = type;
			}
			return menu;
		}
	});

	var elem = manager.tree.insertItem({
		id: self.tree_id,
		content: _name,
		dataset: {mapping: self}
	}, group.tree_id);

	this.getPositions = function(type) {
		if (!(type in self.map_types)) {
			console.error("No such mapping type: " + type);
			return;
		}
		var mapFn = self.map_types[type].mapPoint;
		return group.pixels.map(function(idx) {
			return [idx, mapFn(idx)];
		});
	}

	this.destroy = function() {
		if (self.configuring)
			self.hideConfig();
		manager.tree.removeItem(self.tree_id);
	}
}