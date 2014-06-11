Solar.UI.ActionSelection = (function(jquery){

    var url = 'parts/ui/components/actionSelection.mustache';
    function enable(parent, actions) {
        isEnabled = true;

        jquery.get(url, function(data){
            var actionTemplate = Handlebars.compile(data);
            var action = actionTemplate({actions: actions});
            parent.append(action);

            for ( var i = 0; i < actions.length; i++ ) {
                var action = actions[i];
                var id = action.id;
                var handler = action.handler;
                jquery('#'+id).click(handler);
            }
        });


    }

    function disable() {

    }

    return {
        enable: enable,
        disable: disable
    }
})($);
