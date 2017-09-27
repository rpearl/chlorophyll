// External dependencies
import Vue from 'vue';

import { remote } from 'electron';

// Chlorophyll modules
import Hotkey from 'chl/keybindings';
import { Model, setCurrentModel } from 'chl/model';
import { activeScreen, initRenderer, initClippingPlanes, renderViewport } from 'chl/viewport';
import { MarqueeSelection, LineSelection, PlaneSelection } from 'chl/tools/selection';
import { writeSavefile } from 'chl/savefile';

import 'chl/patches';
import 'chl/patterns';

import rootComponent from '@/components/root';
import chrysanthemum from 'models/chrysanthemum'; // TODO proper loader

const { app, Menu, dialog } = remote;

// Chlorophyll UI manager objects

export {
    animManager,
};


// tool declaration
let selectionTools;

function initSelectionTools(model) {
    let viewport = document.getElementById('viewport');
    selectionTools = [
        {
            name: 'camera',
            toolobj: {
                enable() {
                    activeScreen().controlsEnabled = true;
                },
                disable() {
                    activeScreen().controlsEnabled = false;
                }
            },
            hotkey: Hotkey.tool_camera,
            momentary_hotkey: Hotkey.tool_camera_momentary,
            active: true,
        },
        null,
        {
            name: 'marquee',
            toolobj: new MarqueeSelection(viewport, model),
            hotkey: Hotkey.tool_select_marquee
        },
        {
            name: 'line',
            toolobj: new LineSelection(viewport, model),
            hotkey: Hotkey.tool_select_line
        },
        {
            name: 'plane',
            toolobj: new PlaneSelection(viewport, model),
            hotkey: Hotkey.tool_select_plane
        },
        null
    ];
}

// menu creation

function initMenu() {
    let appMenu = [];

    let windowMenu = {
        role: 'window',
        submenu: [
            {role: 'minimize'},
            {role: 'close'}
        ]
    };

    if (process.platform === 'darwin') {
        appMenu = [{
            label: app.getName(),
            submenu: [
                {role: 'about'},
                {type: 'separator'},
                {role: 'services', submenu: []},
                {type: 'separator'},
                {role: 'hide'},
                {role: 'hideothers'},
                {role: 'unhide'},
                {type: 'separator'},
                {role: 'quit'}
            ]
        }];

        windowMenu.submenu = [
            {role: 'close'},
            {role: 'minimize'},
            {role: 'zoom'},
            {type: 'separator'},
            {role: 'front'}
        ];
    }

    /* xxx add this back in once toolbox is rewritten
    let selectionMenu = selectionTools.filter((t) => t !== null).map((tool) => ({
        label: tool.name,
        click() {
            toolbarManager.active = tool.name;
        }
    }));

    let toolMenu = {
        label: 'Tools',
        submenu: [
            {
                label: 'Selection',
                submenu: selectionMenu
            }
        ],
    };
    */

    const menuTemplate = [
        ...appMenu,
        {
            label: 'File',
            submenu: [
                {
                    label: 'Save As...',
                    accelerator: 'CommandOrControl+Shift+S',
                    click() {
                        dialog.showSaveDialog({
                            filters: [
                                { name: 'Chlorophyll project file', extensions: ['chl'] }
                            ]
                        }, writeSavefile);
                    }
                }
            ],
        },
        {
            label: 'Edit',
            submenu: [
                {
                    label: 'Undo',
                    accelerator: 'CommandOrControl+Z',
                    click() {
                        // todo undo
                    }
                },
                {
                    label: 'Redo',
                    accelerator: 'ComandOrControl+Shift+Z',
                    click() {
                        // todo redo
                    }
                },
                { type: 'separator' },
                {
                    label: 'Viewport Settings',
                    click() {
                        // todo once layout
                        // rendering_win.show();
                        // rendering_win.setPosition(window.innerWidth - 520, 20);
                    }
                },
            ]
        },
        /* toolMenu, */
        windowMenu,
        {
            role: 'help',
        },
    ];
    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
}


function Chlorophyll() {
    const self = this;

    this.frontPlane = null;
    this.backPlane = null;
    this.selectionThreshold = 5; // TODO track in selection tools


    this.init = function() {
        initRenderer();
        let model = new Model(chrysanthemum);
        setCurrentModel(model);
        initMenu();

        let root = new Vue(rootComponent);
        root.$mount('#app');
        initClippingPlanes();
        initSelectionTools(model);
        root.selectionTools = selectionTools;


    };

    this.animate = function() {
        window.requestAnimationFrame(self.animate);
        renderViewport();
    };
}

export default new Chlorophyll();

