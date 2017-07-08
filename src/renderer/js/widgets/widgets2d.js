import * as THREE from 'three';
import * as d3 from 'd3';
import keyboardJS from 'keyboardjs';
import Hotkey from 'chl/keybindings';
import Util from 'chl/util';

/* This describes a position and orientation in 2d space; it has both 2d
 * spatial coordinates (which are normalized and range from 0-1, and an angle.
 */
function Coordinates2D() {
    let self = this;

    this.x = 0;
    this.y = 0;
    this.angle = 0;

    this.data = function() {
        // Normalize angle and position
        this.angle = this.angle % (Math.PI * 2);
        return {x: this.x, y: this.y, angle: this.angle};
    };

    this.setPos = function(vx, vy) {
        this.x = vx; this.y = vy;
    };

    this.setRot = function(new_angle) {
        this.angle = new_angle;
    };
}

/* This is a Coordinates2D object that has a describes a bunch of behaviors for letting the
 * user manipulate its position and angle. It also has callbacks to let display
 * code know what behaviors are happening at a time.
 *
 * (The callbacks should probably be rewritten to use events)
 */
export default function Widget2D(widgetElement) {

    Coordinates2D.call(this);
    Util.EventDispatcher.call(this);

    let self = this;

    let snap_angles = false;

    function setPos(vx, vy) {
        self.x = vx;
        self.y = vy;
        if (self.onPosChange)
            self.onPosChange(self.x, self.y);
    }

    this.showAt = function(vx, vy) {
        setPos(vx / widgetElement.clientWidth, vy / widgetElement.clientHeight);
        self.show();
    };

    /*
     * Control bindings: modifier keys and draggable areas
     */
    keyboardJS.bind(Hotkey.widget_snap_angles,
        function() { snap_angles = true; },
        function() { snap_angles = false; });

    function notifyChange() {
        self.dispatchEvent(new CustomEvent('change', { detail: self.data() }));
    }

    function _drag(event) {
        event.preventDefault();
        let coords = Util.relativeCoords(widgetElement, event.pageX, event.pageY);

        self.x =  (coords.x / widgetElement.clientWidth ) * 2 - 1;
        self.y = -(coords.y / widgetElement.clientHeight) * 2 + 1;
        if (self.onPosChange)
            self.onPosChange(self.x, self.y);
    }

    function _endDrag(event) {
        event.preventDefault();
        widgetElement.removeEventListener('mousemove', _drag);
        widgetElement.removeEventListener('mouseup', _endDrag);
        notifyChange();
    }

    this.dragBehavior = function(thing, start, end) {
        thing.on('mousedown', function() {
            self.dragging = true;
            if (start) start();
            widgetElement.addEventListener('mousemove', _drag);
            widgetElement.addEventListener('mouseup', function(event) {
                self.dragging = false;
                if (end) end(event);
                _endDrag(event);
            });
            d3.event.preventDefault();
        });
    };


    this.rotationBehavior = function(start, angleOffset) {
        return d3.drag().on('start', function() {
            self.rotating = true;
            start();
        }).on('drag', function() {
            let clk = new THREE.Vector2(d3.event.x, d3.event.y);
            self.angle += (clk.sub(self.origin).angle() + angleOffset);

            /* shift-snap to 15 degree angle increments */
            if (snap_angles) {
                self.angle = self.angle - (self.angle % (Math.PI / 12));
            }

            if (self.onAngleChange)
                self.onAngleChange(self.angle);
        }).on('end', function() {
            self.rotating = false;
            notifyChange();
        });
    };
}
Widget2D.prototype = Object.create(Coordinates2D.prototype);