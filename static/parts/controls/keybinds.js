Solar.Controls.Keybinds = (function($, actions){
    $(function(){ actions.onReady(function(){

        var listener = new window.keypress.Listener();
        var ra = actions.rotationActions();
        listener.register_combo({
            keys: "left",
            on_keydown: ra.rotateLeft,
            on_keyup: ra.stopRotateLeft
        });

        listener.register_combo({
            keys: "right",
            on_keydown: ra.rotateRight,
            on_keyup: ra.stopRotateRight
        });

        var trackActions = actions.trackObjectActions();
        listener.register_combo({
            keys: "tab",
            on_keyup: trackActions.trackNext,
            is_solitary: true,
            prevent_default: true
        });
        listener.register_combo({
            keys: "shift tab",
            on_keyup: trackActions.trackPrevious,
            prevent_default: true
        });

        var zoomActions = actions.zoomActions();
        listener.register_combo({
            keys: "up",
            on_keydown: zoomActions.zoomIn,
            on_keyup: zoomActions.stopZoomIn
        });

        listener.register_combo({
            keys: "down",
            on_keydown: zoomActions.zoomOut,
            on_keyup: zoomActions.stopZoomOut
        });

    })});
})($, Solar.Controls.Actions);